const express = require("express");
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");

const router = express.Router();

// Tất cả routes đều yêu cầu admin
router.use(authenticateToken, requireAdmin);

// User management routes
router.get("/users", adminController.getAllUsers);
router.get("/users/stats", adminController.getUserStats);
router.get("/users/search", adminController.searchUsers);
router.get("/users/:user_id", adminController.getUserDetail);
router.post("/users", adminController.createUser);
router.put("/users/:user_id", adminController.updateUser);
router.delete("/users/:user_id", adminController.deleteUser);

module.exports = router;
