const jwt = require("jsonwebtoken");
const { executeQuery } = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "cinema_management_secret_key";

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    console.log("Auth Header:", authHeader);
    console.log("Token:", token);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded token:", decoded);

    // Verify user exists and is active - CẬP NHẬT QUERY ĐỂ LẤY BRANCH_ID
    const user = await executeQuery(
      `SELECT u.user_id, u.username, u.email, u.full_name, u.role, u.is_active,
              s.branch_id, s.position as staff_position
       FROM auth.Users u
       LEFT JOIN auth.Staffs s ON u.user_id = s.user_id
       WHERE u.user_id = @user_id AND u.is_active = 1`,
      { user_id: decoded.user_id }
    );

    if (user.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Kết hợp thông tin từ token và database
    req.user = {
      ...user[0],
      // Ưu tiên branch_id từ token, nếu không có thì từ database
      branch_id: decoded.branch_id || user[0].branch_id,
    };

    console.log("Final user object:", req.user);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(403).json({
      success: false,
      message: "Invalid token",
    });
  }
};

const generateToken = (user) => {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
  };

  // Thêm branch_id vào token nếu user là staff/manager
  if (user.branch_id) {
    payload.branch_id = user.branch_id;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
};

module.exports = {
  authenticateToken,
  generateToken,
  JWT_SECRET,
};
