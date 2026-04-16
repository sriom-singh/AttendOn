import Student from "../models/Student.js";
import Section from "../models/Section.js";
import { validationResult } from "express-validator";

// ─── Create Student ────────────────────────────────────────────
export const createStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { rollNumber, sectionId } = req.body;

    // Ensure roll number is unique within the section
    const duplicate = await Student.findOne({ rollNumber, section: sectionId });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Roll number already exists in this section",
      });
    }

    const student = await Student.create({ ...req.body, section: sectionId });

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Students (with filters + pagination) ──────────────
export const getStudents = async (req, res) => {
  try {
    const { sectionId, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (sectionId) filter.section = sectionId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Student.countDocuments(filter);

    const students = await Student.find(filter)
      .populate("section", "name")
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

// ─── Get Single Student ────────────────────────────────────────
export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate(
      "section",
      "name course"
    );

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Student ────────────────────────────────────────────
export const updateStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Student ────────────────────────────────────────────
export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Transfer Student to Another Section ───────────────────────
export const transferStudent = async (req, res) => {
  try {
    const { targetSectionId } = req.body;

    const section = await Section.findById(targetSectionId);
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Target section not found" });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: { section: targetSectionId } },
      { new: true }
    );

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, data: student, message: "Student transferred" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
