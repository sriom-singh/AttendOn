import express from "express";
const router = express.Router();
import { body } from "express-validator";
import {
  createCourse,
  deleteCourse,
  getCourseById,
  getCourseSections,
  getCourseStats,
  getCourseSubjects,
  getCourses,
  toggleCourseStatus,
  updateCourse,
} from "../controllers/courseController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const createRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("code").trim().notEmpty().withMessage("Code is required"),
  body("departmentId").isMongoId().withMessage("Valid departmentId required"),
  body("duration")
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive integer"),
  body("totalSemesters")
    .isInt({ min: 1 })
    .withMessage("totalSemesters must be a positive integer"),
];

const updateRules = [
  body("name").optional().trim().notEmpty(),
  body("code").optional().trim().notEmpty(),
  body("duration").optional().isInt({ min: 1 }),
  body("totalSemesters").optional().isInt({ min: 1 }),
];

router.use(protect);

router
  .route("/")
  .get(getCourses)
  .post(restrictTo("admin"), createRules, createCourse);

router
  .route("/:id")
  .get(getCourseById)
  .put(restrictTo("admin"), updateRules, updateCourse)
  .delete(restrictTo("admin"), deleteCourse);

router.get("/:id/stats", getCourseStats);
router.get("/:id/sections", getCourseSections);
router.get("/:id/subjects", getCourseSubjects);
router.patch("/:id/status", restrictTo("admin"), toggleCourseStatus);

export default router;
