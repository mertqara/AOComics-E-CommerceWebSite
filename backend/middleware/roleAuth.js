// backend/middleware/roleAuth.js
const User = require('../models/User');

// Middleware to check user role
const checkRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // req.user is set by the auth middleware (contains { id })
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: `Access denied. ${allowedRoles.join(' or ')} role required.` 
        });
      }
      
      // Attach full user object to request for convenience
      req.userRole = user.role;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

module.exports = { checkRole };