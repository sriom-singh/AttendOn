import Course from "../models/Course.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import { validationResult } from "express-validator";

// ─── Create Course ─────────────────────────────────────────────
export const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, code, departmentId } = req.body;

    // Course code must be unique within the department
    const duplicate = await Course.findOne({
      code: code.toUpperCase(),
      department: departmentId,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Course code already exists in this department",
      });
    }

    const course = await Course.create({
      ...req.body,
      code: code.toUpperCase(),
      department: departmentId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Courses ───────────────────────────────────────────
export const getCourses = async (req, res) => {
  try {
    const { departmentId, search, isActive, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (departmentId) filter.department = departmentId;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Course.countDocuments(filter);

    const courses = await Course.find(filter)
      .populate("department", "name code")
      .skip(skip)
      .limit(Number(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      data: courses,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Single Course ─────────────────────────────────────────
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("department", "name code organization")
      .populate("createdBy", "name");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Course ─────────────────────────────────────────────
export const updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    if (req.body.code) req.body.code = req.body.code.toUpperCase();

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("department", "name code");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Toggle Active Status ──────────────────────────────────────
export const toggleCourseStatus = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    course.isActive = !course.isActive;
    await course.save();

    res.json({
      success: true,
      data: course,
      message: `Course ${course.isActive ? "activated" : "deactivated"}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Course ─────────────────────────────────────────────
export const deleteCourse = async (req, res) => {
  try {
    // Block if sections or subjects are linked
    const [sectionCount, subjectCount] = await Promise.all([
      Section.countDocuments({ course: req.params.id }),
      Subject.countDocuments({ course: req.params.id }),
    ]);

    if (sectionCount > 0 || subjectCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete — course has linked sections or subjects",
        meta: { sectionCount, subjectCount },
      });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, message: "Course deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Course Stats (sections + subjects + students) ─────────
export const getCourseStats = async (req, res) => {
  try {
    const Student = require("../models/Student");
    const courseId = req.params.id;

    const [course, sectionCount, subjectCount, studentCount] =
      await Promise.all([
        Course.findById(courseId).populate("department", "name"),
        Section.countDocuments({ course: courseId }),
        Subject.countDocuments({ course: courseId }),
        Student.countDocuments({ course: courseId }),
      ]);

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({
      success: true,
      data: {
        ...course.toObject(),
        stats: { sectionCount, subjectCount, studentCount },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── List Sections under a Course ─────────────────────────────
export const getCourseSections = async (req, res) => {
  try {
    const sections = await Section.find({ course: req.params.id })
      .select("name semester year isActive")
      .sort({ year: -1, semester: 1 });

    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── List Subjects under a Course ─────────────────────────────
export const getCourseSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ course: req.params.id })
      .select("name code credits semester isActive")
      .sort({ semester: 1, name: 1 });

    res.json({ success: true, data: subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
