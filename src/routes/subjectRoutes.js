import express from "express";
import { body } from "express-validator";
import { protect, restrictTo } from "../middleware/auth.js";
import {createSubject,deleteSubject,getSubjectById,getSubjects,updateSubject} from "../controllers/subjectController.js";

// ── Subject router (/api/subjects) ────────────────────────────
const subjectRouter = express.Router();
subjectRouter.use(protect);

const createSubjectRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("code").trim().notEmpty().withMessage("Code is required"),
  body("courseId").isMongoId().withMessage("Valid courseId required"),
  body("semester")
    .isInt({ min: 1 })
    .withMessage("Semester must be a positive integer"),
  body("credits")
    .isInt({ min: 1 })
    .withMessage("Credits must be a positive integer"),
  body("isElective").optional().isBoolean(),
];

subjectRouter
  .route("/")
  .get(getSubjects)
  .post(restrictTo("admin"), createSubjectRules, createSubject);

subjectRouter
  .route("/:id")
  .get(getSubjectById)
  .put(restrictTo("admin"), updateSubject)
  .delete(restrictTo("admin"), deleteSubject);

export default subjectRouter;
