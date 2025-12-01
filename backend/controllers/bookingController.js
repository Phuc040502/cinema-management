const { executeQuery } = require("../config/database");

const bookingController = {
  // Tạo booking mới - Sử dụng direct queries
  createBooking: async (req, res) => {
    try {
      const {
        showtime_id,
        customer_email,
        customer_phone,
        customer_name,
        seat_ids,
      } = req.body;

      if (
        !showtime_id ||
        !customer_email ||
        !seat_ids ||
        !Array.isArray(seat_ids)
      ) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID, customer email, and seat IDs are required",
        });
      }

      // Generate booking ID và reference
      const booking_id = "BK" + Date.now();
      const booking_reference =
        "CINE-" + Math.random().toString(36).substr(2, 8).toUpperCase();

      // Lấy thông tin suất chiếu
      const showtime = await executeQuery(
        `SELECT branch_id, movie_id, room_id, base_price 
         FROM movie.Showtimes 
         WHERE showtime_id = @showtime_id`,
        { showtime_id }
      );

      if (showtime.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Showtime not found",
        });
      }

      const { branch_id, movie_id, room_id, base_price } = showtime[0];

      // Kiểm tra ghế available
      const seatCheckQuery = `
        SELECT ss.seat_id 
        FROM movie.ShowtimeSeats ss
        WHERE ss.showtime_id = @showtime_id 
          AND ss.seat_id IN (${seat_ids
            .map((_, i) => `@seat_id_${i}`)
            .join(", ")})
          AND ss.status != 'AVAILABLE'
      `;

      const seatCheckParams = {
        showtime_id,
        ...seat_ids.reduce((acc, seatId, index) => {
          acc[`seat_id_${index}`] = seatId;
          return acc;
        }, {}),
      };

      const unavailableSeats = await executeQuery(
        seatCheckQuery,
        seatCheckParams
      );

      if (unavailableSeats.length > 0) {
        return res.status(400).json({
          success: false,
          message: "One or more seats are not available",
        });
      }

      // Tính tổng tiền
      const seatPriceQuery = `
        SELECT SUM(@base_price * st.price_multiplier) as total_amount, COUNT(*) as ticket_quantity
        FROM branch.Seats s
        INNER JOIN branch.SeatTypes st ON s.seat_type_id = st.seat_type_id
        WHERE s.seat_id IN (${seat_ids
          .map((_, i) => `@seat_id_${i}`)
          .join(", ")})
      `;

      const seatPrices = await executeQuery(seatPriceQuery, {
        base_price,
        ...seat_ids.reduce((acc, seatId, index) => {
          acc[`seat_id_${index}`] = seatId;
          return acc;
        }, {}),
      });

      const { total_amount, ticket_quantity } = seatPrices[0];

      // Tạo booking
      await executeQuery(
        `INSERT INTO booking.Bookings (
          booking_id, showtime_id, branch_id, customer_email, customer_phone, customer_name,
          total_amount, final_amount, ticket_quantity, booking_reference, status, expires_at
        ) VALUES (
          @booking_id, @showtime_id, @branch_id, @customer_email, @customer_phone, @customer_name,
          @total_amount, @total_amount, @ticket_quantity, @booking_reference, 'PENDING', DATEADD(MINUTE, 15, GETDATE())
        )`,
        {
          booking_id,
          showtime_id,
          branch_id,
          customer_email,
          customer_phone: customer_phone || null,
          customer_name: customer_name || null,
          total_amount,
          ticket_quantity,
          booking_reference,
        }
      );

      // Lấy thông tin ghế để tạo tickets
      const seatDetailsQuery = `
        SELECT s.seat_id, s.seat_row, s.seat_number, s.seat_type_id, st.price_multiplier
        FROM branch.Seats s
        INNER JOIN branch.SeatTypes st ON s.seat_type_id = st.seat_type_id
        WHERE s.seat_id IN (${seat_ids
          .map((_, i) => `@seat_id_${i}`)
          .join(", ")})
      `;

      const seatDetails = await executeQuery(seatDetailsQuery, {
        ...seat_ids.reduce((acc, seatId, index) => {
          acc[`seat_id_${index}`] = seatId;
          return acc;
        }, {}),
      });

      const tickets = [];

      // Tạo từng ticket
      for (const seat of seatDetails) {
        const ticket_number =
          "TICKET-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const unit_price = base_price * seat.price_multiplier;

        await executeQuery(
          `INSERT INTO ticket.Tickets (
            ticket_number, booking_id, showtime_id, branch_id, seat_id,
            seat_number, seat_type, unit_price, final_price,
            customer_email, customer_name, qr_code_data, status
          ) VALUES (
            @ticket_number, @booking_id, @showtime_id, @branch_id, @seat_id,
            @seat_number, @seat_type, @unit_price, @unit_price,
            @customer_email, @customer_name, @qr_code_data, 'RESERVED'
          )`,
          {
            ticket_number,
            booking_id,
            showtime_id,
            branch_id,
            seat_id: seat.seat_id,
            seat_number: `${seat.seat_row}${seat.seat_number}`,
            seat_type: seat.seat_type_id,
            unit_price,
            customer_email,
            customer_name: customer_name || null,
            qr_code_data: `QR-${booking_reference}-${seat.seat_id}`,
          }
        );

        tickets.push({
          ticket_number,
          seat_number: `${seat.seat_row}${seat.seat_number}`,
          seat_type: seat.seat_type_id,
          unit_price,
        });
      }

      // Cập nhật trạng thái ghế
      const updateSeatsQuery = `
        UPDATE movie.ShowtimeSeats 
        SET status = 'RESERVED', booking_id = @booking_id, locked_until = DATEADD(MINUTE, 15, GETDATE())
        WHERE showtime_id = @showtime_id 
          AND seat_id IN (${seat_ids.map((_, i) => `@seat_id_${i}`).join(", ")})
      `;

      await executeQuery(updateSeatsQuery, {
        showtime_id,
        booking_id,
        ...seat_ids.reduce((acc, seatId, index) => {
          acc[`seat_id_${index}`] = seatId;
          return acc;
        }, {}),
      });

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: {
          booking_id,
          booking_reference,
          total_amount,
          ticket_quantity,
          tickets,
        },
      });
    } catch (error) {
      console.error("Create booking error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to create booking",
        error: error.message,
      });
    }
  },

  // Lấy thông tin booking
  getBookingById: async (req, res) => {
    try {
      const { booking_id } = req.params;

      const booking = await executeQuery(
        `SELECT b.*, s.start_time, s.end_time, m.title as movie_title,
                br.branch_name, r.room_name
         FROM booking.Bookings b
         INNER JOIN movie.Showtimes s ON b.showtime_id = s.showtime_id
         INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
         INNER JOIN branch.Branches br ON b.branch_id = br.branch_id
         INNER JOIN branch.Rooms r ON s.room_id = r.room_id
         WHERE b.booking_id = @booking_id`,
        { booking_id }
      );

      if (booking.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const tickets = await executeQuery(
        `SELECT t.*, s.seat_row, s.seat_number, st.type_name as seat_type_name
         FROM ticket.Tickets t
         INNER JOIN branch.Seats s ON t.seat_id = s.seat_id
         INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
         WHERE t.booking_id = @booking_id`,
        { booking_id }
      );

      res.json({
        success: true,
        data: {
          ...booking[0],
          tickets,
        },
      });
    } catch (error) {
      console.error("Get booking error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch booking details",
        error: error.message,
      });
    }
  },

  // Lấy booking theo reference
  getBookingByReference: async (req, res) => {
    try {
      const { reference } = req.params;

      const booking = await executeQuery(
        `SELECT b.*, s.start_time, s.end_time, m.title as movie_title,
                br.branch_name, r.room_name
         FROM booking.Bookings b
         INNER JOIN movie.Showtimes s ON b.showtime_id = s.showtime_id
         INNER JOIN movie.Movies m ON s.movie_id = m.movie_id
         INNER JOIN branch.Branches br ON b.branch_id = br.branch_id
         INNER JOIN branch.Rooms r ON s.room_id = r.room_id
         WHERE b.booking_reference = @reference`,
        { reference }
      );

      if (booking.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const tickets = await executeQuery(
        `SELECT t.*, s.seat_row, s.seat_number, st.type_name as seat_type_name
         FROM ticket.Tickets t
         INNER JOIN branch.Seats s ON t.seat_id = s.seat_id
         INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
         WHERE t.booking_id = @booking_id`,
        { booking_id: booking[0].booking_id }
      );

      res.json({
        success: true,
        data: {
          ...booking[0],
          tickets,
        },
      });
    } catch (error) {
      console.error("Get booking by reference error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch booking",
        error: error.message,
      });
    }
  },

  // Hủy booking
  cancelBooking: async (req, res) => {
    try {
      const { booking_id } = req.params;

      const booking = await executeQuery(
        "SELECT status FROM booking.Bookings WHERE booking_id = @booking_id",
        { booking_id }
      );

      if (booking.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      if (booking[0].status === "CANCELLED") {
        return res.status(400).json({
          success: false,
          message: "Booking is already cancelled",
        });
      }

      // Update booking status
      await executeQuery(
        "UPDATE booking.Bookings SET status = 'CANCELLED', updated_at = GETDATE() WHERE booking_id = @booking_id",
        { booking_id }
      );

      // Update ticket status
      await executeQuery(
        "UPDATE ticket.Tickets SET status = 'CANCELLED', updated_at = GETDATE() WHERE booking_id = @booking_id",
        { booking_id }
      );

      // Free up seats
      await executeQuery(
        `UPDATE movie.ShowtimeSeats 
         SET status = 'AVAILABLE', booking_id = NULL, locked_until = NULL 
         WHERE booking_id = @booking_id`,
        { booking_id }
      );

      res.json({
        success: true,
        message: "Booking cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel booking error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to cancel booking",
        error: error.message,
      });
    }
  },
};

module.exports = bookingController;
