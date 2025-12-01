const http = require("http");

const BASE_URL = "http://localhost:3000";
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

const endpoints = [
  { method: "GET", path: "/health", auth: false },
  { method: "GET", path: "/api/auth", auth: false },
  {
    method: "POST",
    path: "/api/auth/register",
    auth: false,
    data: {
      username: "testuser" + Date.now(),
      email: "test" + Date.now() + "@example.com",
      password: "password123",
      full_name: "Test User",
    },
  },
  { method: "GET", path: "/api/movies/active", auth: false },
  { method: "GET", path: "/api/branches", auth: false },
  { method: "GET", path: "/api/movies/genres", auth: false },
  { method: "GET", path: "/api/showtimes", auth: true },
  { method: "GET", path: "/api/bookings", auth: true },
  { method: "GET", path: "/api/tickets", auth: true },
  { method: "GET", path: "/api/checkin", auth: true },
  { method: "GET", path: "/api/revenue", auth: true },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServerReady() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request("http://localhost:3000/health", (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });

        req.on("error", reject);
        req.setTimeout(5000, () => reject(new Error("Timeout")));
        req.end();
      });

      console.log("✅ Server is ready!");
      return true;
    } catch (error) {
      console.log(
        `⏳ Server not ready (attempt ${i + 1}/${MAX_RETRIES}): ${
          error.message
        }`
      );
      if (i < MAX_RETRIES - 1) {
        await wait(RETRY_DELAY);
      }
    }
  }

  console.log("❌ Server did not become ready in time");
  return false;
}

function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    };

    if (endpoint.auth) {
      options.headers["Authorization"] = "Bearer fake-token-for-test";
    }

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(
              `✅ ${endpoint.method} ${endpoint.path} - Status: ${res.statusCode}`
            );
          } else {
            console.log(
              `⚠️ ${endpoint.method} ${endpoint.path} - Status: ${res.statusCode}`
            );
            if (parsedData.message) {
              console.log(`   Message: ${parsedData.message}`);
            }
          }
          resolve({ statusCode: res.statusCode, data: parsedData });
        } catch (e) {
          console.log(
            `❌ ${endpoint.method} ${endpoint.path} - JSON Parse Error: ${e.message}`
          );
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on("error", (error) => {
      console.log(
        `❌ ${endpoint.method} ${endpoint.path} - Error: ${error.message}`
      );
      reject(error);
    });

    req.on("timeout", () => {
      console.log(`❌ ${endpoint.method} ${endpoint.path} - Timeout`);
      req.destroy();
      reject(new Error("Timeout"));
    });

    if (endpoint.data) {
      req.write(JSON.stringify(endpoint.data));
    }

    req.end();
  });
}

async function runTests() {
  console.log("🚀 Waiting for server to be ready...\n");

  const isReady = await checkServerReady();
  if (!isReady) {
    console.log("❌ Cannot run tests - server not available");
    return;
  }

  console.log("\n🧪 Starting API tests...\n");

  let successCount = 0;
  let totalCount = 0;

  for (const endpoint of endpoints) {
    totalCount++;
    try {
      await testEndpoint(endpoint);
      successCount++;
      // Delay giữa các request
      await wait(500);
    } catch (error) {
      console.log(`❌ Failed to test ${endpoint.method} ${endpoint.path}`);
    }
  }

  console.log(
    `\n📋 Test completed: ${successCount}/${totalCount} endpoints successful`
  );
}

runTests();
