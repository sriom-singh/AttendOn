// routes/admin.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

import { protect } from "../middleware/auth.js";
import {
  attachAdmin,
  hasPermission,
  superAdminOnly,
} from "../middleware/permission.js";

import {
  getAdminProfile,
  getAdminById,
  updatePermissions,
  getAllUsers,
  promoteToAdmin,
  getDashboardStats,
} from "../controllers/adminController.js";

// Middleware chain applied to ALL routes in this file:
// protect      → verify JWT, attach req.user
// attachAdmin  → verify role=admin, attach req.admin
router.use(protect, attachAdmin);

// ── Self ──────────────────────────────────────────────
router.get("/me", getAdminProfile);
router.get("/dashboard", hasPermission("all"), getDashboardStats);

// ── User management ───────────────────────────────────
router.get("/users", hasPermission("manage_users"), getAllUsers);

router.patch(
  "/users/:userId/reactivate",
  hasPermission("manage_users"),
  async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isActive: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user });
  }
);

// ── SuperAdmin-only ───────────────────────────────────
router.get("/admins/:id", superAdminOnly, getAdminById);

router.patch("/admins/:id/permissions", superAdminOnly, updatePermissions);

router.post("/promote/:userId", superAdminOnly, promoteToAdmin);

export default router;
// ── Mount in app.js ───────────────────────────────────
// app.use('/api/admin', require('./routes/admin'));
