const bcrypt = require("bcryptjs");
const { executeQuery, executeStoredProcedure } = require("../config/database");
const { generateToken } = require("../middleware/auth");

const authController = {
  // Đăng nhập
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      const user = await executeQuery(
        `SELECT u.user_id, u.username, u.email, u.full_name, u.role, u.password_hash,
          s.branch_id, s.position as staff_position
   FROM auth.Users u
   LEFT JOIN auth.Staffs s ON u.user_id = s.user_id
   WHERE u.username = @username AND u.is_active = 1`,
        { username }
      );

      if (user.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user[0].password_hash
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      // Remove password hash from response
      const { password_hash, ...userWithoutPassword } = user[0];

      // Generate JWT token
      const token = generateToken(userWithoutPassword);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          token,
        },
      });
    } catch (error) {
      console.error("Login error:", error.message);
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: error.message,
      });
    }
  },

  // Đăng ký tài khoản
  register: async (req, res) => {
    try {
      const { username, email, password, full_name, phone, date_of_birth } =
        req.body;

      // Validate required fields
      if (!username || !email || !password || !full_name) {
        return res.status(400).json({
          success: false,
          message: "Username, email, password, and full name are required",
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

      // Create new user
      const result = await executeQuery(
        `INSERT INTO auth.Users (username, email, password_hash, full_name, phone, date_of_birth, role)
         OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.email, INSERTED.full_name, INSERTED.role
         VALUES (@username, @email, @password_hash, @full_name, @phone, @date_of_birth, 'CUSTOMER')`,
        {
          username,
          email,
          password_hash,
          full_name,
          phone: phone || null,
          date_of_birth: date_of_birth || null,
        }
      );

      const newUser = result[0];
      const token = generateToken(newUser);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: newUser,
          token,
        },
      });
    } catch (error) {
      console.error("Registration error:", error.message);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message,
      });
    }
  },

  // Lấy thông tin user hiện tại
  getCurrentUser: async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      console.error("Get current user error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to get user information",
        error: error.message,
      });
    }
  },

  // Đổi mật khẩu
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.user_id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      // Get current password hash
      const user = await executeQuery(
        "SELECT password_hash FROM auth.Users WHERE user_id = @user_id",
        { user_id: userId }
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(
        currentPassword,
        user[0].password_hash
      );
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await executeQuery(
        "UPDATE auth.Users SET password_hash = @password_hash, updated_at = GETDATE() WHERE user_id = @user_id",
        {
          password_hash: newPasswordHash,
          user_id: userId,
        }
      );

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error.message,
      });
    }
  },
};

// Đảm bảo export đúng
module.exports = authController;
