const {
  executeQuery,
  executeStoredProcedure,
  getPool,
  sql,
} = require("../config/database");

const ticketController = {
  // Confirm ticket (chuyển từ RESERVED sang CONFIRMED)
  confirmTicket: async (req, res) => {
    let transaction;
    try {
      const { ticket_number } = req.body;
      const action_by = req.user.username;

      console.log("Confirm ticket request:", { ticket_number, action_by });

      if (!ticket_number) {
        return res.status(400).json({
          success: false,
          message: "Ticket number is required",
        });
      }

      // Sửa lỗi: Đảm bảo getPool được gọi đúng cách
      const pool = getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin();

      console.log("Transaction started for ticket confirmation");

      // Lấy thông tin ticket
      const ticketRequest = new sql.Request(transaction);
      ticketRequest.input("ticket_number", sql.VarChar, ticket_number);
      const ticketResult = await ticketRequest.query(
        `SELECT ticket_id, status, booking_id, showtime_id FROM ticket.Tickets WHERE ticket_number = @ticket_number`
      );

      if (ticketResult.recordset.length === 0) {
        await transaction.rollback();
        console.log("Ticket not found:", ticket_number);
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      const ticketData = ticketResult.recordset[0];
      console.log("Ticket found:", ticketData);

      // Kiểm tra trạng thái ticket
      if (ticketData.status !== "RESERVED") {
        await transaction.rollback();
        console.log("Invalid ticket status:", ticketData.status);
        return res.status(400).json({
          success: false,
          message: `Ticket cannot be confirmed. Current status: ${ticketData.status}`,
        });
      }

      // Cập nhật trạng thái ticket
      const updateTicketRequest = new sql.Request(transaction);
      updateTicketRequest.input("ticket_number", sql.VarChar, ticket_number);
      await updateTicketRequest.query(
        `UPDATE ticket.Tickets 
         SET status = 'CONFIRMED', updated_at = GETDATE() 
         WHERE ticket_number = @ticket_number`
      );
      console.log("Ticket status updated to CONFIRMED");

      // Cập nhật trạng thái ghế trong showtime_seats
      const updateSeatRequest = new sql.Request(transaction);
      updateSeatRequest.input("booking_id", sql.VarChar, ticketData.booking_id);
      await updateSeatRequest.query(
        `UPDATE movie.ShowtimeSeats 
         SET status = 'BOOKED', locked_until = NULL 
         WHERE booking_id = @booking_id`
      );
      console.log("Seat status updated to BOOKED");

      // Ghi lịch sử
      const historyRequest = new sql.Request(transaction);
      historyRequest.input("ticket_id", sql.BigInt, ticketData.ticket_id);
      historyRequest.input("ticket_number", sql.VarChar, ticket_number);
      historyRequest.input("old_status", sql.VarChar, "RESERVED");
      historyRequest.input("action_by", sql.VarChar, action_by);
      await historyRequest.query(
        `INSERT INTO ticket.TicketHistory (ticket_id, ticket_number, old_status, new_status, action, action_by)
         VALUES (@ticket_id, @ticket_number, @old_status, 'CONFIRMED', 'MANUAL_CONFIRM', @action_by)`
      );
      console.log("Ticket history recorded");

      await transaction.commit();
      console.log("Transaction committed successfully");

      res.json({
        success: true,
        message: "Ticket confirmed successfully",
      });
    } catch (error) {
      console.error("Confirm ticket error:", error.message);

      if (transaction) {
        try {
          await transaction.rollback();
          console.log("Transaction rolled back due to error");
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError.message);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to confirm ticket",
        error: error.message,
      });
    }
  },

  // Cancel ticket (chuyển từ RESERVED hoặc CONFIRMED sang CANCELLED)
  cancelTicket: async (req, res) => {
    let transaction;
    try {
      const { ticket_number } = req.body;
      const action_by = req.user.username;

      console.log("Cancel ticket request:", { ticket_number, action_by });

      if (!ticket_number) {
        return res.status(400).json({
          success: false,
          message: "Ticket number is required",
        });
      }

      const pool = getPool();
      transaction = new sql.Transaction(pool);

      await transaction.begin();
      console.log("Transaction started for ticket cancellation");

      // Lấy thông tin ticket
      const ticketRequest = new sql.Request(transaction);
      ticketRequest.input("ticket_number", sql.VarChar, ticket_number);
      const ticketResult = await ticketRequest.query(
        `SELECT ticket_id, status, booking_id, seat_id, showtime_id FROM ticket.Tickets WHERE ticket_number = @ticket_number`
      );

      if (ticketResult.recordset.length === 0) {
        await transaction.rollback();
        console.log("Ticket not found:", ticket_number);
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      const ticketData = ticketResult.recordset[0];
      console.log("Ticket found:", ticketData);

      // Kiểm tra trạng thái ticket
      if (
        ticketData.status !== "RESERVED" &&
        ticketData.status !== "CONFIRMED"
      ) {
        await transaction.rollback();
        console.log(
          "Invalid ticket status for cancellation:",
          ticketData.status
        );
        return res.status(400).json({
          success: false,
          message: `Ticket cannot be cancelled. Current status: ${ticketData.status}`,
        });
      }

      // Cập nhật trạng thái ticket
      const updateTicketRequest = new sql.Request(transaction);
      updateTicketRequest.input("ticket_number", sql.VarChar, ticket_number);
      await updateTicketRequest.query(
        `UPDATE ticket.Tickets 
         SET status = 'CANCELLED', updated_at = GETDATE() 
         WHERE ticket_number = @ticket_number`
      );
      console.log("Ticket status updated to CANCELLED");

      // Giải phóng ghế trong showtime_seats
      const updateSeatRequest = new sql.Request(transaction);
      updateSeatRequest.input("seat_id", sql.BigInt, ticketData.seat_id);
      updateSeatRequest.input(
        "showtime_id",
        sql.VarChar,
        ticketData.showtime_id
      );
      await updateSeatRequest.query(
        `UPDATE movie.ShowtimeSeats 
         SET status = 'AVAILABLE', booking_id = NULL, locked_until = NULL 
         WHERE seat_id = @seat_id AND showtime_id = @showtime_id`
      );
      console.log("Seat status updated to AVAILABLE");

      // Ghi lịch sử
      const historyRequest = new sql.Request(transaction);
      historyRequest.input("ticket_id", sql.BigInt, ticketData.ticket_id);
      historyRequest.input("ticket_number", sql.VarChar, ticket_number);
      historyRequest.input("old_status", sql.VarChar, ticketData.status);
      historyRequest.input("action_by", sql.VarChar, action_by);
      await historyRequest.query(
        `INSERT INTO ticket.TicketHistory (ticket_id, ticket_number, old_status, new_status, action, action_by)
         VALUES (@ticket_id, @ticket_number, @old_status, 'CANCELLED', 'MANUAL_CANCEL', @action_by)`
      );
      console.log("Ticket history recorded");

      await transaction.commit();
      console.log("Transaction committed successfully");

      res.json({
        success: true,
        message: "Ticket cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel ticket error:", error.message);

      if (transaction) {
        try {
          await transaction.rollback();
          console.log("Transaction rolled back due to error");
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError.message);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to cancel ticket",
        error: error.message,
      });
    }
  },

  // Lấy vé của khách hàng
  getCustomerTickets: async (req, res) => {
    try {
      const customer_email =
        req.user.role === "CUSTOMER"
          ? req.user.email
          : req.query.customer_email;

      if (!customer_email) {
        return res.status(400).json({
          success: false,
          message: "Customer email is required",
        });
      }

      const tickets = await executeQuery(
        `SELECT t.*, b.booking_reference, s.start_time, s.end_time,
                m.title as movie_title, br.branch_name, r.room_name,
                st.type_name as seat_type_name
         FROM ticket.Tickets t
         INNER JOIN booking.Bookings b ON t.booking_id = b.booking_id
         INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
         INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
         INNER JOIN branch.Branches br ON t.branch_id = br.branch_id
         INNER JOIN branch.Rooms r ON s.room_id = r.room_id
         INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
         WHERE t.customer_email = @customer_email
         ORDER BY b.created_at DESC`,
        { customer_email }
      );

      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      console.error("Get customer tickets error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch customer tickets",
        error: error.message,
      });
    }
  },

  // Tìm kiếm vé (cho nhân viên)
  searchTickets: async (req, res) => {
    try {
      const { search_term, branch_id, showtime_id, status } = req.query;

      let query = `
        SELECT t.*, b.booking_reference, b.customer_name, b.customer_email, b.customer_phone,
               s.start_time, m.title as movie_title, br.branch_name, r.room_name,
               st.type_name as seat_type_name
        FROM ticket.Tickets t
        INNER JOIN booking.Bookings b ON t.booking_id = b.booking_id
        INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
        INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
        INNER JOIN branch.Branches br ON t.branch_id = br.branch_id
        INNER JOIN branch.Rooms r ON s.room_id = r.room_id
        INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
        WHERE 1=1
      `;

      const params = {};

      if (search_term) {
        query += ` AND (
          t.ticket_number LIKE @search_term OR 
          b.booking_reference LIKE @search_term OR 
          b.customer_email LIKE @search_term OR 
          b.customer_phone LIKE @search_term OR 
          b.customer_name LIKE @search_term
        )`;
        params.search_term = `%${search_term}%`;
      }

      if (branch_id) {
        query += " AND t.branch_id = @branch_id";
        params.branch_id = branch_id;
      }

      if (showtime_id) {
        query += " AND t.showtime_id = @showtime_id";
        params.showtime_id = showtime_id;
      }

      if (status) {
        query += " AND t.status = @status";
        params.status = status;
      }

      query += " ORDER BY s.start_time DESC, t.ticket_id";

      const tickets = await executeQuery(query, params);

      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      console.error("Search tickets error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to search tickets",
        error: error.message,
      });
    }
  },

  // Lấy thông tin vé theo số vé
  getTicketByNumber: async (req, res) => {
    try {
      const { ticket_number } = req.params;

      console.log("Get ticket by number:", ticket_number);

      const ticket = await executeQuery(
        `SELECT t.*, b.booking_reference, s.start_time, s.end_time,
                m.title as movie_title, br.branch_name, r.room_name,
                st.type_name as seat_type_name, se.seat_row, se.seat_number
         FROM ticket.Tickets t
         INNER JOIN booking.Bookings b ON t.booking_id = b.booking_id
         INNER JOIN movie.Showtimes s ON t.showtime_id = s.showtime_id
         INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
         INNER JOIN branch.Branches br ON t.branch_id = br.branch_id
         INNER JOIN branch.Rooms r ON s.room_id = r.room_id
         INNER JOIN branch.Seats se ON t.seat_id = se.seat_id
         INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
         WHERE t.ticket_number = @ticket_number`,
        { ticket_number }
      );

      if (ticket.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      res.json({
        success: true,
        data: ticket[0],
      });
    } catch (error) {
      console.error("Get ticket error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch ticket details",
        error: error.message,
      });
    }
  },

  // Tải QR code vé (generate nếu chưa có)
  getTicketQRCode: async (req, res) => {
    try {
      const { ticket_id } = req.params;

      const ticket = await executeQuery(
        `SELECT ticket_id, ticket_number, qr_code_data 
         FROM ticket.Tickets 
         WHERE ticket_id = @ticket_id`,
        { ticket_id }
      );

      if (ticket.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      // Generate QR code data if not exists
      if (!ticket[0].qr_code_data) {
        const qrData = `CINEMA:TICKET:${ticket[0].ticket_number}:${Date.now()}`;

        await executeQuery(
          "UPDATE ticket.Tickets SET qr_code_data = @qr_data WHERE ticket_id = @ticket_id",
          {
            qr_data: qrData,
            ticket_id,
          }
        );

        res.json({
          success: true,
          data: {
            qr_code_data: qrData,
            ticket_number: ticket[0].ticket_number,
          },
        });
      } else {
        res.json({
          success: true,
          data: {
            qr_code_data: ticket[0].qr_code_data,
            ticket_number: ticket[0].ticket_number,
          },
        });
      }
    } catch (error) {
      console.error("Get ticket QR code error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to generate QR code",
        error: error.message,
      });
    }
  },
};

module.exports = ticketController;
