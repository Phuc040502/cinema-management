const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const { connectDB } = require("./config/database");

console.log("=== STARTING SERVER WITH DEBUG ===");

// Import routes với debug chi tiết
console.log("\n📁 IMPORTING ROUTES:");

let authRoutes,
  movieRoutes,
  branchRoutes,
  showtimeRoutes,
  bookingRoutes,
  ticketRoutes,
  checkinRoutes,
  revenueRoutes,
  roomRoutes,
  genreRoutes,
  adminRoutes,
  paymentRoutes;

try {
  authRoutes = require("./routes/auth");
  console.log("✅ authRoutes imported");
} catch (error) {
  console.log("❌ authRoutes import failed:", error.message);
}

try {
  movieRoutes = require("./routes/movies");
  console.log("✅ movieRoutes imported");
} catch (error) {
  console.log("❌ movieRoutes import failed:", error.message);
}

try {
  branchRoutes = require("./routes/branches");
  console.log("✅ branchRoutes imported");
} catch (error) {
  console.log("❌ branchRoutes import failed:", error.message);
}

try {
  showtimeRoutes = require("./routes/showtimes");
  console.log("✅ showtimeRoutes imported");
} catch (error) {
  console.log("❌ showtimeRoutes import failed:", error.message);
}

try {
  bookingRoutes = require("./routes/bookings");
  console.log("✅ bookingRoutes imported");
} catch (error) {
  console.log("❌ bookingRoutes import failed:", error.message);
}

try {
  ticketRoutes = require("./routes/tickets");
  console.log("✅ ticketRoutes imported");
} catch (error) {
  console.log("❌ ticketRoutes import failed:", error.message);
}

try {
  checkinRoutes = require("./routes/checkin");
  console.log("✅ checkinRoutes imported");
} catch (error) {
  console.log("❌ checkinRoutes import failed:", error.message);
}

try {
  revenueRoutes = require("./routes/revenue");
  console.log("✅ revenueRoutes imported");
} catch (error) {
  console.log("❌ revenueRoutes import failed:", error.message);
}

try {
  roomRoutes = require("./routes/rooms");
  console.log("✅ roomRoutes imported");
} catch (error) {
  console.log("❌ roomRoutes import failed:", error.message);
}
try {
  genreRoutes = require("./routes/genres");
  console.log("✅ genreRoutes imported");
} catch (error) {
  console.log("❌ genreRoutes import failed:", error.message);
}
try {
  adminRoutes = require("./routes/admin");
  console.log("✅ adminRoutes imported");
} catch (error) {
  console.log("❌ adminRoutes import failed:", error.message);
}
try {
  paymentRoutes = require("./routes/payments");
  console.log("✅ paymentRoutes imported");
} catch (error) {
  console.log("❌ paymentRoutes import failed:", error.message);
}
const app = express();

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`🏁 ${req.method} ${req.path}`);
  next();
});

// Routes với error handling
console.log("\n🔗 MOUNTING ROUTES:");

if (authRoutes) {
  app.use("/api/auth", authRoutes);
  console.log("✅ /api/auth mounted");
}

if (movieRoutes) {
  app.use("/api/movies", movieRoutes);
  console.log("✅ /api/movies mounted");
}

if (branchRoutes) {
  app.use("/api/branches", branchRoutes);
  console.log("✅ /api/branches mounted");
}

if (showtimeRoutes) {
  app.use("/api/showtimes", showtimeRoutes);
  console.log("✅ /api/showtimes mounted");
}

if (bookingRoutes) {
  app.use("/api/bookings", bookingRoutes);
  console.log("✅ /api/bookings mounted");
}

if (ticketRoutes) {
  app.use("/api/tickets", ticketRoutes);
  console.log("✅ /api/tickets mounted");
}

if (checkinRoutes) {
  app.use("/api/checkin", checkinRoutes);
  console.log("✅ /api/checkin mounted");
}

if (revenueRoutes) {
  app.use("/api/revenue", revenueRoutes);
  console.log("✅ /api/revenue mounted");
}

if (roomRoutes) {
  app.use("/api/rooms", roomRoutes);
  console.log("✅ /api/rooms mounted");
}
if (genreRoutes) {
  app.use("/api/genres", genreRoutes);
  console.log("✅ /api/genres mounted");
}
if (adminRoutes) {
  app.use("/api/admin", adminRoutes);
  console.log("✅ /api/admin mounted");
}
if (paymentRoutes) {
  app.use("/api/payments", adminRoutes);
  console.log("✅ /api/payments mounted");
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Cinema Management API is running",
    timestamp: new Date().toISOString(),
    routes: {
      auth: !!authRoutes,
      movies: !!movieRoutes,
      branches: !!branchRoutes,
      showtimes: !!showtimeRoutes,
      bookings: !!bookingRoutes,
      tickets: !!ticketRoutes,
      checkin: !!checkinRoutes,
      revenue: !!revenueRoutes,
      room: !!roomRoutes,
      genre: !!genreRoutes,
      admin: !!adminRoutes,
      payment: !!paymentRoutes,
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ 404 - Route not found:", req.originalUrl);
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("💥 Global error handler:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});
// CORS configuration
app.use(
  cors({
    origin: "http://localhost:4200", // Angular dev server
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const PORT = process.env.PORT || 3000;

// Start server
const startServer = async () => {
  try {
    console.log("\n🚀 CONNECTING TO DATABASE...");
    await connectDB();

    app.listen(PORT, () => {
      console.log("\n🎉 SERVER STARTED SUCCESSFULLY!");
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log("\n📊 ROUTES STATUS:");
      console.log(`   ✅ /api/auth - ${authRoutes ? "Loaded" : "Failed"}`);
      console.log(`   ✅ /api/movies - ${movieRoutes ? "Loaded" : "Failed"}`);
      console.log(
        `   ✅ /api/branches - ${branchRoutes ? "Loaded" : "Failed"}`
      );
      console.log(
        `   ✅ /api/showtimes - ${showtimeRoutes ? "Loaded" : "Failed"}`
      );
      console.log(
        `   ✅ /api/bookings - ${bookingRoutes ? "Loaded" : "Failed"}`
      );
      console.log(`   ✅ /api/tickets - ${ticketRoutes ? "Loaded" : "Failed"}`);
      console.log(
        `   ✅ /api/checkin - ${checkinRoutes ? "Loaded" : "Failed"}`
      );
      console.log(
        `   ✅ /api/revenue - ${revenueRoutes ? "Loaded" : "Failed"}`
      );
      console.log(`   ✅ /api/rooms- ${roomRoutes ? "Loaded" : "Failed"}`);
      console.log(`   ✅ /api/genres - ${genreRoutes ? "Loaded" : "Failed"}`);
      console.log(`   ✅ /api/admin - ${adminRoutes ? "Loaded" : "Failed"}`);
      console.log(
        `   ✅ /api/payments - ${paymentRoutes ? "Loaded" : "Failed"}`
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
