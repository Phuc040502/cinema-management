const express = require("express");
const showtimeController = require("../controllers/showtimeController");
const { authenticateToken } = require("../middleware/auth");
const { requireManager } = require("../middleware/roleCheck");
const { checkBranchAccess } = require("../middleware/branchAccessCheck");

const router = express.Router();

// Public routes
router.get("/seats", authenticateToken, showtimeController.getShowtimeSeats);

// Manager routes - Quản lý suất chiếu
router.get(
  "/branch/:branch_id/rooms",
  authenticateToken,
  requireManager,
  showtimeController.getRoomsByBranch
);

// THÊM ROUTE NÀY - Route bị thiếu gây lỗi 404
router.get(
  "/branch/:branch_id",
  authenticateToken,
  requireManager, // Thêm requireManager để bảo mật
  showtimeController.getShowtimesByBranch
);

router.get(
  "/:showtime_id",
  authenticateToken,
  requireManager,
  showtimeController.getShowtimeDetail
);
router.post(
  "/",
  authenticateToken,
  requireManager,
  checkBranchAccess(),
  showtimeController.createShowtime
);
router.put(
  "/:showtime_id",
  authenticateToken,
  requireManager,
  checkBranchAccess(),
  showtimeController.updateShowtime
);
router.delete(
  "/:showtime_id",
  authenticateToken,
  requireManager,
  checkBranchAccess(),
  showtimeController.deleteShowtime
);

module.exports = router;
