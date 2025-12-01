const express = require("express");
const movieController = require("../controllers/movieController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/active", movieController.getActiveMovies);
router.get("/genres", movieController.getGenres);
router.get("/:movie_id", movieController.getMovieById);

// Protected routes
router.get(
  "/showtimes/list",
  authenticateToken,
  movieController.getShowtimesByMovie
);

// Admin/Manager routes (tạm thời chỉ dùng authenticateToken)
router.post("/", authenticateToken, movieController.createMovie);
router.put("/:movie_id", authenticateToken, movieController.updateMovie);
router.get("/admin/all", authenticateToken, movieController.getAllMovies);
router.delete("/:movie_id", authenticateToken, movieController.deleteMovie);
router.put(
  "/:movie_id/restore",
  authenticateToken,
  movieController.restoreMovie
);
router.get(
  "/:movie_id/stats",
  authenticateToken,
  movieController.getMovieStats
);
module.exports = router;
