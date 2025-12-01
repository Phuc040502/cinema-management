const { executeQuery } = require("../config/database");

const roomController = {
  // Lấy danh sách phòng theo chi nhánh (chỉ manager của chi nhánh đó)
  getRoomsByBranch: async (req, res) => {
    try {
      const { branch_id } = req.params;
      const manager_id = req.user.user_id;

      console.log("getRoomsByBranch called with:", { branch_id, manager_id });

      // KIỂM TRA QUYỀN - SỬA ĐIỀU KIỆN NÀY
      const managerCheck = await executeQuery(
        `SELECT s.staff_id 
         FROM auth.Staffs s 
         INNER JOIN auth.Users u ON s.user_id = u.user_id
         WHERE s.user_id = @manager_id AND s.branch_id = @branch_id 
         AND (u.role = 'MANAGER' OR u.role = 'ADMIN' OR s.position LIKE '%manager%' OR s.position LIKE N'%trưởng%')`,
        { manager_id, branch_id }
      );

      console.log("Manager check result:", managerCheck);

      if (managerCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message:
            "Bạn không có quyền quản lý phòng chiếu của chi nhánh này. Chỉ Manager hoặc Admin mới có quyền này.",
        });
      }

      const rooms = await executeQuery(
        `SELECT * FROM branch.Rooms 
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

  // Tạo phòng mới
  createRoom: async (req, res) => {
    try {
      const {
        room_id,
        branch_id,
        room_code,
        room_name,
        total_seats,
        room_type,
        screen_type,
        facilities,
      } = req.body;
      const manager_id = req.user.user_id;

      console.log("=== CREATE ROOM REQUEST ===");
      console.log("Generated room_id:", room_id); // Thêm dòng này để log room_id
      console.log("Request body:", req.body);
      console.log("Manager ID:", manager_id);
      console.log("Branch ID:", branch_id);

      // KIỂM TRA QUYỀN - SỬA ĐIỀU KIỆN NÀY
      const managerCheck = await executeQuery(
        `SELECT s.staff_id 
         FROM auth.Staffs s 
         INNER JOIN auth.Users u ON s.user_id = u.user_id
         WHERE s.user_id = @manager_id AND s.branch_id = @branch_id 
         AND (u.role = 'MANAGER' OR u.role = 'ADMIN' OR s.position LIKE '%manager%' OR s.position LIKE N'%trưởng%')`,
        { manager_id, branch_id }
      );

      console.log("Manager check result:", managerCheck);

      if (managerCheck.length === 0) {
        // Kiểm tra thêm xem user có phải là admin không (admin có thể quản lý mọi chi nhánh)
        const adminCheck = await executeQuery(
          `SELECT user_id FROM auth.Users WHERE user_id = @manager_id AND role = 'ADMIN'`,
          { manager_id }
        );

        if (adminCheck.length === 0) {
          return res.status(403).json({
            success: false,
            message:
              "Bạn không có quyền tạo phòng cho chi nhánh này. Chỉ Manager của chi nhánh hoặc Admin mới có quyền này.",
          });
        }
      }

      // Kiểm tra room_code đã tồn tại trong chi nhánh chưa
      const existingRoom = await executeQuery(
        `SELECT room_id FROM branch.Rooms WHERE branch_id = @branch_id AND room_code = @room_code`,
        { branch_id, room_code }
      );

      if (existingRoom.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Mã phòng đã tồn tại trong chi nhánh này",
        });
      }

      await executeQuery(
        `INSERT INTO branch.Rooms (room_id, branch_id, room_code, room_name, total_seats, room_type, screen_type, facilities)
         VALUES (@room_id, @branch_id, @room_code, @room_name, @total_seats, @room_type, @screen_type, @facilities)`,
        {
          room_id,
          branch_id,
          room_code,
          room_name,
          total_seats,
          room_type: room_type || "STANDARD",
          screen_type: screen_type || "2D",
          facilities: facilities ? JSON.stringify(facilities) : null,
        }
      );

      console.log("Room created successfully");

      res.status(201).json({
        success: true,
        message: "Tạo phòng thành công",
        data: { room_id },
      });
    } catch (error) {
      console.error("Create room error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create room",
        error: error.message,
      });
    }
  },

  // Cập nhật phòng
  updateRoom: async (req, res) => {
    try {
      const { room_id } = req.params;
      const updates = req.body;
      const manager_id = req.user.user_id;

      console.log("updateRoom called with:", { room_id, updates });

      // Lấy thông tin phòng để kiểm tra branch_id
      const room = await executeQuery(
        `SELECT branch_id FROM branch.Rooms WHERE room_id = @room_id`,
        { room_id }
      );

      if (room.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phòng",
        });
      }

      const branch_id = room[0].branch_id;

      // KIỂM TRA QUYỀN - SỬA ĐIỀU KIỆN NÀY
      const managerCheck = await executeQuery(
        `SELECT s.staff_id 
         FROM auth.Staffs s 
         INNER JOIN auth.Users u ON s.user_id = u.user_id
         WHERE s.user_id = @manager_id AND s.branch_id = @branch_id 
         AND (u.role = 'MANAGER' OR u.role = 'ADMIN' OR s.position LIKE '%manager%' OR s.position LIKE N'%trưởng%')`,
        { manager_id, branch_id }
      );

      if (managerCheck.length === 0) {
        // Kiểm tra admin
        const adminCheck = await executeQuery(
          `SELECT user_id FROM auth.Users WHERE user_id = @manager_id AND role = 'ADMIN'`,
          { manager_id }
        );

        if (adminCheck.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Bạn không có quyền cập nhật phòng này",
          });
        }
      }

      // Build dynamic update query
      const updateFields = [];
      const params = { room_id };

      Object.keys(updates).forEach((key) => {
        if (key !== "room_id" && key !== "branch_id") {
          updateFields.push(`${key} = @${key}`);
          params[key] = updates[key];
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không có trường nào để cập nhật",
        });
      }

      const query = `UPDATE branch.Rooms SET ${updateFields.join(
        ", "
      )} WHERE room_id = @room_id`;

      await executeQuery(query, params);

      res.json({
        success: true,
        message: "Cập nhật phòng thành công",
      });
    } catch (error) {
      console.error("Update room error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update room",
        error: error.message,
      });
    }
  },

  // Xóa phòng (soft delete)
  deleteRoom: async (req, res) => {
    try {
      const { room_id } = req.params;
      const manager_id = req.user.user_id;

      console.log("deleteRoom called with:", { room_id });

      // Lấy thông tin phòng để kiểm tra branch_id
      const room = await executeQuery(
        `SELECT branch_id FROM branch.Rooms WHERE room_id = @room_id`,
        { room_id }
      );

      if (room.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phòng",
        });
      }

      const branch_id = room[0].branch_id;

      // KIỂM TRA QUYỀN - SỬA ĐIỀU KIỆN NÀY
      const managerCheck = await executeQuery(
        `SELECT s.staff_id 
         FROM auth.Staffs s 
         INNER JOIN auth.Users u ON s.user_id = u.user_id
         WHERE s.user_id = @manager_id AND s.branch_id = @branch_id 
         AND (u.role = 'MANAGER' OR u.role = 'ADMIN' OR s.position LIKE '%manager%' OR s.position LIKE N'%trưởng%')`,
        { manager_id, branch_id }
      );

      if (managerCheck.length === 0) {
        // Kiểm tra admin
        const adminCheck = await executeQuery(
          `SELECT user_id FROM auth.Users WHERE user_id = @manager_id AND role = 'ADMIN'`,
          { manager_id }
        );

        if (adminCheck.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Bạn không có quyền xóa phòng này",
          });
        }
      }

      // Kiểm tra xem phòng có suất chiếu nào đang hoạt động không
      const activeShowtimes = await executeQuery(
        `SELECT COUNT(*) as count FROM movie.Showtimes 
         WHERE room_id = @room_id AND status = 'ACTIVE' AND start_time > GETDATE()`,
        { room_id }
      );

      if (activeShowtimes[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: "Không thể xóa phòng đang có suất chiếu hoạt động",
        });
      }

      // Soft delete
      await executeQuery(
        `UPDATE branch.Rooms SET status = 'INACTIVE' WHERE room_id = @room_id`,
        { room_id }
      );

      res.json({
        success: true,
        message: "Xóa phòng thành công",
      });
    } catch (error) {
      console.error("Delete room error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete room",
        error: error.message,
      });
    }
  },

  // Lấy danh sách ghế của phòng
  getRoomSeats: async (req, res) => {
    try {
      const { room_id } = req.params;

      console.log("getRoomSeats called with:", { room_id });

      const seats = await executeQuery(
        `SELECT s.*, st.type_name, st.price_multiplier, st.color_code
       FROM branch.Seats s
       INNER JOIN branch.SeatTypes st ON s.seat_type_id = st.seat_type_id
       WHERE s.room_id = @room_id AND s.status = 'ACTIVE'
       ORDER BY s.seat_row, s.seat_number`,
        { room_id }
      );

      console.log(`Found ${seats.length} seats for room ${room_id}`);

      res.json({
        success: true,
        data: seats,
      });
    } catch (error) {
      console.error("Get room seats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch room seats",
        error: error.message,
      });
    }
  },

  // Cập nhật sơ đồ ghế (phiên bản đơn giản không dùng transaction)
  updateRoomSeats: async (req, res) => {
    try {
      const { room_id } = req.params;
      const { seats } = req.body;
      const manager_id = req.user.user_id;

      console.log("updateRoomSeats called with:", {
        room_id,
        seats: seats?.length,
      });

      // Lấy thông tin phòng để kiểm tra branch_id
      const room = await executeQuery(
        `SELECT branch_id FROM branch.Rooms WHERE room_id = @room_id`,
        { room_id }
      );

      if (room.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy phòng",
        });
      }

      const branch_id = room[0].branch_id;

      // Kiểm tra quyền manager
      const managerCheck = await executeQuery(
        `SELECT s.staff_id 
       FROM auth.Staffs s 
       WHERE s.user_id = @manager_id AND s.branch_id = @branch_id AND s.position LIKE '%MANAGER%'`,
        { manager_id, branch_id }
      );

      if (managerCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền cập nhật ghế của phòng này",
        });
      }

      // Xóa các ghế cũ
      await executeQuery(`DELETE FROM branch.Seats WHERE room_id = @room_id`, {
        room_id,
      });

      // Thêm các ghế mới
      for (const seat of seats) {
        await executeQuery(
          `INSERT INTO branch.Seats (room_id, seat_row, seat_number, seat_type_id, x_position, y_position)
         VALUES (@room_id, @seat_row, @seat_number, @seat_type_id, @x_position, @y_position)`,
          {
            room_id,
            seat_row: seat.seat_row,
            seat_number: seat.seat_number,
            seat_type_id: seat.seat_type_id,
            x_position: seat.x_position || null,
            y_position: seat.y_position || null,
          }
        );
      }

      // Cập nhật tổng số ghế trong phòng - SỬA LỖI Ở ĐÂY
      const total_seats = seats.length; // Đổi tên biến từ totalSeats sang total_seats
      await executeQuery(
        `UPDATE branch.Rooms SET total_seats = @total_seats WHERE room_id = @room_id`,
        { total_seats, room_id } // Sử dụng đúng tên biến
      );

      res.json({
        success: true,
        message: "Cập nhật sơ đồ ghế thành công",
        data: { total_seats },
      });
    } catch (error) {
      console.error("Update room seats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update room seats",
        error: error.message,
      });
    }
  },
  // Lấy danh sách loại ghế
  getSeatTypes: async (req, res) => {
    try {
      console.log("getSeatTypes called");

      const seatTypes = await executeQuery(
        "SELECT * FROM branch.SeatTypes ORDER BY type_name"
      );

      res.json({
        success: true,
        data: seatTypes,
      });
    } catch (error) {
      console.error("Get seat types error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch seat types",
        error: error.message,
      });
    }
  },
};

module.exports = roomController;
