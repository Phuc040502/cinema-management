const { executeQuery } = require("../config/database");

const revenueController = {
  // Báo cáo doanh thu theo chi nhánh
  getBranchRevenue: async (req, res) => {
    try {
      const { start_date, end_date, branch_id } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      let query = `
        SELECT * FROM report.DailyBranchRevenue 
        WHERE revenue_date BETWEEN @start_date AND @end_date
      `;

      const params = { start_date, end_date };

      if (branch_id) {
        query += " AND branch_id = @branch_id";
        params.branch_id = branch_id;
      }

      query += " ORDER BY revenue_date, branch_id";

      const revenue = await executeQuery(query, params);

      // Calculate totals
      const totals = revenue.reduce(
        (acc, curr) => ({
          total_revenue: acc.total_revenue + (curr.total_revenue || 0),
          total_tickets_sold:
            acc.total_tickets_sold + (curr.total_tickets_sold || 0),
          total_bookings: acc.total_bookings + (curr.total_bookings || 0),
          net_revenue: acc.net_revenue + (curr.net_revenue || 0),
        }),
        {
          total_revenue: 0,
          total_tickets_sold: 0,
          total_bookings: 0,
          net_revenue: 0,
        }
      );

      res.json({
        success: true,
        data: {
          period: { start_date, end_date },
          summary: totals,
          daily_data: revenue,
        },
      });
    } catch (error) {
      console.error("Get branch revenue error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch revenue data",
        error: error.message,
      });
    }
  },

  // Báo cáo doanh thu theo phim
  getMovieRevenue: async (req, res) => {
    try {
      const { start_date, end_date, branch_id } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      let query = `
        SELECT dmr.*, m.title, m.genre_id, g.genre_name, b.branch_name
        FROM report.DailyMovieRevenue dmr
        INNER JOIN movie.Movies m ON dmr.movie_id = m.movie_id
        INNER JOIN movie.Genres g ON m.genre_id = g.genre_id
        INNER JOIN branch.Branches b ON dmr.branch_id = b.branch_id
        WHERE dmr.revenue_date BETWEEN @start_date AND @end_date
      `;

      const params = { start_date, end_date };

      if (branch_id) {
        query += " AND dmr.branch_id = @branch_id";
        params.branch_id = branch_id;
      }

      query += " ORDER BY dmr.revenue_date, dmr.total_revenue DESC";

      const revenue = await executeQuery(query, params);

      // Calculate movie totals
      const movieTotals = {};
      revenue.forEach((item) => {
        if (!movieTotals[item.movie_id]) {
          movieTotals[item.movie_id] = {
            movie_id: item.movie_id,
            title: item.title,
            total_revenue: 0,
            total_tickets_sold: 0,
            total_showtimes: 0,
          };
        }
        movieTotals[item.movie_id].total_revenue += item.total_revenue;
        movieTotals[item.movie_id].total_tickets_sold +=
          item.total_tickets_sold;
        movieTotals[item.movie_id].total_showtimes += item.total_showtimes;
      });

      const movieSummary = Object.values(movieTotals).sort(
        (a, b) => b.total_revenue - a.total_revenue
      );

      res.json({
        success: true,
        data: {
          period: { start_date, end_date },
          summary: movieSummary,
          daily_data: revenue,
        },
      });
    } catch (error) {
      console.error("Get movie revenue error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch movie revenue data",
        error: error.message,
      });
    }
  },

  // Thống kê tổng quan
  getDashboardStats: async (req, res) => {
    try {
      const { branch_id } = req.query;
      const today = new Date().toISOString().split("T")[0];

      // Today's revenue
      const todayRevenue = await executeQuery(
        `SELECT 
          SUM(total_revenue) as today_revenue,
          SUM(total_tickets_sold) as today_tickets,
          SUM(total_bookings) as today_bookings
         FROM report.DailyBranchRevenue 
         WHERE revenue_date = @today
         ${branch_id ? " AND branch_id = @branch_id" : ""}`,
        { today, ...(branch_id && { branch_id }) }
      );

      // Monthly revenue
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyRevenue = await executeQuery(
        `SELECT 
          SUM(total_revenue) as monthly_revenue,
          SUM(total_tickets_sold) as monthly_tickets
         FROM report.DailyBranchRevenue 
         WHERE revenue_date LIKE @month_pattern
         ${branch_id ? " AND branch_id = @branch_id" : ""}`,
        {
          month_pattern: `${currentMonth}%`,
          ...(branch_id && { branch_id }),
        }
      );

      // Active movies count
      const activeMovies = await executeQuery(
        `SELECT COUNT(*) as active_movies 
         FROM movie.Movies 
         WHERE status = 'ACTIVE' AND release_date <= GETDATE() AND end_date >= GETDATE()`
      );

      // Total branches
      const totalBranches = await executeQuery(
        `SELECT COUNT(*) as total_branches 
         FROM branch.Branches 
         WHERE status = 'ACTIVE'
         ${branch_id ? " AND branch_id = @branch_id" : ""}`,
        branch_id ? { branch_id } : {}
      );

      res.json({
        success: true,
        data: {
          today: todayRevenue[0] || {
            today_revenue: 0,
            today_tickets: 0,
            today_bookings: 0,
          },
          monthly: monthlyRevenue[0] || {
            monthly_revenue: 0,
            monthly_tickets: 0,
          },
          active_movies: activeMovies[0]?.active_movies || 0,
          total_branches: totalBranches[0]?.total_branches || 0,
        },
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics",
        error: error.message,
      });
    }
  },
};

module.exports = revenueController;
