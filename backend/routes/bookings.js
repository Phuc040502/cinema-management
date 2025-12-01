const express = require("express");
const bookingController = require("../controllers/bookingController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Root endpoint
router.get("/", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Bookings API is working",
    endpoints: {
      "POST /": "Create new booking",
      "GET /:booking_id": "Get booking by ID",
      "GET /reference/:reference": "Get booking by reference",
      "PUT /:booking_id/cancel": "Cancel booking",
    },
  });
});

router.post("/", authenticateToken, bookingController.createBooking);
router.get("/:booking_id", authenticateToken, bookingController.getBookingById);
router.get(
  "/reference/:reference",
  authenticateToken,
  bookingController.getBookingByReference
);
router.put(
  "/:booking_id/cancel",
  authenticateToken,
  bookingController.cancelBooking
);

module.exports = router;
