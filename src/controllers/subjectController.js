import Subject from "../models/Subject.js";
import Course from "../models/Course.js";
import SubjectAssignment from "../models/SubjectAssignment.js";
import { validationResult } from "express-validator";

// ─── Create Subject ────────────────────────────────────────────
export const createSubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { code, courseId, semester } = req.body;

    // Validate semester against course ceiling
    const course = await Course.findById(courseId);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }
    if (semester > course.totalSemesters) {
      return res.status(422).json({
        success: false,
        message: `Semester ${semester} exceeds course limit of ${course.totalSemesters}`,
      });
    }

    // Subject code unique within course
    const duplicate = await Subject.findOne({
      code: code.toUpperCase(),
      course: courseId,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Subject code already exists in this course",
      });
    }

    const subject = await Subject.create({
      ...req.body,
      code: code.toUpperCase(),
      course: courseId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Subjects ──────────────────────────────────────────
export const getSubjects = async (req, res) => {
  try {
    const { courseId, semester, isElective, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (courseId) filter.course = courseId;
    if (semester) filter.semester = Number(semester);
    if (isElective !== undefined) filter.isElective = isElective === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Subject.countDocuments(filter);

    const subjects = await Subject.find(filter)
      .populate("course", "name code")
      .skip(skip)
      .limit(Number(limit))
      .sort({ semester: 1, name: 1 });

    res.json({
      success: true,
      data: subjects,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Single Subject ────────────────────────────────────────
export const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate("course", "name code department")
      .populate("createdBy", "name");

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    res.json({ success: true, data: subject });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Subject ────────────────────────────────────────────
export const updateSubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    // Re-validate semester ceiling if semester is being changed
    if (req.body.semester) {
      const subject = await Subject.findById(req.params.id).populate(
        "course",
        "totalSemesters"
      );
      if (!subject) {
        return res
          .status(404)
          .json({ success: false, message: "Subject not found" });
      }
      if (req.body.semester > subject.course.totalSemesters) {
        return res.status(422).json({
          success: false,
          message: `Semester exceeds course limit of ${subject.course.totalSemesters}`,
        });
      }
    }

    if (req.body.code) req.body.code = req.body.code.toUpperCase();

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("course", "name code");

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    res.json({ success: true, data: subject });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Subject ────────────────────────────────────────────
export const deleteSubject = async (req, res) => {
  try {
    // Block if active assignments exist
    const assignmentCount = await SubjectAssignment.countDocuments({
      subject: req.params.id,
      isActive: true,
    });
    if (assignmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — ${assignmentCount} active assignment(s) reference this subject`,
        meta: { assignmentCount },
      });
    }

    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    res.json({ success: true, message: "Subject deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
