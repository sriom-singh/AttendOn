import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { body } from "express-validator";
import {
  createAssignment,
  deactivateAssignment,
  getAssignments,
  getSectionTimetable,
  getStaffWorkload,
  reassignStaff,
} from "../controllers/subjectAssignmentController.js";
const assignmentRouter = express.Router();
assignmentRouter.use(protect);

const createAssignmentRules = [
  body("subjectId").isMongoId().withMessage("Valid subjectId required"),
  body("sectionId").isMongoId().withMessage("Valid sectionId required"),
  body("staffId").isMongoId().withMessage("Valid staffId required"),
  body("academicYear")
    .trim()
    .notEmpty()
    .withMessage("academicYear is required"),
];

// ── Assignment router (/api/assignments) ──────────────────────

assignmentRouter
  .route("/")
  .get(getAssignments)
  .post(restrictTo("admin"), createAssignmentRules, createAssignment);

assignmentRouter.patch(
  "/:id/staff",
  restrictTo("admin"),
  [body("staffId").isMongoId()],
  reassignStaff
);
assignmentRouter.delete("/:id", restrictTo("admin"), deactivateAssignment);

// Timetable + workload hang off their parent routers
// Mount these in sectionRouter and staffRouter respectively:
// sectionRouter.get('/:sectionId/timetable', .getSectionTimetable);
// staffRouter.get('/:staffId/workload',       .getStaffWorkload);

export default assignmentRouter;
