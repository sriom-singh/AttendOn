// controllers/adminController.js
import Admin  from "../models/Admin.js";
import User  from "../models/User.js";
import Student  from "../models/Student.js";
import Staff  from "../models/Staff.js";
import mongoose  from 'mongoose';

const VALID_PERMISSIONS = [
  "manage_org",
  "manage_dept",
  "manage_courses",
  "manage_users",
  "all",
];

export const updatePermissions = async (req, res) => {
  try {
    const { permissions, isSuperAdmin } = req.body;

    // Validate every permission string against the known enum
    if (permissions) {
      const invalid = permissions.filter((p) => !VALID_PERMISSIONS.includes(p));
      if (invalid.length) {
        return res.status(400).json({
          message: `Invalid permissions: ${invalid.join(", ")}`,
        });
      }
    }

    // Safety: prevent demoting the very last superAdmin
    if (isSuperAdmin === false) {
      const superAdminCount = await Admin.countDocuments({
        isSuperAdmin: true,
      });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          message: "Cannot demote the last super admin",
        });
      }
    }

    const updates = {};
    if (permissions !== undefined) updates.permissions = permissions;
    if (isSuperAdmin !== undefined) updates.isSuperAdmin = isSuperAdmin;

    const admin = await Admin.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("userId", "name email");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({ admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAdminProfile = async (req, res) => {
  try {
    // req.admin already attached by attachAdmin middleware
    // We re-fetch with .populate() for the full User details
    const admin = await Admin.findById(req.admin._id).populate(
      "userId",
      "name email isActive createdAt"
    );

    res.status(200).json({ admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/:id  — view any admin's profile (superAdmin only)
export const getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).populate(
      "userId",
      "name email role isActive"
    );

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({ admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    // Build filter object dynamically
    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    // Case-insensitive search across name and email
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      users,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const promoteToAdmin = async (req, res) => {
  // Use a session so both writes succeed or both roll back
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId }     = req.params;
    const { permissions } = req.body;

    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      await session.abortTransaction();
      return res.status(409).json({ message: 'User is already an admin' });
    }

    // Write 1 — update role on User document
    user.role = 'admin';
    await user.save({ session });

    // Write 2 — create Admin profile
    const [admin] = await Admin.create(
      [{ userId: user._id, permissions: permissions || ['manage_users'] }],
      { session }
    );

    // Both succeeded — commit
    await session.commitTransaction();

    res.status(201).json({
      message: `${user.name} promoted to admin`,
      admin,
    });

  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    // Fire all DB queries in parallel — no await chaining
    const [
      totalUsers,
      activeUsers,
      totalAdmins,
      totalStaff,
      totalStudents,
      recentUsers,
      inactiveUsers,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin'   }),
      User.countDocuments({ role: 'staff'   }),
      User.countDocuments({ role: 'student' }),

      // Last 5 signups — for "recent activity" feed
      User.find({})
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5),

      User.countDocuments({ isActive: false }),
    ]);

    // Admins with 'all' permission
    const superAdmins = await Admin.countDocuments({
      isSuperAdmin: true,
    });

    res.status(200).json({
      users: {
        total:    totalUsers,
        active:   activeUsers,
        inactive: inactiveUsers,
        byRole: {
          admin:   totalAdmins,
          staff:   totalStaff,
          student: totalStudents,
        },
      },
      admins: { superAdmins },
      recentSignups: recentUsers,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};