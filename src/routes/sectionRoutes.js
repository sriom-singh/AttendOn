import express from "express";
const router = express.Router();
import { body } from "express-validator";
import {
  assignClassTeacher,
  createSection,
  deleteSection,
  getSectionById,
  getSectionStats,
  getSections,
  toggleSectionStatus,
  getSectionStudents,
  updateSection,
} from "../controllers/sectionController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const createRules = [
  body("name").trim().notEmpty().withMessage("Section name is required"),
  body("courseId").isMongoId().withMessage("Valid courseId required"),
  body("semester")
    .isInt({ min: 1 })
    .withMessage("Semester must be a positive integer"),
  body("year").isInt({ min: 2000 }).withMessage("Year must be 2000 or later"),
  body("maxStrength").optional().isInt({ min: 1 }),
];

const updateRules = [
  body("name").optional().trim().notEmpty(),
  body("semester").optional().isInt({ min: 1 }),
  body("year").optional().isInt({ min: 2000 }),
  body("maxStrength").optional().isInt({ min: 1 }),
];

router.use(protect);

router
  .route("/")
  .get(getSections)
  .post(restrictTo("admin"), createRules, createSection);

router
  .route("/:id")
  .get(getSectionById)
  .put(restrictTo("admin"), updateRules, updateSection)
  .delete(restrictTo("admin"), deleteSection);

router.get("/:id/stats", getSectionStats);
router.get("/:id/students", getSectionStudents);

router.patch(
  "/:id/teacher",
  restrictTo("admin"),
  [body("staffId").optional().isMongoId()],
  assignClassTeacher
);

router.patch("/:id/status", restrictTo("admin"), toggleSectionStatus);

export default router;
