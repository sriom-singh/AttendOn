import SubjectAssignment from "../models/SubjectAssignment.js";
import Subject from "../models/Subject.js";
import Section from "../models/Section.js";
import { validationResult } from "express-validator";

// ─── Assign Subject to Section + Staff ─────────────────────────
export const createAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { subjectId, sectionId, staffId, academicYear } = req.body;

    // Verify subject and section belong to the same course
    const [subject, section] = await Promise.all([
      Subject.findById(subjectId),
      Section.findById(sectionId),
    ]);

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }
    if (subject.course.toString() !== section.course.toString()) {
      return res.status(422).json({
        success: false,
        message: "Subject and section must belong to the same course",
      });
    }

    // Semester must also match
    if (subject.semester !== section.semester) {
      return res.status(422).json({
        success: false,
        message: `Subject is for semester ${subject.semester}, section is semester ${section.semester}`,
      });
    }

    // No duplicate active assignment for same subject + section + academicYear
    const duplicate = await SubjectAssignment.findOne({
      subject: subjectId,
      section: sectionId,
      academicYear,
      isActive: true,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "An active assignment already exists for this subject, section and academic year",
      });
    }

    const assignment = await SubjectAssignment.create({
      subject: subjectId,
      section: sectionId,
      staff: staffId,
      academicYear,
      createdBy: req.user._id,
    });

    await assignment.populate([
      { path: "subject", select: "name code" },
      { path: "section", select: "name semester" },
      { path: "staff", select: "name email" },
    ]);

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Assignments (filterable) ─────────────────────────────
export const getAssignments = async (req, res) => {
  try {
    const {
      sectionId,
      subjectId,
      staffId,
      academicYear,
      isActive,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = {};

    if (sectionId) filter.section = sectionId;
    if (subjectId) filter.subject = subjectId;
    if (staffId) filter.staff = staffId;
    if (academicYear) filter.academicYear = academicYear;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const total = await SubjectAssignment.countDocuments(filter);

    const assignments = await SubjectAssignment.find(filter)
      .populate("subject", "name code credits semester")
      .populate("section", "name semester year")
      .populate("staff", "name email")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: assignments,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Reassign Staff on an Assignment ──────────────────────────
export const reassignStaff = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res
        .status(422)
        .json({ success: false, message: "staffId is required" });
    }

    const assignment = await SubjectAssignment.findByIdAndUpdate(
      req.params.id,
      { $set: { staff: staffId } },
      { new: true }
    ).populate("staff", "name email");

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    res.json({ success: true, data: assignment, message: "Staff reassigned" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Deactivate Assignment (soft delete) ──────────────────────
export const deactivateAssignment = async (req, res) => {
  try {
    const assignment = await SubjectAssignment.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    res.json({
      success: true,
      message: "Assignment deactivated",
      data: assignment,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Timetable View for a Section ─────────────────────────
// Returns all active subject assignments for a section,
// grouped by subject — useful for building a timetable UI
export const getSectionTimetable = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const filter = { section: req.params.sectionId, isActive: true };
    if (academicYear) filter.academicYear = academicYear;

    const assignments = await SubjectAssignment.find(filter)
      .populate("subject", "name code credits isElective")
      .populate("staff", "name email")
      .sort({ "subject.name": 1 });

    res.json({ success: true, data: assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Staff Workload (all sections assigned to a staff) ─────
export const getStaffWorkload = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const filter = { staff: req.params.staffId, isActive: true };
    if (academicYear) filter.academicYear = academicYear;

    const assignments = await SubjectAssignment.find(filter)
      .populate("subject", "name code credits")
      .populate("section", "name semester year course")
      .sort({ "section.year": -1, "section.semester": 1 });

    res.json({
      success: true,
      data: assignments,
      meta: { totalAssignments: assignments.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
