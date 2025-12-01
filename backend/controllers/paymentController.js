const { executeQuery, executeStoredProcedure } = require("../config/database");

const paymentController = {
  // Xử lý thanh toán và cập nhật trạng thái
  confirmPayment: async (req, res) => {
    try {
      const { booking_id, payment_method, paid_amount } = req.body;

      if (!booking_id || !payment_method || !paid_amount) {
        return res.status(400).json({
          success: false,
          message: "Booking ID, payment method, and paid amount are required",
        });
      }

      // 1. Kiểm tra booking tồn tại
      const booking = await executeQuery(
        `SELECT b.*, s.showtime_id, s.branch_id 
         FROM booking.Bookings b
         INNER JOIN movie.Showtimes s ON b.showtime_id = s.showtime_id
         WHERE b.booking_id = @booking_id AND b.status = 'PENDING'`,
        { booking_id }
      );

      if (booking.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Booking not found or already processed",
        });
      }

      const bookingInfo = booking[0];

      // 2. Tạo payment record
      const payment_id = `PAY${Date.now()}${Math.random()
        .toString(36)
        .substr(2, 5)}`;

      const paymentResult = await executeQuery(
        `INSERT INTO payment.Payments (
          payment_id, booking_id, amount, final_amount, payment_method, 
          payment_status, paid_amount, paid_at
        ) VALUES (
          @payment_id, @booking_id, @amount, @final_amount, @payment_method, 
          'SUCCESS', @paid_amount, GETDATE()
        )`,
        {
          payment_id,
          booking_id,
          amount: bookingInfo.total_amount,
          final_amount: paid_amount,
          payment_method,
          paid_amount,
        }
      );

      // 3. Cập nhật trạng thái booking sang CONFIRMED
      await executeQuery(
        `UPDATE booking.Bookings 
         SET status = 'CONFIRMED', updated_at = GETDATE()
         WHERE booking_id = @booking_id`,
        { booking_id }
      );

      // 4. Cập nhật trạng thái tickets sang CONFIRMED
      await executeQuery(
        `UPDATE ticket.Tickets 
         SET status = 'CONFIRMED', updated_at = GETDATE()
         WHERE booking_id = @booking_id`,
        { booking_id }
      );

      // 5. Cập nhật trạng thái ghế sang BOOKED
      await executeQuery(
        `UPDATE movie.ShowtimeSeats 
         SET status = 'BOOKED', locked_until = NULL
         WHERE booking_id = @booking_id`,
        { booking_id }
      );

      // 6. Cập nhật số ghế đã đặt trong showtime
      const tickets = await executeQuery(
        `SELECT COUNT(*) as ticket_count 
         FROM ticket.Tickets 
         WHERE booking_id = @booking_id`,
        { booking_id }
      );

      await executeQuery(
        `UPDATE movie.Showtimes 
         SET booked_seats = booked_seats + @ticket_count,
             available_seats = available_seats - @ticket_count,
             updated_at = GETDATE()
         WHERE showtime_id = @showtime_id`,
        {
          ticket_count: tickets[0].ticket_count,
          showtime_id: bookingInfo.showtime_id,
        }
      );

      // 7. Lấy thông tin tickets đã xác nhận
      const confirmedTickets = await executeQuery(
        `SELECT t.*, s.seat_row, s.seat_number, st.type_name as seat_type_name
         FROM ticket.Tickets t
         INNER JOIN branch.Seats s ON t.seat_id = s.seat_id
         INNER JOIN branch.SeatTypes st ON t.seat_type = st.seat_type_id
         WHERE t.booking_id = @booking_id`,
        { booking_id }
      );

      // 8. Lấy thông tin booking đầy đủ
      const bookingDetails = await executeQuery(
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

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        data: {
          payment_id,
          booking: bookingDetails[0],
          tickets: confirmedTickets,
        },
      });
    } catch (error) {
      console.error("Confirm payment error:", error.message);
      res.status(500).json({
        success: false,
        message: "Payment confirmation failed",
        error: error.message,
      });
    }
  },

  // Lấy danh sách phương thức thanh toán
  getPaymentMethods: async (req, res) => {
    try {
      const methods = await executeQuery(
        "SELECT * FROM payment.PaymentMethods WHERE is_active = 1 ORDER BY method_name"
      );

      res.json({
        success: true,
        data: methods,
      });
    } catch (error) {
      console.error("Get payment methods error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment methods",
        error: error.message,
      });
    }
  },

  // Lấy thông tin payment theo booking_id
  getPaymentByBookingId: async (req, res) => {
    try {
      const { booking_id } = req.params;

      const payment = await executeQuery(
        `SELECT p.*, b.booking_reference, b.customer_name, b.total_amount
         FROM payment.Payments p
         INNER JOIN booking.Bookings b ON p.booking_id = b.booking_id
         WHERE p.booking_id = @booking_id`,
        { booking_id }
      );

      if (payment.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      res.json({
        success: true,
        data: payment[0],
      });
    } catch (error) {
      console.error("Get payment error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment details",
        error: error.message,
      });
    }
  },
};

module.exports = paymentController;
