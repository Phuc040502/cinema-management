const {
  executeQuery,
  executeStoredProcedure,
  executeTransaction,
  sql,
} = require("../config/database");

const checkinController = {
  // Soát vé - Check in
  checkinTicket: async (req, res) => {
    try {
      const { ticket_number } = req.body;
      const checked_in_by = req.user.username;

      console.log("Checkin request:", { ticket_number, checked_in_by });

      if (!ticket_number) {
        return res.status(400).json({
          success: false,
          message: "Ticket number is required",
        });
      }

      let result;

      // Thử sử dụng stored procedure trước
      try {
        console.log("Attempting to use stored procedure...");
        result = await executeStoredProcedure("ticket.sp_CheckinTicket", {
          ticket_number,
          checked_in_by,
        });
        console.log("Stored procedure result:", result);
      } catch (spError) {
        console.log(
          "Stored procedure failed, using direct query:",
          spError.message
        );
        // Fallback: Sử dụng direct query với transaction
        result = [await checkinWithDirectQuery(ticket_number, checked_in_by)];
      }

      if (!result || result.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Check-in failed - no result returned",
        });
      }

      res.json({
        success: true,
        message: "Ticket checked in successfully",
        data: result[0],
      });
    } catch (error) {
      console.error("Checkin ticket error:", error.message);

      // Handle specific error cases
      if (error.message.includes("already checked in")) {
        return res.status(409).json({
          success: false,
          message: "Ticket already checked in",
        });
      }

      if (error.message.includes("cannot be checked in")) {
        return res.status(400).json({
          success: false,
          message: "Ticket cannot be checked in (invalid status)",
        });
      }

      if (error.message.includes("Check-in is only allowed")) {
        return res.status(400).json({
          success: false,
          message:
            "Check-in is only allowed 30 minutes before and after showtime",
        });
      }

      if (error.message.includes("Ticket not found")) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Check-in failed",
        error: error.message,
      });
    }
  },

  // Lấy lịch sử soát vé
  getCheckinHistory: async (req, res) => {
    try {
      const { branch_id, date, action_by, page = 1, limit = 20 } = req.query;

      console.log("Get checkin history request:", {
        branch_id,
        date,
        action_by,
        page,
        limit,
      });

      let query = `
        SELECT 
          ch.history_id,
          ch.ticket_id,
          ch.ticket_number,
          ch.action,
          ch.old_status,
          ch.new_status,
          ch.action_by,
          ch.action_timestamp,
          ch.device_info,
          ch.ip_address,
          ch.notes,
          t.seat_number,
          t.customer_name,
          t.customer_email,
          m.title as movie_title,
          s.start_time,
          r.room_name,
          b.branch_name,
          b.branch_id
        FROM ticket.CheckinHistory ch
        INNER JOIN ticket.Tickets t ON ch.ticket_id = t.ticket_id
        INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
        INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
        INNER JOIN branch.Rooms r ON s.room_id = r.room_id
        INNER JOIN branch.Branches b ON t.branch_id = b.branch_id
        WHERE 1=1
      `;

      const params = {};
      const offset = (parseInt(page) - 1) * parseInt(limit);

      if (branch_id) {
        query += " AND t.branch_id = @branch_id";
        params.branch_id = branch_id;
      }

      if (date) {
        query += " AND CAST(ch.action_timestamp AS DATE) = @date";
        params.date = date;
      }

      if (action_by) {
        query += " AND ch.action_by LIKE @action_by";
        params.action_by = `%${action_by}%`;
      }

      // Count total records for pagination
      const countQuery = `SELECT COUNT(*) as total_count FROM (${query}) as subquery`;
      const countResult = await executeQuery(countQuery, params);
      const totalCount = countResult[0].total_count;

      // Add ordering and pagination
      query += " ORDER BY ch.action_timestamp DESC";
      query += " OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";
      params.offset = offset;
      params.limit = parseInt(limit);

      const history = await executeQuery(query, params);

      res.json({
        success: true,
        data: {
          history,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total_count: totalCount,
            total_pages: Math.ceil(totalCount / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get checkin history error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch checkin history",
        error: error.message,
      });
    }
  },

  // Thống kê soát vé theo ngày
  getCheckinStats: async (req, res) => {
    try {
      const { branch_id, date, period = "daily" } = req.query;
      const targetDate = date || new Date().toISOString().split("T")[0];

      console.log("Get checkin stats request:", { branch_id, date, period });

      let dateCondition = "CAST(ch.action_timestamp AS DATE) = @date";
      let groupBy = "CAST(ch.action_timestamp AS DATE)";

      if (period === "weekly") {
        dateCondition = "ch.action_timestamp >= DATEADD(DAY, -7, GETDATE())";
        groupBy =
          "DATEPART(WEEK, ch.action_timestamp), DATEPART(YEAR, ch.action_timestamp)";
      } else if (period === "monthly") {
        dateCondition = "ch.action_timestamp >= DATEADD(MONTH, -1, GETDATE())";
        groupBy =
          "DATEPART(MONTH, ch.action_timestamp), DATEPART(YEAR, ch.action_timestamp)";
      }

      const statsQuery = `
        SELECT 
          ${
            period === "daily"
              ? "@date as stats_date"
              : period === "weekly"
              ? "MIN(CAST(ch.action_timestamp AS DATE)) as week_start, MAX(CAST(ch.action_timestamp AS DATE)) as week_end"
              : "DATEPART(MONTH, ch.action_timestamp) as month_number, DATEPART(YEAR, ch.action_timestamp) as year"
          }
          COUNT(*) as total_checkins,
          COUNT(DISTINCT ch.action_by) as staff_count,
          COUNT(DISTINCT t.movie_id) as unique_movies,
          COUNT(DISTINCT t.branch_id) as unique_branches,
          MIN(ch.action_timestamp) as first_checkin,
          MAX(ch.action_timestamp) as last_checkin,
          AVG(DATEDIFF(MINUTE, s.start_time, ch.action_timestamp)) as avg_checkin_time_from_showtime
        FROM ticket.CheckinHistory ch
        INNER JOIN ticket.Tickets t ON ch.ticket_id = t.ticket_id
        INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
        WHERE ${dateCondition}
        ${branch_id ? " AND t.branch_id = @branch_id" : ""}
        GROUP BY ${groupBy}
      `;

      const params = { date: targetDate };
      if (branch_id) {
        params.branch_id = branch_id;
      }

      const stats = await executeQuery(statsQuery, params);

      // Get checkins by hour for daily period
      let hourlyStats = [];
      if (period === "daily") {
        const hourlyQuery = `
          SELECT 
            DATEPART(HOUR, ch.action_timestamp) as hour,
            COUNT(*) as checkin_count
          FROM ticket.CheckinHistory ch
          INNER JOIN ticket.Tickets t ON ch.ticket_id = t.ticket_id
          WHERE CAST(ch.action_timestamp AS DATE) = @date
          ${branch_id ? " AND t.branch_id = @branch_id" : ""}
          GROUP BY DATEPART(HOUR, ch.action_timestamp)
          ORDER BY hour
        `;

        hourlyStats = await executeQuery(hourlyQuery, params);
      }

      // Get top movies for the period
      const topMoviesQuery = `
        SELECT 
          m.movie_id,
          m.title,
          COUNT(*) as checkin_count
        FROM ticket.CheckinHistory ch
        INNER JOIN ticket.Tickets t ON ch.ticket_id = t.ticket_id
        INNER JOIN movie.Movies m ON t.movie_id = m.movie_id
        WHERE ${dateCondition}
        ${branch_id ? " AND t.branch_id = @branch_id" : ""}
        GROUP BY m.movie_id, m.title
        ORDER BY checkin_count DESC
      `;

      const topMovies = await executeQuery(topMoviesQuery, params);

      // Get staff performance
      const staffPerformanceQuery = `
        SELECT 
          ch.action_by as staff_name,
          COUNT(*) as checkin_count,
          MIN(ch.action_timestamp) as first_checkin,
          MAX(ch.action_timestamp) as last_checkin
        FROM ticket.CheckinHistory ch
        INNER JOIN ticket.Tickets t ON ch.ticket_id = t.ticket_id
        WHERE ${dateCondition}
        ${branch_id ? " AND t.branch_id = @branch_id" : ""}
        GROUP BY ch.action_by
        ORDER BY checkin_count DESC
      `;

      const staffPerformance = await executeQuery(
        staffPerformanceQuery,
        params
      );

      const result = stats[0] || {
        total_checkins: 0,
        staff_count: 0,
        unique_movies: 0,
        unique_branches: 0,
        first_checkin: null,
        last_checkin: null,
        avg_checkin_time_from_showtime: null,
      };

      res.json({
        success: true,
        data: {
          period: {
            type: period,
            date: targetDate,
            ...(period === "weekly" && result.week_start
              ? {
                  week_start: result.week_start,
                  week_end: result.week_end,
                }
              : {}),
            ...(period === "monthly" && result.month_number
              ? {
                  month: result.month_number,
                  year: result.year,
                }
              : {}),
          },
          summary: result,
          hourly_stats: hourlyStats,
          top_movies: topMovies.slice(0, 5),
          staff_performance: staffPerformance,
        },
      });
    } catch (error) {
      console.error("Get checkin stats error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch checkin statistics",
        error: error.message,
      });
    }
  },

  // Lấy thông tin chi tiết của một ticket
  getTicketDetails: async (req, res) => {
    try {
      const { ticket_number } = req.params;

      console.log("Get ticket details request:", { ticket_number });

      if (!ticket_number) {
        return res.status(400).json({
          success: false,
          message: "Ticket number is required",
        });
      }

      const query = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.booking_id,
          t.showtime_id,
          t.branch_id,
          t.seat_id,
          t.seat_number,
          t.seat_type,
          t.unit_price,
          t.final_price,
          t.customer_email,
          t.customer_name,
          t.status,
          t.checked_in,
          t.checked_in_at,
          t.checked_in_by,
          t.created_at,
          t.updated_at,
          s.start_time,
          s.end_time,
          s.base_price,
          m.movie_id,
          m.title as movie_title,
          m.duration,
          m.genre_id,
          g.genre_name,
          b.branch_name,
          b.branch_code,
          r.room_name,
          r.room_code,
          st.type_name as seat_type_name,
          st.price_multiplier,
          ss.status as seat_status,
          bh.action as last_action,
          bh.action_timestamp as last_action_time,
          bh.action_by as last_action_by
        FROM ticket.Tickets t
        INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
        INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
        INNER JOIN movie.Genres g ON m.genre_id = g.genre_id
        INNER JOIN branch.Branches b ON t.branch_id = b.branch_id
        INNER JOIN branch.Rooms r ON s.room_id = r.room_id
        INNER JOIN branch.Seats se ON t.seat_id = se.seat_id
        INNER JOIN branch.SeatTypes st ON se.seat_type_id = st.seat_type_id
        INNER JOIN movie.ShowtimeSeats ss ON t.showtime_id = ss.showtime_id AND t.seat_id = ss.seat_id
        LEFT JOIN (
          SELECT 
            ticket_id, 
            action, 
            action_timestamp, 
            action_by,
            ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY action_timestamp DESC) as rn
          FROM ticket.CheckinHistory
        ) bh ON t.ticket_id = bh.ticket_id AND bh.rn = 1
        WHERE t.ticket_number = @ticket_number
      `;

      const ticket = await executeQuery(query, { ticket_number });

      if (ticket.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      // Lấy lịch sử checkin của ticket này
      const historyQuery = `
        SELECT 
          history_id,
          action,
          old_status,
          new_status,
          action_by,
          action_timestamp,
          device_info,
          ip_address,
          notes
        FROM ticket.CheckinHistory
        WHERE ticket_id = @ticket_id
        ORDER BY action_timestamp DESC
      `;

      const history = await executeQuery(historyQuery, {
        ticket_id: ticket[0].ticket_id,
      });

      res.json({
        success: true,
        data: {
          ticket: ticket[0],
          history,
        },
      });
    } catch (error) {
      console.error("Get ticket details error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch ticket details",
        error: error.message,
      });
    }
  },

  // API health check cho checkin - Phiên bản minimal
  healthCheck: async (req, res) => {
    try {
      // Test connection với query cực kỳ đơn giản
      await executeQuery("SELECT 1");

      res.json({
        success: true,
        data: {
          service: "Checkin Service",
          status: "operational",
          database: "connected",
          timestamp: new Date().toISOString(),
          endpoints: {
            "POST /checkin": "Check in a ticket",
            "GET /checkin/history": "Get checkin history",
            "GET /checkin/stats": "Get checkin statistics",
            "GET /checkin/ticket/:ticket_number": "Get ticket details",
          },
        },
      });
    } catch (error) {
      console.error("Health check error:", error.message);
      res.status(500).json({
        success: false,
        service: "Checkin Service",
        status: "degraded",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

// Helper function: Checkin với direct query sử dụng transaction
async function checkinWithDirectQuery(ticket_number, checked_in_by) {
  return await executeTransaction(async (transaction) => {
    console.log("Starting direct query checkin for ticket:", ticket_number);

    // Lấy thông tin ticket
    const ticketRequest = new sql.Request(transaction);
    ticketRequest.input("ticket_number", sql.VarChar, ticket_number);
    const ticketResult = await ticketRequest.query(
      `SELECT t.ticket_id, t.status, t.showtime_id, s.start_time, t.customer_name, t.seat_number
       FROM ticket.Tickets t
       INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
       WHERE t.ticket_number = @ticket_number`
    );

    if (ticketResult.recordset.length === 0) {
      throw new Error("Ticket not found");
    }

    const ticketData = ticketResult.recordset[0];
    const current_status = ticketData.status;
    const start_time = new Date(ticketData.start_time);

    console.log("Ticket found:", {
      ticket_id: ticketData.ticket_id,
      status: current_status,
      start_time: start_time,
      customer_name: ticketData.customer_name,
      seat_number: ticketData.seat_number,
    });

    // Kiểm tra trạng thái ticket
    if (current_status === "USED") {
      throw new Error("Ticket already checked in");
    }

    if (current_status !== "CONFIRMED") {
      throw new Error(
        `Ticket cannot be checked in (invalid status: ${current_status})`
      );
    }

    // Kiểm tra thời gian soát vé
    const now = new Date();
    const minTime = new Date(start_time.getTime() - 30 * 60000); // 30 phút trước
    const maxTime = new Date(start_time.getTime() + 30 * 60000); // 30 phút sau

    console.log("Time validation:", {
      now: now,
      start_time: start_time,
      min_time: minTime,
      max_time: maxTime,
      is_too_early: now < minTime,
      is_too_late: now > maxTime,
    });

    if (now < minTime) {
      const minutesEarly = Math.round((minTime - now) / 60000);
      throw new Error(
        `Check-in is only allowed 30 minutes before showtime. Please come back in ${minutesEarly} minutes.`
      );
    }

    if (now > maxTime) {
      const minutesLate = Math.round((now - maxTime) / 60000);
      throw new Error(
        `Check-in window has expired. Showtime started ${minutesLate} minutes ago.`
      );
    }

    // Cập nhật trạng thái ticket
    const updateRequest = new sql.Request(transaction);
    updateRequest.input("ticket_id", sql.BigInt, ticketData.ticket_id);
    updateRequest.input("checked_in_by", sql.VarChar, checked_in_by);
    await updateRequest.query(
      `UPDATE ticket.Tickets 
       SET status = 'USED', checked_in = 1, checked_in_at = GETDATE(), 
           checked_in_by = @checked_in_by, updated_at = GETDATE()
       WHERE ticket_id = @ticket_id`
    );

    console.log("Ticket status updated to USED");

    // Ghi lịch sử check-in
    const historyRequest = new sql.Request(transaction);
    historyRequest.input("ticket_id", sql.BigInt, ticketData.ticket_id);
    historyRequest.input("ticket_number", sql.VarChar, ticket_number);
    historyRequest.input("old_status", sql.VarChar, current_status);
    historyRequest.input("action_by", sql.VarChar, checked_in_by);
    await historyRequest.query(
      `INSERT INTO ticket.CheckinHistory (ticket_id, ticket_number, action, old_status, new_status, action_by)
       VALUES (@ticket_id, @ticket_number, 'CHECK_IN', @old_status, 'USED', @action_by)`
    );

    console.log("Checkin history recorded");

    // Lấy thông tin ticket đã check-in để trả về
    const resultRequest = new sql.Request(transaction);
    resultRequest.input("ticket_id", sql.BigInt, ticketData.ticket_id);
    const checkedInTicket = await resultRequest.query(
      `SELECT 
        t.ticket_id,
        t.ticket_number,
        t.seat_number,
        t.seat_type,
        m.title as movie_title,
        r.room_name,
        s.start_time,
        t.customer_name,
        t.checked_in_at,
        b.branch_name
       FROM ticket.Tickets t
       INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
       INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
       INNER JOIN branch.Rooms r ON s.room_id = r.room_id
       INNER JOIN branch.Branches b ON t.branch_id = b.branch_id
       WHERE t.ticket_id = @ticket_id`
    );

    console.log("Checkin completed successfully");

    return checkedInTicket.recordset[0];
  });
}

// Export middleware để kiểm tra quyền staff
checkinController.requireStaff = (req, res, next) => {
  const userRole = req.user?.role;
  if (!userRole || !["STAFF", "MANAGER", "ADMIN"].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Staff role required.",
    });
  }
  next();
};

module.exports = checkinController;
