const express = require("express");
const roomController = require("../controllers/roomController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Debug route - kiểm tra quyền manager
router.get(
  "/debug/manager-check/:branch_id",
  authenticateToken,
  async (req, res) => {
    try {
      const { branch_id } = req.params;
      const manager_id = req.user.user_id;

      console.log("Debug manager check:", { manager_id, branch_id });

      // Kiểm tra user role
      const userRole = await executeQuery(
        "SELECT role FROM auth.Users WHERE user_id = @manager_id",
        { manager_id }
      );

      // Kiểm tra staff position
      const staffCheck = await executeQuery(
        `SELECT staff_id, position FROM auth.Staffs 
       WHERE user_id = @manager_id AND branch_id = @branch_id`,
        { manager_id, branch_id }
      );

      res.json({
        success: true,
        data: {
          user_role: userRole[0]?.role,
          staff_info: staffCheck[0] || "No staff record found",
          manager_id,
          branch_id,
        },
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({
        success: false,
        message: "Debug failed",
        error: error.message,
      });
    }
  }
);

// Manager routes - chỉ manager của chi nhánh mới được thao tác
router.get(
  "/branch/:branch_id",
  authenticateToken,
  roomController.getRoomsByBranch
);
router.post("/", authenticateToken, roomController.createRoom);
router.put("/:room_id", authenticateToken, roomController.updateRoom);
router.delete("/:room_id", authenticateToken, roomController.deleteRoom);

// Routes cho quản lý ghế
router.get("/:room_id/seats", authenticateToken, roomController.getRoomSeats);
router.put(
  "/:room_id/seats",
  authenticateToken,
  roomController.updateRoomSeats
);

// Public route
router.get("/seat-types", roomController.getSeatTypes);

module.exports = router;
