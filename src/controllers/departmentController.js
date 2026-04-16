import Department from "../models/Department.js";
import Course from "../models/Course.js";
import { validationResult } from "express-validator";

// ─── Create Department ─────────────────────────────────────────
export const createDepartment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, code, organizationId } = req.body;

    // Department code must be unique within an organization
    const duplicate = await Department.findOne({
      code: code.toUpperCase(),
      organization: organizationId,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Department code already exists in this organization",
      });
    }

    const department = await Department.create({
      name,
      code: code.toUpperCase(),
      organization: organizationId,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: department });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get All Departments (scoped to org) ───────────────────────
export const getDepartments = async (req, res) => {
  try {
    const { organizationId, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (organizationId) filter.organization = organizationId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Department.countDocuments(filter);

    const departments = await Department.find(filter)
      .populate("organization", "name")
      .populate("head", "name email")
      .skip(skip)
      .limit(Number(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      data: departments,
      meta: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Single Department ─────────────────────────────────────
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate("organization", "name")
      .populate("head", "name email")
      .populate("createdBy", "name");

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({ success: true, data: department });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Update Department ─────────────────────────────────────────
export const updateDepartment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    // Uppercase code if it's being updated
    if (req.body.code) req.body.code = req.body.code.toUpperCase();

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({ success: true, data: department });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Delete Department ─────────────────────────────────────────
export const deleteDepartment = async (req, res) => {
  try {
    // Block deletion if courses exist under this department
    const courseCount = await Course.countDocuments({
      department: req.params.id,
    });
    if (courseCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — ${courseCount} course(s) are linked to this department`,
      });
    }

    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({ success: true, message: "Department deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Assign / Change Department Head ──────────────────────────
export const assignHead = async (req, res) => {
  try {
    const { staffId } = req.body;

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: { head: staffId || null } },
      { new: true }
    ).populate("head", "name email");

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const msg = staffId
      ? "Department head assigned"
      : "Department head removed";
    res.json({ success: true, data: department, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Department with Course + Section counts ───────────────
export const getDepartmentStats = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const Section = require("../models/Section");
    const Student = require("../models/Student");

    const deptId = new mongoose.Types.ObjectId(req.params.id);

    const [department, courseCount, sectionCount, studentCount] =
      await Promise.all([
        Department.findById(deptId).populate("head", "name email"),
        Course.countDocuments({ department: deptId }),
        Section.countDocuments({ department: deptId }),
        Student.countDocuments({ department: deptId }),
      ]);

    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    res.json({
      success: true,
      data: {
        ...department.toObject(),
        stats: { courseCount, sectionCount, studentCount },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── List Courses under a Department ──────────────────────────
export const getDepartmentCourses = async (req, res) => {
  try {
    const courses = await Course.find({ department: req.params.id })
      .select("name code duration isActive")
      .sort({ name: 1 });

    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
