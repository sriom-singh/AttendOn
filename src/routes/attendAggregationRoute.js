import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.js";
import {
  getAttendanceTrend,
  getLowAttendanceStudents,
  getSectionAttendanceReport,
  getStudentAttendanceSummary,
  getSubjectWiseBreakdown,
} from "../controllers/attendanceAggController.js";

router.use(protect);

// Per-student aggregations
router.get("/:id/attendance/summary", getStudentAttendanceSummary);
router.get("/:id/attendance/subjects", getSubjectWiseBreakdown);
router.get("/:id/attendance/trend", getAttendanceTrend);

// Section-level (mount on /api/sections router)
router.get("/:id/attendance/report", getSectionAttendanceReport);
router.get("/:id/attendance/low", getLowAttendanceStudents);

export default router;
