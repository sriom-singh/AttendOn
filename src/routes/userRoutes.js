// routes/user.js
import express from "express";
const router = express.Router();
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  getMe,
  updateMe,
  changePassword,
  deactivateMe,
  getAllUsers,
  getUserById,
  adminUpdateUser,
  reactivateUser,
  adminDeleteUser,
} from "../controllers/userController.js";

// Every route in this file requires a valid JWT
router.use(protect);

// ── Validation rules ──────────────────────────────────────────
const updateMeRules = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .not()
    .exists()
    .withMessage("Use /me/change-password to update password"),
];

const changePasswordRules = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("New password must contain a number"),
];

// ── Self-service routes (/me MUST be declared before /:id) ────

// GET  /api/users/me
// PUT  /api/users/me
router.route("/me").get(getMe).put(updateMeRules, validate, updateMe);

// PATCH /api/users/me/change-password
router.patch(
  "/me/change-password",
  changePasswordRules,
  validate,
  changePassword
);

// DELETE /api/users/me
router.delete("/me", deactivateMe);

// ── Admin-only routes ─────────────────────────────────────────
// All routes below additionally require role = 'admin'

// GET  /api/users        — list with filter + pagination
// (no /:id here so admin list is always clean)
router.get("/", restrictTo("admin"), getAllUsers);

// GET /api/users/:id
// PUT /api/users/:id
router
  .route("/:id")
  .get(restrictTo("admin"), getUserById)
  .put(
    restrictTo("admin"),
    [
      body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Name cannot be empty"),
      body("email").optional().isEmail().normalizeEmail(),
    ],
    validate,
    adminUpdateUser
  );

// PATCH /api/users/:id/reactivate
router.patch("/:id/reactivate", restrictTo("admin"), reactivateUser);

// DELETE /api/users/:id
router.delete("/:id", restrictTo("admin"), adminDeleteUser);

export default router;
