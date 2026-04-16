import Admin  from '../models/Admin.js';

// Step 1 — attach the Admin profile to req.admin
// Runs after protect (which sets req.user)

export const attachAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const admin = await Admin.findOne({ userId: req.user._id });

    if (!admin) {
      return res.status(403).json({ message: 'Admin profile not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Step 2 — gate by specific permission string
// Usage: router.post('/org', protect, attachAdmin, hasPermission('manage_org'), createOrg)

export const hasPermission = (permission) => (req, res, next) => {
  const { isSuperAdmin, permissions } = req.admin;

  // SuperAdmins bypass all permission checks
  if (isSuperAdmin) return next();

  // 'all' grants every permission
  if (
    permissions.includes('all') ||
    permissions.includes(permission)
  ) {
    return next();
  }

  res.status(403).json({
    message: `Missing permission: ${permission}`,
  });
};

// Convenience: superAdmin-only routes
export const superAdminOnly = (req, res, next) => {
  if (!req.admin?.isSuperAdmin) {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};