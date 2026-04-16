import express from "express";
const router = express.Router();
import { body, param } from "express-validator";
import {
  createStudent,
  deleteStudent,
  getStudentById,
  getStudents,
  transferStudent,
  updateStudent,
} from "../controllers/studentController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const createRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("rollNumber").trim().notEmpty().withMessage("Roll number is required"),
  body("sectionId").isMongoId().withMessage("Valid sectionId required"),
  body("email").optional().isEmail().withMessage("Invalid email"),
];

router.use(protect); // all routes below require auth

router
  .route("/")
  .get(getStudents)
  .post(restrictTo("admin", "staff"), createRules, createStudent);

router
  .route("/:id")
  .get(getStudentById)
  .put(restrictTo("admin", "staff"), updateStudent)
  .delete(restrictTo("admin"), deleteStudent);

router.patch(
  "/:id/transfer",
  restrictTo("admin"),
  [body("targetSectionId").isMongoId()],
  transferStudent
);

export default router;
