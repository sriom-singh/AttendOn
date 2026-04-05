import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// protect — verifies JWT, attaches req.user
export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Verify signature + expiry — throws if invalid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Re-fetch user — catches deactivated accounts even with valid tokens
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User no longer active' });
    }

    // Attach to request — all downstream controllers use req.user
    req.user = user;
    next();

  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// restrictTo — role-based gate, used after protect
// Usage: router.delete('/:id', protect, restrictTo('admin'), deleteUser)
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  next();
};

// Example route wiring:
// router.get('/me',              protect,                  getMe);
// router.put('/me',              protect,                  updateMe);
// router.put('/change-password', protect,                  changePassword);
// router.delete('/me',           protect,                  deactivateMe);
// router.patch('/:id/reactivate',protect, restrictTo('admin'), reactivateUser);