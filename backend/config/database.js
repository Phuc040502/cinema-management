const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "CinemaManagement",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "123",
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};

let pool;

const connectDB = async () => {
  try {
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to SQL Server - CinemaManagement");
    return pool;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return pool;
};

// Helper function for executing queries
const executeQuery = async (query, params = {}) => {
  try {
    const pool = getPool();
    const request = pool.request();

    // Add parameters to request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Query execution error:", error.message);
    console.error("Query:", query);
    console.error("Params:", params);
    throw error;
  }
};

// Helper function for executing stored procedures
const executeStoredProcedure = async (procedureName, params = {}) => {
  try {
    const pool = getPool();
    const request = pool.request();

    // Add parameters to request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.execute(procedureName);
    return result.recordset;
  } catch (error) {
    console.error("Stored procedure execution error:", error.message);
    console.error("Procedure:", procedureName);
    console.error("Params:", params);
    throw error;
  }
};

// Transaction helper function
const executeTransaction = async (callback) => {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error("Transaction rollback error:", rollbackError.message);
    }
    throw error;
  }
};
// Helper function for transactions
const beginTransaction = async () => {
  try {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    return transaction;
  } catch (error) {
    console.error("Begin transaction error:", error.message);
    throw error;
  }
};

const commitTransaction = async (transaction) => {
  try {
    await transaction.commit();
  } catch (error) {
    console.error("Commit transaction error:", error.message);
    throw error;
  }
};

const rollbackTransaction = async (transaction) => {
  try {
    await transaction.rollback();
  } catch (error) {
    console.error("Rollback transaction error:", error.message);
    throw error;
  }
};

// Helper function for executing queries within transaction
const executeQueryInTransaction = async (transaction, query, params = {}) => {
  try {
    const request = new sql.Request(transaction);

    // Add parameters to request
    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Query execution in transaction error:", error.message);
    throw error;
  }
};

module.exports = {
  connectDB,
  getPool,
  executeQuery,
  executeStoredProcedure,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  executeQueryInTransaction,
  sql,
};
