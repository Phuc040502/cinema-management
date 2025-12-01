const { executeQuery } = require("../config/database");

const branchController = {
  // Lấy danh sách chi nhánh
  getAllBranches: async (req, res) => {
    try {
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

  // Lấy thông tin chi tiết chi nhánh
  getBranchById: async (req, res) => {
    try {
      const { branch_id } = req.params;

      const branch = await executeQuery(
        `SELECT b.*, u.full_name as manager_name 
         FROM branch.Branches b 
         LEFT JOIN auth.Staffs s ON b.manager_id = s.staff_id 
         LEFT JOIN auth.Users u ON s.user_id = u.user_id 
         WHERE b.branch_id = @branch_id`,
        { branch_id }
      );

      if (branch.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Branch not found",
        });
      }

      res.json({
        success: true,
        data: branch[0],
      });
    } catch (error) {
      console.error("Get branch error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch branch details",
        error: error.message,
      });
    }
  },

  // Lấy danh sách phòng chiếu theo chi nhánh
  getBranchRooms: async (req, res) => {
    try {
      const { branch_id } = req.params;

      // SỬA LỖI: Sử dụng dấu nháy đơn 'ACTIVE'
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
      console.error("Get branch rooms error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch branch rooms",
        error: error.message,
      });
    }
  },

  // Tạo chi nhánh mới (Admin)
  createBranch: async (req, res) => {
    try {
      const {
        branch_id,
        branch_code,
        branch_name,
        address,
        city,
        district,
        phone,
        email,
        opening_time,
        closing_time,
        facilities,
        manager_id,
      } = req.body;

      if (!branch_id || !branch_code || !branch_name || !address) {
        return res.status(400).json({
          success: false,
          message: "Branch ID, code, name, and address are required",
        });
      }

      await executeQuery(
        `INSERT INTO branch.Branches (
          branch_id, branch_code, branch_name, address, city, district,
          phone, email, opening_time, closing_time, facilities, manager_id
        ) VALUES (
          @branch_id, @branch_code, @branch_name, @address, @city, @district,
          @phone, @email, @opening_time, @closing_time, @facilities, @manager_id
        )`,
        {
          branch_id,
          branch_code,
          branch_name,
          address,
          city: city || null,
          district: district || null,
          phone: phone || null,
          email: email || null,
          opening_time: opening_time || null,
          closing_time: closing_time || null,
          facilities: facilities ? JSON.stringify(facilities) : null,
          manager_id: manager_id || null,
        }
      );

      res.status(201).json({
        success: true,
        message: "Branch created successfully",
        data: { branch_id },
      });
    } catch (error) {
      console.error("Create branch error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create branch",
        error: error.message,
      });
    }
  },
};

module.exports = branchController;
