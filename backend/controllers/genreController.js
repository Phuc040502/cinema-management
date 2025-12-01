const { executeQuery } = require("../config/database");

const genreController = {
  // Lấy danh sách tất cả thể loại
  getAllGenres: async (req, res) => {
    try {
      const genres = await executeQuery(
        "SELECT * FROM movie.Genres ORDER BY genre_name"
      );

      res.json({
        success: true,
        data: genres,
      });
    } catch (error) {
      console.error("Get all genres error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch genres",
        error: error.message,
      });
    }
  },

  // Lấy thông tin thể loại theo ID
  getGenreById: async (req, res) => {
    try {
      const { genre_id } = req.params;

      const genre = await executeQuery(
        "SELECT * FROM movie.Genres WHERE genre_id = @genre_id",
        { genre_id }
      );

      if (genre.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Genre not found",
        });
      }

      res.json({
        success: true,
        data: genre[0],
      });
    } catch (error) {
      console.error("Get genre by ID error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch genre",
        error: error.message,
      });
    }
  },

  // Tạo thể loại mới
  createGenre: async (req, res) => {
    try {
      const { genre_id, genre_name, description } = req.body;

      if (!genre_id || !genre_name) {
        return res.status(400).json({
          success: false,
          message: "Genre ID and name are required",
        });
      }

      // Check if genre already exists
      const existingGenre = await executeQuery(
        "SELECT genre_id FROM movie.Genres WHERE genre_id = @genre_id",
        { genre_id }
      );

      if (existingGenre.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Genre ID already exists",
        });
      }

      await executeQuery(
        `INSERT INTO movie.Genres (genre_id, genre_name, description)
         VALUES (@genre_id, @genre_name, @description)`,
        {
          genre_id,
          genre_name,
          description: description || null,
        }
      );

      res.status(201).json({
        success: true,
        message: "Genre created successfully",
        data: { genre_id },
      });
    } catch (error) {
      console.error("Create genre error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create genre",
        error: error.message,
      });
    }
  },

  // Cập nhật thể loại - SỬA LỖI Ở ĐÂY
  updateGenre: async (req, res) => {
    try {
      const { genre_id } = req.params;
      const { genre_name, description } = req.body;

      if (!genre_name) {
        return res.status(400).json({
          success: false,
          message: "Genre name is required",
        });
      }

      // Kiểm tra xem thể loại có tồn tại không
      const existingGenre = await executeQuery(
        "SELECT genre_id FROM movie.Genres WHERE genre_id = @genre_id",
        { genre_id }
      );

      if (existingGenre.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Genre not found",
        });
      }

      // Thực hiện update
      await executeQuery(
        `UPDATE movie.Genres 
         SET genre_name = @genre_name, description = @description 
         WHERE genre_id = @genre_id`,
        {
          genre_id,
          genre_name,
          description: description || null,
        }
      );

      res.json({
        success: true,
        message: "Genre updated successfully",
      });
    } catch (error) {
      console.error("Update genre error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to update genre",
        error: error.message,
      });
    }
  },

  // Xóa thể loại - SỬA LỖI Ở ĐÂY
  deleteGenre: async (req, res) => {
    try {
      const { genre_id } = req.params;

      // Kiểm tra xem thể loại có tồn tại không
      const existingGenre = await executeQuery(
        "SELECT genre_id FROM movie.Genres WHERE genre_id = @genre_id",
        { genre_id }
      );

      if (existingGenre.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Genre not found",
        });
      }

      // Check if there are movies using this genre
      const moviesUsingGenre = await executeQuery(
        "SELECT COUNT(*) as movie_count FROM movie.Movies WHERE genre_id = @genre_id",
        { genre_id }
      );

      if (moviesUsingGenre[0].movie_count > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete genre. There are movies associated with this genre.",
        });
      }

      await executeQuery(
        "DELETE FROM movie.Genres WHERE genre_id = @genre_id",
        { genre_id }
      );

      res.json({
        success: true,
        message: "Genre deleted successfully",
      });
    } catch (error) {
      console.error("Delete genre error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to delete genre",
        error: error.message,
      });
    }
  },

  // Thống kê thể loại
  getGenreStats: async (req, res) => {
    try {
      const stats = await executeQuery(
        `SELECT 
          g.genre_id,
          g.genre_name,
          COUNT(m.movie_id) as movie_count,
          SUM(COALESCE(m.total_revenue, 0)) as total_revenue,
          SUM(COALESCE(m.total_tickets_sold, 0)) as total_tickets
         FROM movie.Genres g
         LEFT JOIN movie.Movies m ON g.genre_id = m.genre_id
         GROUP BY g.genre_id, g.genre_name
         ORDER BY total_revenue DESC`
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get genre stats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch genre statistics",
        error: error.message,
      });
    }
  },
};

module.exports = genreController;
