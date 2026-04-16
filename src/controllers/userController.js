// controllers/userController.js
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Staff from "../models/Staff.js";
import Student from "../models/Student.js";

// Map role string → the right profile model
const profileModel = { admin: Admin, staff: Staff, student: Student };

export const getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware (see middleware tab)
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Dynamically pick the profile model based on role
    const Profile = profileModel[user.role];

    // const profile = await Profile.findOne({ userId: user._id })
    //   .populate("departmentId", "name code") // staff/student only
    //   .populate("courseId", "name code"); // student only

    let query = Profile.findOne({ userId: user._id });

    if (user.role === "staff") {
      query = query.populate("departmentId", "name code");
    }

    if (user.role === "student") {
      query = query
        .populate("departmentId", "name code")
        .populate("courseId", "name code");
    }
    const profile = await query;
    
    res.status(200).json({ user, profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateMe = async (req, res) => {
  try {
    // Whitelist allowed fields — never pass req.body directly to update
    // This prevents role escalation: { role: 'admin' } in body is ignored
    const allowed = ["name", "email"];
    const updates = {};

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.password) {
      return res.status(400).json({
        message: "Use /change-password to update your password",
      });
    }

    // findByIdAndUpdate with runValidators:true re-runs schema validators
    // new:true returns the updated document, not the old one
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already in use" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const users = await User.find().skip(skip).limit(limit).select("-password");
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Both currentPassword and newPassword are required",
      });
    }

    // Must use .select('+password') — it's excluded by default on the schema
    const user = await User.findById(req.user._id).select("+password");

    // Verify old password using the model instance method
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Assign new password — pre("save") hook detects isModified('password')
    // and re-hashes it automatically before writing to DB
    user.password = newPassword;
    await user.save();

    // Issue a fresh token — old tokens are now considered stale
    const token = signToken(user._id);
    user.password = undefined;

    res.status(200).json({ message: "Password updated", token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const adminUpdateUser = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.role !== undefined) updates.role = req.body.role;
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User updated", user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already in use" });
    }
  }
  res.status(500).json({ message: err.message });
};

export const adminDeleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deactivateMe = async (req, res) => {
  try {
    // Soft delete — flip isActive instead of destroying the document
    // Hard deletes break attendance, grade, and assignment history
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    res.status(200).json({ message: "Account deactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin-only: reactivate a previously deactivated user

export const reactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User reactivated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
