const fs = require("fs");
const path = require("path");

const controllersDir = path.join(__dirname, "controllers");
const routesDir = path.join(__dirname, "routes");

console.log("=== DEBUGGING ALL CONTROLLERS AND ROUTES ===\n");

// Danh sách controllers cần kiểm tra
const controllers = [
  "authController",
  "movieController",
  "branchController",
  "showtimeController",
  "bookingController",
  "ticketController",
  "checkinController",
  "revenueController",
];

// Kiểm tra từng controller
controllers.forEach((controllerName) => {
  try {
    const controllerPath = `./controllers/${controllerName}`;
    const controller = require(controllerPath);

    console.log(`✅ ${controllerName}:`, Object.keys(controller));

    // Kiểm tra các method có phải là function không
    Object.keys(controller).forEach((method) => {
      if (typeof controller[method] !== "function") {
        console.log(
          `   ❌ ${method}: NOT A FUNCTION (${typeof controller[method]})`
        );
      } else {
        console.log(`   ✅ ${method}: function`);
      }
    });
  } catch (error) {
    console.log(`❌ ${controllerName}: ERROR - ${error.message}`);
  }
});

console.log("\n=== CHECKING ROUTE IMPORTS ===\n");

// Kiểm tra routes
const routes = [
  "auth",
  "movies",
  "branches",
  "showtimes",
  "bookings",
  "tickets",
  "checkin",
  "revenue",
];

routes.forEach((routeName) => {
  try {
    const routePath = `./routes/${routeName}`;
    const route = require(routePath);

    console.log(`✅ routes/${routeName}.js: imported successfully`);
  } catch (error) {
    console.log(`❌ routes/${routeName}.js: ERROR - ${error.message}`);
  }
});
