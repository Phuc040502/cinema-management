const { executeQuery, executeStoredProcedure } = require("../config/database");

const movieController = {
  // Lấy danh sách phim đang chiếu
  getActiveMovies: async (req, res) => {
    try {
      console.log("getActiveMovies called");
      // Sửa query - loại bỏ GROUP BY phức tạp
      const movies = await executeQuery(
        `SELECT 
          m.movie_id,
          m.title,
          m.description,
          m.duration,
          m.genre_id,
          g.genre_name,
          m.director,
          m.cast,
          m.poster_url,
          m.trailer_url,
          m.rating,
          m.release_date,
          m.end_date,
          m.status,
          (SELECT COUNT(*) 
           FROM movie.Showtimes s 
           WHERE s.movie_id = m.movie_id 
           AND s.status = 'ACTIVE' 
           AND s.start_time > GETDATE()) as total_showtimes
         FROM movie.Movies m
         INNER JOIN movie.Genres g ON m.genre_id = g.genre_id
         WHERE m.status = 'ACTIVE'
         ORDER BY m.release_date DESC`
      );

      res.json({
        success: true,
        data: movies,
      });
    } catch (error) {
      console.error("Get active movies error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movies",
        error: error.message,
      });
    }
  },

  // Lấy chi tiết phim
  getMovieById: async (req, res) => {
    try {
      const { movie_id } = req.params;
      console.log("getMovieById called with:", movie_id);

      const movie = await executeQuery(
        `SELECT m.*, g.genre_name 
         FROM movie.Movies m 
         INNER JOIN movie.Genres g ON m.genre_id = g.genre_id 
         WHERE m.movie_id = @movie_id AND m.status = 'ACTIVE'`,
        { movie_id }
      );

      if (movie.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Movie not found",
        });
      }

      res.json({
        success: true,
        data: movie[0],
      });
    } catch (error) {
      console.error("Get movie error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movie details",
        error: error.message,
      });
    }
  },

  // Lấy lịch chiếu theo phim
  getShowtimesByMovie: async (req, res) => {
    try {
      const { movie_id, branch_id, target_date } = req.query;
      console.log("getShowtimesByMovie called with:", {
        movie_id,
        branch_id,
        target_date,
      });

      if (!movie_id) {
        return res.status(400).json({
          success: false,
          message: "Movie ID is required",
        });
      }

      let query = `
        SELECT 
          s.showtime_id,
          s.movie_id,
          m.title,
          s.branch_id,
          b.branch_name,
          s.room_id,
          r.room_name,
          s.start_time,
          s.end_time,
          s.base_price,
          s.available_seats,
          s.booked_seats,
          (s.available_seats - s.booked_seats) as remaining_seats
        FROM movie.Showtimes s
        INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
        INNER JOIN branch.Branches b ON s.branch_id = b.branch_id
        INNER JOIN branch.Rooms r ON s.room_id = r.room_id
        WHERE s.movie_id = @movie_id
          AND s.status = 'ACTIVE'
          AND s.start_time > GETDATE()
      `;

      const params = { movie_id };

      if (target_date) {
        query += " AND CAST(s.start_time AS DATE) = @target_date";
        params.target_date = target_date;
      } else {
        query += " AND CAST(s.start_time AS DATE) >= CAST(GETDATE() AS DATE)";
      }

      if (branch_id) {
        query += " AND s.branch_id = @branch_id";
        params.branch_id = branch_id;
      }

      query += " ORDER BY s.start_time";

      const showtimes = await executeQuery(query, params);

      res.json({
        success: true,
        data: showtimes,
      });
    } catch (error) {
      console.error("Get showtimes error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch showtimes",
        error: error.message,
      });
    }
  },

  // Lấy thông tin ghế cho suất chiếu
  getShowtimeSeats: async (req, res) => {
    try {
      const { showtime_id } = req.query;
      console.log("getShowtimeSeats called with:", showtime_id);

      if (!showtime_id) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID is required",
        });
      }

      const seats = await executeQuery(
        `SELECT 
          ss.showtime_seat_id,
          ss.seat_id,
          s.seat_row,
          s.seat_number,
          s.seat_type_id,
          st.type_name as seat_type_name,
          st.price_multiplier,
          ss.status,
          ss.booking_id
        FROM movie.ShowtimeSeats ss
        INNER JOIN branch.Seats s ON ss.seat_id = s.seat_id
        INNER JOIN branch.SeatTypes st ON s.seat_type_id = st.seat_type_id
        WHERE ss.showtime_id = @showtime_id
        ORDER BY s.seat_row, s.seat_number`,
        { showtime_id }
      );

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

  // Lấy danh sách chi nhánh
  getBranches: async (req, res) => {
    try {
      console.log("getBranches called");
      const branches = await executeQuery(
        `SELECT b.*, u.full_name as manager_name 
         FROM branch.Branches b 
         LEFT JOIN auth.Staffs s ON b.manager_id = s.staff_id 
         LEFT JOIN auth.Users u ON s.user_id = u.user_id 
         WHERE b.status = 'ACTIVE' 
         ORDER BY b.branch_name`
      );

      res.json({
        success: true,
        data: branches,
      });
    } catch (error) {
      console.error("Get branches error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch branches",
        error: error.message,
      });
    }
  },

  // Lấy danh sách thể loại phim
  getGenres: async (req, res) => {
    try {
      console.log("getGenres called");
      const genres = await executeQuery(
        "SELECT * FROM movie.Genres ORDER BY genre_name"
      );

      res.json({
        success: true,
        data: genres,
      });
    } catch (error) {
      console.error("Get genres error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch genres",
        error: error.message,
      });
    }
  },

  // Thêm phim mới (Admin/Manager) - SỬA: THÊM KIỂM TRA DUPLICATE KEY
  createMovie: async (req, res) => {
    try {
      const {
        movie_id,
        title,
        description,
        duration,
        genre_id,
        director,
        cast,
        language,
        subtitle,
        poster_url,
        trailer_url,
        rating,
        release_date,
        end_date,
      } = req.body;

      console.log("createMovie called with:", { movie_id, title });

      // Validate required fields
      if (!movie_id || !title || !duration || !genre_id) {
        return res.status(400).json({
          success: false,
          message: "Movie ID, title, duration, and genre are required",
        });
      }

      // Check if movie already exists
      const existingMovie = await executeQuery(
        "SELECT movie_id FROM movie.Movies WHERE movie_id = @movie_id",
        { movie_id }
      );

      if (existingMovie.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Movie ID already exists",
        });
      }

      await executeQuery(
        `INSERT INTO movie.Movies (
          movie_id, title, description, duration, genre_id, director, cast,
          language, subtitle, poster_url, trailer_url, rating, release_date, end_date,
          status
        ) VALUES (
          @movie_id, @title, @description, @duration, @genre_id, @director, @cast,
          @language, @subtitle, @poster_url, @trailer_url, @rating, @release_date, @end_date,
          'ACTIVE'
        )`,
        {
          movie_id,
          title,
          description,
          duration,
          genre_id,
          director: director || null,
          cast: cast || null,
          language: language || "Tiếng Việt",
          subtitle: subtitle || null,
          poster_url: poster_url || null,
          trailer_url: trailer_url || null,
          rating: rating || null,
          release_date: release_date || null,
          end_date: end_date || null,
        }
      );

      res.status(201).json({
        success: true,
        message: "Movie created successfully",
        data: { movie_id },
      });
    } catch (error) {
      console.error("Create movie error:", error.message);

      // Handle specific SQL errors
      if (
        error.message.includes("PRIMARY KEY constraint") ||
        error.message.includes("duplicate key")
      ) {
        return res.status(409).json({
          success: false,
          message: "Movie ID already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create movie",
        error: error.message,
      });
    }
  },

  // Cập nhật phim
  updateMovie: async (req, res) => {
    try {
      const { movie_id } = req.params;
      const updates = req.body;

      console.log("updateMovie called with:", { movie_id, updates });

      // Danh sách các column hợp lệ trong bảng Movies (loại bỏ các trường không phải column)
      const validColumns = [
        "title",
        "description",
        "duration",
        "genre_id",
        "director",
        "cast",
        "language",
        "subtitle",
        "poster_url",
        "trailer_url",
        "rating",
        "release_date",
        "end_date",
        "status",
      ];

      // Build dynamic update query - chỉ update các column hợp lệ
      const updateFields = [];
      const params = { movie_id };

      Object.keys(updates).forEach((key) => {
        // Chỉ thêm các column hợp lệ và không phải là movie_id (primary key)
        if (key !== "movie_id" && validColumns.includes(key)) {
          updateFields.push(`${key} = @${key}`);
          params[key] = updates[key];
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      updateFields.push("updated_at = GETDATE()");

      const query = `UPDATE movie.Movies SET ${updateFields.join(
        ", "
      )} WHERE movie_id = @movie_id`;

      await executeQuery(query, params);

      res.json({
        success: true,
        message: "Movie updated successfully",
      });
    } catch (error) {
      console.error("Update movie error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update movie",
        error: error.message,
      });
    }
  },
  // Thêm các method quản lý phim cho admin

  // Lấy tất cả phim (bao gồm cả inactive)
  getAllMovies: async (req, res) => {
    try {
      const movies = await executeQuery(
        `SELECT m.*, g.genre_name 
       FROM movie.Movies m 
       INNER JOIN movie.Genres g ON m.genre_id = g.genre_id 
       ORDER BY m.created_at DESC`
      );

      res.json({
        success: true,
        data: movies,
      });
    } catch (error) {
      console.error("Get all movies error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movies",
        error: error.message,
      });
    }
  },

  // Xóa phim (soft delete)
  deleteMovie: async (req, res) => {
    try {
      const { movie_id } = req.params;

      // Check if there are active showtimes for this movie
      const activeShowtimes = await executeQuery(
        `SELECT COUNT(*) as showtime_count 
       FROM movie.Showtimes 
       WHERE movie_id = @movie_id AND status = 'ACTIVE' AND start_time > GETDATE()`,
        { movie_id }
      );

      if (activeShowtimes[0].showtime_count > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete movie. There are active showtimes scheduled for this movie.",
        });
      }

      await executeQuery(
        "UPDATE movie.Movies SET status = @status WHERE movie_id = @movie_id",
        {
          movie_id,
          status: "INACTIVE",
        }
      );

      res.json({
        success: true,
        message: "Movie deleted successfully",
      });
    } catch (error) {
      console.error("Delete movie error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete movie",
        error: error.message,
      });
    }
  },

  // Khôi phục phim
  restoreMovie: async (req, res) => {
    try {
      const { movie_id } = req.params;

      await executeQuery(
        "UPDATE movie.Movies SET status = @status WHERE movie_id = @movie_id",
        {
          movie_id,
          status: "ACTIVE",
        }
      );

      res.json({
        success: true,
        message: "Movie restored successfully",
      });
    } catch (error) {
      console.error("Restore movie error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to restore movie",
        error: error.message,
      });
    }
  },

  // Thống kê phim
  getMovieStats: async (req, res) => {
    try {
      const { movie_id } = req.params;

      const stats = await executeQuery(
        `SELECT 
        m.movie_id,
        m.title,
        COUNT(DISTINCT s.showtime_id) as total_showtimes,
        SUM(s.booked_seats) as total_tickets_sold,
        SUM(s.revenue) as total_revenue,
        AVG(s.booked_seats * 100.0 / s.available_seats) as avg_occupancy_rate
       FROM movie.Movies m
       LEFT JOIN movie.Showtimes s ON m.movie_id = s.movie_id
       WHERE m.movie_id = @movie_id
       GROUP BY m.movie_id, m.title`,
        { movie_id }
      );

      if (stats.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Movie not found",
        });
      }

      res.json({
        success: true,
        data: stats[0],
      });
    } catch (error) {
      console.error("Get movie stats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movie statistics",
        error: error.message,
      });
    }
  },
};

module.exports = movieController;
