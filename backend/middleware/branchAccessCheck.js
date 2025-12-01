const { executeQuery } = require("../config/database");

const checkBranchAccess = (resourceType = "showtime") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const userBranchId = user.branch_id;

      // Admin có quyền truy cập tất cả
      if (user.role === "ADMIN") {
        return next();
      }

      // Manager chỉ được truy cập chi nhánh của mình
      if (user.role === "MANAGER") {
        let resourceBranchId;

        if (resourceType === "showtime") {
          if (req.params.showtime_id) {
            // Kiểm tra quyền với showtime cụ thể
            const showtime = await executeQuery(
              "SELECT branch_id FROM movie.Showtimes WHERE showtime_id = @showtime_id",
              { showtime_id: req.params.showtime_id }
            );

            if (showtime.length === 0) {
              return res.status(404).json({
                success: false,
                message: "Showtime not found",
              });
            }

            resourceBranchId = showtime[0].branch_id;
          } else if (req.body.branch_id) {
            // Kiểm tra quyền với branch_id trong body
            resourceBranchId = req.body.branch_id;
          }
        }

        if (resourceBranchId && resourceBranchId !== userBranchId) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You can only manage showtimes in your own branch.",
          });
        }
      }

      next();
    } catch (error) {
      console.error("Branch access check error:", error.message);
      res.status(500).json({
        success: false,
        message: "Access verification failed",
      });
    }
  };
};

module.exports = {
  checkBranchAccess,
};
