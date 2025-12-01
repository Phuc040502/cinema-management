const express = require("express");

console.log("Loading checkinController...");
const checkinController = require("../controllers/checkinController");
console.log("checkinController loaded:", typeof checkinController);
console.log("checkinController methods:", Object.keys(checkinController));

const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.log("Checkin route:", req.method, req.path);
  next();
});

// Health check endpoint
router.get("/health", checkinController.healthCheck);

// Route GET chính cho /api/checkin - trả về trang checkin chính
router.get(
  "/",
  authenticateToken,
  checkinController.requireStaff,
  (req, res) => {
    res.json({
      success: true,
      message: "Checkin endpoint is working",
      user: {
        username: req.user.username,
        role: req.user.role,
      },
      endpoints: {
        "POST /": "Check in a ticket",
        "GET /history": "Get checkin history",
        "GET /stats": "Get checkin statistics",
        "GET /ticket/:ticket_number": "Get ticket details",
        "GET /health": "Service health check",
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// Đảm bảo các function tồn tại trước khi sử dụng
if (typeof checkinController.checkinTicket === "function") {
  router.post(
    "/",
    authenticateToken,
    checkinController.requireStaff,
    checkinController.checkinTicket
  );
} else {
  console.error("❌ checkinController.checkinTicket is not a function");
}

if (typeof checkinController.getCheckinHistory === "function") {
  router.get(
    "/history",
    authenticateToken,
    checkinController.requireStaff,
    checkinController.getCheckinHistory
  );
} else {
  console.error("❌ checkinController.getCheckinHistory is not a function");
}

if (typeof checkinController.getCheckinStats === "function") {
  router.get(
    "/stats",
    authenticateToken,
    checkinController.requireStaff,
    checkinController.getCheckinStats
  );
} else {
  console.error("❌ checkinController.getCheckinStats is not a function");
}

if (typeof checkinController.getTicketDetails === "function") {
  router.get(
    "/ticket/:ticket_number",
    authenticateToken,
    checkinController.requireStaff,
    checkinController.getTicketDetails
  );
} else {
  console.error("❌ checkinController.getTicketDetails is not a function");
}

console.log("Checkin routes configured successfully");

module.exports = router;
