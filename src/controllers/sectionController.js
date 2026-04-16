import Section from "../models/Section.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import { validationResult } from "express-validator";

// ─── Create Section ────────────────────────────────────────────
export const createSection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, courseId, semester, year } = req.body;

    // Validate semester does not exceed course's totalSemesters
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

    // Section name must be unique within course + semester + year
    const duplicate = await Section.findOne({
      name: name.toUpperCase(),
      course: courseId,
      semester,
      year,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Section "${name.toUpperCase()}" already exists for this course, semester and year`,
      });
    }

    const section = await Section.create({
      ...req.body,
      name: name.toUpperCase(),
      course: courseId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Sections ──────────────────────────────────────────
export const getSections = async (req, res) => {
  try {
    const {
      courseId,
      semester,
      year,
      isActive,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = {};

    if (courseId) filter.course = courseId;
    if (semester) filter.semester = Number(semester);
    if (year) filter.year = Number(year);
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Section.countDocuments(filter);

    const sections = await Section.find(filter)
      .populate("course", "name code totalSemesters")
      .populate("classTeacher", "name email")
      .skip(skip)
      .limit(Number(limit))
      .sort({ year: -1, semester: 1, name: 1 });

    res.json({
      success: true,
      data: sections,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Single Section ────────────────────────────────────────
export const getSectionById = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate("course", "name code department totalSemesters")
      .populate("classTeacher", "name email")
      .populate("createdBy", "name");

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Section ────────────────────────────────────────────
export const updateSection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    // Re-validate semester ceiling if semester is being changed
    if (req.body.semester) {
      const section = await Section.findById(req.params.id).populate(
        "course",
        "totalSemesters"
      );
      if (!section) {
        return res
          .status(404)
          .json({ success: false, message: "Section not found" });
      }
      if (req.body.semester > section.course.totalSemesters) {
        return res.status(422).json({
          success: false,
          message: `Semester exceeds course limit of ${section.course.totalSemesters}`,
        });
      }
    }

    if (req.body.name) req.body.name = req.body.name.toUpperCase();

    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("course", "name code");

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Assign / Remove Class Teacher ────────────────────────────
export const assignClassTeacher = async (req, res) => {
  try {
    const { staffId } = req.body;

    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { $set: { classTeacher: staffId || null } },
      { new: true }
    ).populate("classTeacher", "name email");

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    const msg = staffId ? "Class teacher assigned" : "Class teacher removed";
    res.json({ success: true, data: section, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Toggle Active Status ──────────────────────────────────────
export const toggleSectionStatus = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    section.isActive = !section.isActive;
    await section.save();

    res.json({
      success: true,
      data: section,
      message: `Section ${section.isActive ? "activated" : "deactivated"}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Section ────────────────────────────────────────────
export const deleteSection = async (req, res) => {
  try {
    // Block if students are enrolled
    const studentCount = await Student.countDocuments({
      section: req.params.id,
    });
    if (studentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — ${studentCount} student(s) are enrolled in this section`,
        meta: { studentCount },
      });
    }

    const section = await Section.findByIdAndDelete(req.params.id);
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({ success: true, message: "Section deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Section Stats ─────────────────────────────────────────
export const getSectionStats = async (req, res) => {
  try {
    const AttendanceSession = require("../models/AttendanceSession");
    const sectionId = req.params.id;

    const [section, studentCount, sessionCount] = await Promise.all([
      Section.findById(sectionId)
        .populate("course", "name code")
        .populate("classTeacher", "name email"),
      Student.countDocuments({ section: sectionId }),
      AttendanceSession.countDocuments({ section: sectionId }),
    ]);

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found" });
    }

    res.json({
      success: true,
      data: {
        ...section.toObject(),
        stats: { studentCount, sessionCount },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Students in Section ───────────────────────────────────
export const getSectionStudents = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { section: req.params.id };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Student.countDocuments(filter);

    const students = await Student.find(filter)
      .select("name rollNumber email isActive")
      .skip(skip)
      .limit(Number(limit))
      .sort({ rollNumber: 1 });

    res.json({
      success: true,
      data: students,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
