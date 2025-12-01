const { executeQuery, executeStoredProcedure } = require("../config/database");

const showtimeController = {
  // Lấy thông tin ghế cho suất chiếu
  getShowtimeSeats: async (req, res) => {
    try {
      const { showtime_id } = req.query;

      if (!showtime_id) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID is required",
        });
      }

      const seats = await executeStoredProcedure("movie.sp_GetShowtimeSeats", {
        showtime_id,
      });

      res.json({
        success: true,
        data: seats,
      });
    } catch (error) {
      console.error("Get showtime seats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch showtime seats",
        error: error.message,
      });
    }
  },

  // Lấy danh sách suất chiếu theo chi nhánh (cho manager)
  getShowtimesByBranch: async (req, res) => {
    try {
      const { branch_id } = req.params;
      const { start_date, end_date, movie_id } = req.query;

      const user = req.user;

      // Manager chỉ được xem suất chiếu của chi nhánh mình
      if (user.role === "MANAGER" && user.branch_id !== branch_id) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only view showtimes from your own branch.",
        });
      }

      let query = `
        SELECT 
          s.showtime_id,
          s.movie_id,
          m.title as movie_title,
          m.duration,
          m.poster_url,
          s.branch_id,
          b.branch_name,
          s.room_id,
          r.room_name,
          s.start_time,
          s.end_time,
          s.base_price,
          s.available_seats,
          s.booked_seats,
          (s.available_seats - s.booked_seats) as remaining_seats,
          s.status,
          s.revenue,
          s.created_at
        FROM movie.Showtimes s
        INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
        INNER JOIN branch.Branches b ON s.branch_id = b.branch_id
        INNER JOIN branch.Rooms r ON s.room_id = r.room_id
        WHERE s.branch_id = @branch_id
      `;

      const params = { branch_id };

      if (start_date && end_date) {
        query +=
          " AND CONVERT(DATE, s.start_time) BETWEEN @start_date AND @end_date";
        params.start_date = start_date;
        params.end_date = end_date;
      }

      if (movie_id) {
        query += " AND s.movie_id = @movie_id";
        params.movie_id = movie_id;
      }

      query += " ORDER BY s.start_time DESC";

      const showtimes = await executeQuery(query, params);

      res.json({
        success: true,
        data: showtimes,
      });
    } catch (error) {
      console.error("Get showtimes by branch error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch showtimes",
        error: error.message,
      });
    }
  },

  // Lấy thông tin chi tiết suất chiếu
  getShowtimeDetail: async (req, res) => {
    try {
      const { showtime_id } = req.params;

      const showtime = await executeQuery(
        `SELECT 
          s.*,
          m.title as movie_title,
          m.duration,
          m.poster_url,
          b.branch_name,
          r.room_name,
          r.total_seats
         FROM movie.Showtimes s
         INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
         INNER JOIN branch.Branches b ON s.branch_id = b.branch_id
         INNER JOIN branch.Rooms r ON s.room_id = r.room_id
         WHERE s.showtime_id = @showtime_id`,
        { showtime_id }
      );

      if (showtime.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Showtime not found",
        });
      }

      res.json({
        success: true,
        data: showtime[0],
      });
    } catch (error) {
      console.error("Get showtime detail error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch showtime details",
        error: error.message,
      });
    }
  },

  // Tạo suất chiếu mới (Manager) - CHỈ GIỮ LẠI 1 HÀM
  createShowtime: async (req, res) => {
    try {
      const {
        showtime_id,
        movie_id,
        branch_id,
        room_id,
        start_time,
        base_price,
      } = req.body;

      console.log("=== CREATE SHOWTIME REQUEST ===");
      console.log("Request body:", req.body);
      console.log("User:", req.user);

      const user = req.user;

      // Validate required fields
      if (
        !showtime_id ||
        !movie_id ||
        !branch_id ||
        !room_id ||
        !start_time ||
        !base_price
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      // Manager chỉ được tạo suất chiếu cho chi nhánh của mình
      if (user.role === "MANAGER" && user.branch_id !== branch_id) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only create showtimes for your own branch.",
        });
      }

      // Kiểm tra room
      const room = await executeQuery(
        `SELECT branch_id, total_seats FROM branch.Rooms WHERE room_id = @room_id AND status = 'ACTIVE'`,
        { room_id }
      );

      if (room.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Room not found or inactive",
        });
      }

      if (room[0].branch_id !== branch_id) {
        return res.status(400).json({
          success: false,
          message: "Room does not belong to the specified branch",
        });
      }

      // Kiểm tra movie
      const movie = await executeQuery(
        `SELECT duration FROM movie.Movies WHERE movie_id = @movie_id AND status = 'ACTIVE'`,
        { movie_id }
      );

      if (movie.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Movie not found or inactive",
        });
      }

      // Tính end_time
      const duration = movie[0].duration;
      const startTime = new Date(start_time);
      const endTime = new Date(startTime.getTime() + duration * 60000);

      // Kiểm tra trùng lịch
      const conflictingShowtimes = await executeQuery(
        `SELECT showtime_id FROM movie.Showtimes 
         WHERE room_id = @room_id 
         AND status = 'ACTIVE'
         AND (
           (start_time <= @start_time AND end_time > @start_time) OR
           (start_time < @end_time AND end_time >= @end_time) OR
           (start_time >= @start_time AND end_time <= @end_time)
         )`,
        {
          room_id,
          start_time: startTime,
          end_time: endTime,
        }
      );

      if (conflictingShowtimes.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Showtime conflicts with existing showtime in the same room",
        });
      }

      const totalSeats = room[0].total_seats;

      // Tạo suất chiếu
      await executeQuery(
        `INSERT INTO movie.Showtimes (
          showtime_id, movie_id, branch_id, room_id, start_time, end_time,
          base_price, available_seats
        ) VALUES (
          @showtime_id, @movie_id, @branch_id, @room_id, @start_time, @end_time,
          @base_price, @available_seats
        )`,
        {
          showtime_id,
          movie_id,
          branch_id,
          room_id,
          start_time: startTime,
          end_time: endTime,
          base_price,
          available_seats: totalSeats,
        }
      );

      // Tạo showtime seats
      const seats = await executeQuery(
        "SELECT seat_id FROM branch.Seats WHERE room_id = @room_id",
        { room_id }
      );

      for (const seat of seats) {
        await executeQuery(
          `INSERT INTO movie.ShowtimeSeats (showtime_id, seat_id, status)
           VALUES (@showtime_id, @seat_id, 'AVAILABLE')`,
          {
            showtime_id,
            seat_id: seat.seat_id,
          }
        );
      }

      res.status(201).json({
        success: true,
        message: "Showtime created successfully",
        data: { showtime_id },
      });
    } catch (error) {
      console.error("Create showtime error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create showtime",
        error: error.message,
      });
    }
  },

  // Cập nhật suất chiếu - CHỈ GIỮ LẠI 1 HÀM
  updateShowtime: async (req, res) => {
    try {
      const { showtime_id } = req.params;
      const { start_time, base_price, status } = req.body;

      // Kiểm tra suất chiếu tồn tại
      const currentShowtime = await executeQuery(
        "SELECT * FROM movie.Showtimes WHERE showtime_id = @showtime_id",
        { showtime_id }
      );

      if (currentShowtime.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Showtime not found",
        });
      }

      const updates = [];
      const params = { showtime_id };

      if (start_time) {
        const startTime = new Date(start_time);
        if (isNaN(startTime.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start time format",
          });
        }

        updates.push("start_time = @start_time");
        params.start_time = startTime;

        // Tính lại end_time
        const movie = await executeQuery(
          "SELECT duration FROM movie.Movies WHERE movie_id = @movie_id",
          { movie_id: currentShowtime[0].movie_id }
        );

        if (movie.length > 0) {
          const duration = movie[0].duration;
          const endTime = new Date(startTime.getTime() + duration * 60000);
          updates.push("end_time = @end_time");
          params.end_time = endTime;
        }
      }

      if (base_price) {
        updates.push("base_price = @base_price");
        params.base_price = base_price;
      }

      if (status) {
        updates.push("status = @status");
        params.status = status;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No fields to update",
        });
      }

      updates.push("updated_at = GETDATE()");

      await executeQuery(
        `UPDATE movie.Showtimes SET ${updates.join(
          ", "
        )} WHERE showtime_id = @showtime_id`,
        params
      );

      res.json({
        success: true,
        message: "Showtime updated successfully",
      });
    } catch (error) {
      console.error("Update showtime error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update showtime",
        error: error.message,
      });
    }
  },

  // Xóa suất chiếu (soft delete) - CHỈ GIỮ LẠI 1 HÀM
  deleteShowtime: async (req, res) => {
    try {
      const { showtime_id } = req.params;

      // Kiểm tra xem có booking nào cho suất chiếu này không
      const bookings = await executeQuery(
        `SELECT COUNT(*) as booking_count 
         FROM booking.Bookings 
         WHERE showtime_id = @showtime_id AND status != 'CANCELLED'`,
        { showtime_id }
      );

      if (bookings[0].booking_count > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete showtime with active bookings",
        });
      }

      await executeQuery(
        `UPDATE movie.Showtimes SET status = 'INACTIVE', updated_at = GETDATE() WHERE showtime_id = @showtime_id`,
        { showtime_id }
      );

      res.json({
        success: true,
        message: "Showtime deleted successfully",
      });
    } catch (error) {
      console.error("Delete showtime error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete showtime",
        error: error.message,
      });
    }
  },

  // Lấy phòng theo chi nhánh
  getRoomsByBranch: async (req, res) => {
    try {
      const { branch_id } = req.params;
      const user = req.user;

      // Manager chỉ được xem phòng của chi nhánh mình
      if (user.role === "MANAGER" && user.branch_id !== branch_id) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only view rooms from your own branch.",
        });
      }

      const rooms = await executeQuery(
        `SELECT room_id, room_code, room_name, total_seats, room_type, screen_type, status
       FROM branch.Rooms 
       WHERE branch_id = @branch_id AND status = 'ACTIVE'
       ORDER BY room_code`,
        { branch_id }
      );

      res.json({
        success: true,
        data: rooms,
      });
    } catch (error) {
      console.error("Get rooms by branch error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch rooms",
        error: error.message,
      });
    }
  },
};

module.exports = showtimeController;
