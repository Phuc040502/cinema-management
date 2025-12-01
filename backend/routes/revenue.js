const express = require("express");
const revenueController = require("../controllers/revenueController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Root endpoint
router.get("/", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Revenue API is working",
    endpoints: {
      "GET /branch": "Get branch revenue",
      "GET /movie": "Get movie revenue",
      "GET /dashboard": "Get dashboard stats",
    },
  });
});

router.get("/branch", authenticateToken, revenueController.getBranchRevenue);
router.get("/movie", authenticateToken, revenueController.getMovieRevenue);
router.get(
  "/dashboard",
  authenticateToken,
  revenueController.getDashboardStats
);

module.exports = router;
