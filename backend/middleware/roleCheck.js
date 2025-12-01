const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

// Specific role checkers
const requireAdmin = roleCheck(["ADMIN"]);
const requireManager = roleCheck(["MANAGER", "ADMIN"]);
const requireStaff = roleCheck(["STAFF", "MANAGER", "ADMIN"]);
const requireCustomer = roleCheck(["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]);

module.exports = {
  roleCheck,
  requireAdmin,
  requireManager,
  requireStaff,
  requireCustomer,
};
