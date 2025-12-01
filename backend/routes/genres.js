const express = require("express");
const genreController = require("../controllers/genreController");
const { authenticateToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");

const router = express.Router();

// Public routes
router.get("/", genreController.getAllGenres);
router.get("/stats", genreController.getGenreStats);
router.get("/:genre_id", genreController.getGenreById);

// Admin routes
router.post("/", authenticateToken, requireAdmin, genreController.createGenre);
router.put(
  "/:genre_id",
  authenticateToken,
  requireAdmin,
  genreController.updateGenre
);
router.delete(
  "/:genre_id",
  authenticateToken,
  requireAdmin,
  genreController.deleteGenre
);

module.exports = router;
