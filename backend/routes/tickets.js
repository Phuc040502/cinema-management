const express = require("express");
const ticketController = require("../controllers/ticketController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Root endpoint
router.get("/", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Tickets API is working",
    endpoints: {
      "GET /customer": "Get customer tickets",
      "GET /search": "Search tickets",
      "GET /number/:ticket_number": "Get ticket by number",
      "GET /:ticket_id/qrcode": "Get ticket QR code",
    },
  });
});

router.get("/customer", authenticateToken, ticketController.getCustomerTickets);
router.get("/search", authenticateToken, ticketController.searchTickets);
router.get(
  "/number/:ticket_number",
  authenticateToken,
  ticketController.getTicketByNumber
);
router.get(
  "/:ticket_id/qrcode",
  authenticateToken,
  ticketController.getTicketQRCode
);
router.post("/confirm", authenticateToken, ticketController.confirmTicket);
router.post("/cancel", authenticateToken, ticketController.cancelTicket);

module.exports = router;
