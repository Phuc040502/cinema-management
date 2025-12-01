const express = require("express");
const branchController = require("../controllers/branchController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/", branchController.getAllBranches);
router.get("/:branch_id", branchController.getBranchById);
router.get("/:branch_id/rooms", branchController.getBranchRooms);

// Admin routes (tạm thời chỉ dùng authenticateToken)
router.post("/", authenticateToken, branchController.createBranch);

module.exports = router;
