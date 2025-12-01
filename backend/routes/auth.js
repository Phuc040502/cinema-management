const express = require("express");
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Root endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Auth API is working",
    endpoints: {
      "POST /register": "Register new user",
      "POST /login": "User login",
      "GET /me": "Get current user info",
      "PUT /change-password": "Change password",
    },
  });
});

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/me", authenticateToken, authController.getCurrentUser);
router.put(
  "/change-password",
  authenticateToken,
  authController.changePassword
);
// Thêm route này
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Lấy thêm thông tin branch nếu có
    if (user.branch_id) {
      const branchInfo = await executeQuery(
        "SELECT branch_name, branch_code FROM branch.Branches WHERE branch_id = @branch_id",
        { branch_id: user.branch_id }
      );

      user.branch_info = branchInfo[0] || null;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});

module.exports = router;
