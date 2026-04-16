// routes/organization.js
import express from "express";
const router = express.Router();

import { protect } from "../middleware/auth.js";
import {
  attachAdmin,
  hasPermission,
  superAdminOnly,
} from "../middleware/permission.js";
import {
  createOrg,
  getAllOrgs,
  getOrgById,
  updateOrg,
  deactivateOrg,
  reactivateOrg,
  getOrgStats,
} from "../controllers/organizationController.js";

// All org routes require a valid JWT + admin profile
router.use(protect, attachAdmin);

// ── Collection routes ─────────────────────────────────
router
  .route("/")
  .get(getAllOrgs) // any admin can list
  .post(hasPermission("manage_org"), createOrg);

// ── Individual org routes ─────────────────────────────
router
  .route("/:id")
  .get(getOrgById) // any admin can view
  .put(hasPermission("manage_org"), updateOrg);

// ── Lifecycle routes ──────────────────────────────────
router.patch("/:id/deactivate", hasPermission("manage_org"), deactivateOrg);

router.patch(
  "/:id/reactivate",
  superAdminOnly, // only superAdmin can reactivate
  reactivateOrg
);

// ── Stats ─────────────────────────────────────────────
router.get("/:id/stats", hasPermission("manage_org"), getOrgStats);

export default router;
// ── Mount in app.js ───────────────────────────────────
// app.use('/api/organizations', require('./routes/organization'));
