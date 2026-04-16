import express from "express";
const router = express.Router();
import { body } from "express-validator";
import {
  assignHead,
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartmentCourses,
  getDepartmentStats,
  getDepartments,
  updateDepartment,
} from "../controllers/departmentController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const createRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("code").trim().notEmpty().withMessage("Code is required"),
  body("organizationId")
    .isMongoId()
    .withMessage("Valid organizationId required"),
];

const updateRules = [
  body("name").optional().trim().notEmpty(),
  body("code").optional().trim().notEmpty(),
];

router.use(protect);

router
  .route("/")
  .get(getDepartments)
  .post(restrictTo("admin"), createRules, createDepartment);

router
  .route("/:id")
  .get(getDepartmentById)
  .put(restrictTo("admin"), updateRules, updateDepartment)
  .delete(restrictTo("admin"), deleteDepartment);

router.get("/:id/stats", getDepartmentStats);
router.get("/:id/courses", getDepartmentCourses);
router.patch(
  "/:id/head",
  restrictTo("admin"),
  [body("staffId").optional().isMongoId()],
  assignHead
);

export default router;
