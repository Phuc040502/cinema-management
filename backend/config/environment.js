require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || "cinema_secret_key_2024",
  bookingTimeout: 15 * 60 * 1000, // 15 minutes
  qrCodeBaseUrl:
    process.env.QR_CODE_BASE_URL || "http://localhost:3000/api/tickets/verify",
};
