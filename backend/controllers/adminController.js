const { executeQuery } = require("../config/database");
const bcrypt = require("bcryptjs");

const adminController = {
  // Lấy danh sách tất cả người dùng với phân trang
  getAllUsers: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        role = "",
        is_active = "",
      } = req.query;

      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          u.user_id, u.username, u.email, u.full_name, u.phone, 
          u.date_of_birth, u.role, u.is_active, u.email_verified,
          u.last_login, u.created_at, u.updated_at,
          s.staff_id, s.branch_id, s.position, s.employee_code, s.department,
          b.branch_name
        FROM auth.Users u
        LEFT JOIN auth.Staffs s ON u.user_id = s.user_id
        LEFT JOIN branch.Branches b ON s.branch_id = b.branch_id
        WHERE 1=1
      `;

      let countQuery = `
        SELECT COUNT(*) as total
        FROM auth.Users u
        WHERE 1=1
      `;

      const params = {};
      const countParams = {};

      if (search) {
        query += ` AND (u.username LIKE @search OR u.email LIKE @search OR u.full_name LIKE @search)`;
        countQuery += ` AND (u.username LIKE @search OR u.email LIKE @search OR u.full_name LIKE @search)`;
        params.search = `%${search}%`;
        countParams.search = `%${search}%`;
      }

      if (role) {
        query += ` AND u.role = @role`;
        countQuery += ` AND u.role = @role`;
        params.role = role;
        countParams.role = role;
      }

      if (is_active !== "") {
        query += ` AND u.is_active = @is_active`;
        countQuery += ` AND u.is_active = @is_active`;
        params.is_active = parseInt(is_active);
        countParams.is_active = parseInt(is_active);
      }

      query += ` ORDER BY u.created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
      params.offset = offset;
      params.limit = parseInt(limit);

      const users = await executeQuery(query, params);
      const totalResult = await executeQuery(countQuery, countParams);
      const total = totalResult[0]?.total || 0;

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Get all users error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
        error: error.message,
      });
    }
  },

  // Lấy chi tiết người dùng
  getUserDetail: async (req, res) => {
    try {
      const { user_id } = req.params;

      const user = await executeQuery(
        `SELECT 
          u.user_id, u.username, u.email, u.full_name, u.phone, 
          u.date_of_birth, u.role, u.is_active, u.email_verified,
          u.last_login, u.created_at, u.updated_at,
          s.staff_id, s.branch_id, s.position, s.employee_code, 
          s.department, s.start_date, s.end_date, s.is_active as staff_active,
          b.branch_name
        FROM auth.Users u
        LEFT JOIN auth.Staffs s ON u.user_id = s.user_id
        LEFT JOIN branch.Branches b ON s.branch_id = b.branch_id
        WHERE u.user_id = @user_id`,
        { user_id }
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: user[0],
      });
    } catch (error) {
      console.error("Get user detail error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user details",
        error: error.message,
      });
    }
  },

  // Tạo người dùng mới
  createUser: async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        full_name,
        phone,
        date_of_birth,
        role,
        is_active = true,
        email_verified = false,
        branch_id,
        position,
        employee_code,
        department,
      } = req.body;

      // Validate required fields
      if (!username || !email || !password || !full_name || !role) {
        return res.status(400).json({
          success: false,
          message:
            "Username, email, password, full name, and role are required",
        });
      }

      // Check if user already exists
      const existingUser = await executeQuery(
        `SELECT user_id FROM auth.Users WHERE username = @username OR email = @email`,
        { username, email }
      );

      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Username or email already exists",
        });
      }

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await executeQuery(
        `INSERT INTO auth.Users (
          username, email, password_hash, full_name, phone, date_of_birth,
          role, is_active, email_verified
        ) OUTPUT INSERTED.user_id
        VALUES (
          @username, @email, @password_hash, @full_name, @phone, @date_of_birth,
          @role, @is_active, @email_verified
        )`,
        {
          username,
          email,
          password_hash,
          full_name,
          phone: phone || null,
          date_of_birth: date_of_birth || null,
          role,
          is_active: is_active ? 1 : 0,
          email_verified: email_verified ? 1 : 0,
        }
      );

      const userId = result[0].user_id;

      // If user is staff or manager, create staff record
      if ((role === "STAFF" || role === "MANAGER") && branch_id) {
        await executeQuery(
          `INSERT INTO auth.Staffs (
            user_id, branch_id, position, employee_code, department
          ) VALUES (
            @user_id, @branch_id, @position, @employee_code, @department
          )`,
          {
            user_id: userId,
            branch_id,
            position: position || null,
            employee_code: employee_code || null,
            department: department || null,
          }
        );
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: { user_id: userId },
      });
    } catch (error) {
      console.error("Create user error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create user",
        error: error.message,
      });
    }
  },

  // Cập nhật người dùng
  updateUser: async (req, res) => {
    try {
      const { user_id } = req.params;
      const updates = req.body;

      // Check if user exists
      const user = await executeQuery(
        "SELECT user_id, role FROM auth.Users WHERE user_id = @user_id",
        { user_id }
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const currentUser = user[0];

      // Update user basic info
      const userFields = [
        "username",
        "email",
        "full_name",
        "phone",
        "date_of_birth",
        "role",
        "is_active",
        "email_verified",
      ];
      const userUpdates = {};
      const userParams = { user_id };

      userFields.forEach((field) => {
        if (updates[field] !== undefined) {
          if (field === "is_active" || field === "email_verified") {
            userUpdates[field] = updates[field] ? 1 : 0;
          } else {
            userUpdates[field] = updates[field];
          }
          userParams[field] = userUpdates[field];
        }
      });

      if (Object.keys(userUpdates).length > 0) {
        const setClause = Object.keys(userUpdates)
          .map((key) => `${key} = @${key}`)
          .join(", ");

        await executeQuery(
          `UPDATE auth.Users SET ${setClause}, updated_at = GETDATE() WHERE user_id = @user_id`,
          userParams
        );
      }

      // Update password if provided
      if (updates.password) {
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(updates.password, saltRounds);
        await executeQuery(
          "UPDATE auth.Users SET password_hash = @password_hash WHERE user_id = @user_id",
          { user_id, password_hash }
        );
      }

      // Handle staff info for STAFF/MANAGER roles
      if (
        currentUser.role === "STAFF" ||
        currentUser.role === "MANAGER" ||
        updates.role
      ) {
        const newRole = updates.role || currentUser.role;

        if (newRole === "STAFF" || newRole === "MANAGER") {
          const staffFields = [
            "branch_id",
            "position",
            "employee_code",
            "department",
            "is_active",
          ];
          const staffUpdates = {};
          const staffParams = { user_id };

          staffFields.forEach((field) => {
            if (updates[field] !== undefined) {
              staffUpdates[field] = updates[field];
              staffParams[field] = updates[field];
            }
          });

          // Check if staff record exists
          const existingStaff = await executeQuery(
            "SELECT staff_id FROM auth.Staffs WHERE user_id = @user_id",
            { user_id }
          );

          if (existingStaff.length > 0) {
            // Update existing staff record
            if (Object.keys(staffUpdates).length > 0) {
              const setClause = Object.keys(staffUpdates)
                .map((key) => `${key} = @${key}`)
                .join(", ");

              await executeQuery(
                `UPDATE auth.Staffs SET ${setClause} WHERE user_id = @user_id`,
                staffParams
              );
            }
          } else {
            // Create new staff record
            if (updates.branch_id) {
              await executeQuery(
                `INSERT INTO auth.Staffs (user_id, branch_id, position, employee_code, department)
                 VALUES (@user_id, @branch_id, @position, @employee_code, @department)`,
                {
                  user_id,
                  branch_id: updates.branch_id || null,
                  position: updates.position || null,
                  employee_code: updates.employee_code || null,
                  department: updates.department || null,
                }
              );
            }
          }
        } else {
          // Remove staff record if role changed from STAFF/MANAGER to CUSTOMER/ADMIN
          await executeQuery(
            "DELETE FROM auth.Staffs WHERE user_id = @user_id",
            { user_id }
          );
        }
      }

      res.json({
        success: true,
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Update user error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update user",
        error: error.message,
      });
    }
  },

  // Xóa người dùng (soft delete)
  deleteUser: async (req, res) => {
    try {
      const { user_id } = req.params;

      // Check if user exists
      const user = await executeQuery(
        "SELECT user_id FROM auth.Users WHERE user_id = @user_id",
        { user_id }
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Soft delete by setting is_active to false
      await executeQuery(
        "UPDATE auth.Users SET is_active = 0, updated_at = GETDATE() WHERE user_id = @user_id",
        { user_id }
      );

      // Also deactivate staff record if exists
      await executeQuery(
        "UPDATE auth.Staffs SET is_active = 0 WHERE user_id = @user_id",
        { user_id }
      );

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
    }
  },

  // Thống kê người dùng
  getUserStats: async (req, res) => {
    try {
      const stats = await executeQuery(`
        SELECT 
          role,
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as verified_users
        FROM auth.Users
        GROUP BY role
        ORDER BY role
      `);

      const recentUsers = await executeQuery(`
        SELECT TOP 5 
          user_id, username, email, role, created_at
        FROM auth.Users
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        data: {
          byRole: stats,
          recentUsers,
        },
      });
    } catch (error) {
      console.error("Get user stats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user statistics",
        error: error.message,
      });
    }
  },

  // Tìm kiếm người dùng
  searchUsers: async (req, res) => {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Search query is required",
        });
      }

      const users = await executeQuery(
        `SELECT 
          u.user_id, u.username, u.email, u.full_name, u.role,
          s.branch_id, b.branch_name
        FROM auth.Users u
        LEFT JOIN auth.Staffs s ON u.user_id = s.user_id
        LEFT JOIN branch.Branches b ON s.branch_id = b.branch_id
        WHERE u.username LIKE @query 
           OR u.email LIKE @query 
           OR u.full_name LIKE @query
        ORDER BY u.username`,
        { query: `%${query}%` }
      );

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Search users error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to search users",
        error: error.message,
      });
    }
  },
};

module.exports = adminController;
