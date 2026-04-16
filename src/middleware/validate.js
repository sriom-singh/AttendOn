// middleware/validate.js
import { validationResult } from "express-validator";
import mongoose from "mongoose";

// ── 1. Core field validator ───────────────────────────────────
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        value: e.value,
        message: e.msg,
      })),
    });
  }

  next();
};

// ── 2. ObjectId param guard ───────────────────────────────────
export const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [
        { field: "id", value: req.params.id, message: "Invalid ID format" },
      ],
    });
  }
  next();
};

// ── 3. Generic param validator (for non-id params) ────────────
// Usage: validateParam('sectionId')
export const validateParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [
        { field: paramName, value, message: `Invalid ${paramName} format` },
      ],
    });
  }
  next();
};
