const express = require("express");
const paymentController = require("../controllers/paymentController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.get("/methods", authenticateToken, paymentController.getPaymentMethods);
router.post("/confirm", authenticateToken, paymentController.confirmPayment);
router.get(
  "/booking/:booking_id",
  authenticateToken,
  paymentController.getPaymentByBookingId
);

module.exports = router;
