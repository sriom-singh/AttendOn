import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Staff from "../models/Staff.js";
import Student from "../models/Student.js";
import jwt from "jsonwebtoken";
import { sendMail } from "../utils/sendMail.js";

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

export const register = async (req, res) => {
  try {
    const { name, email, password, role, profileData } = req.body;

    // 1. Reject unknown roles early
    if (!["admin", "staff", "student"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const isEmailExist = await User.findOne({email});
    if (isEmailExist) {
      return res.status(404).json({ message: "Email already exist." });
    }

    // 2. Create User — pre("save") hook hashes the password
    const user = await User.create({ name, email, password, role });

    // 3. Create the matching role profile in the same request
    let profile;
    if (role === "admin") {
      profile = await Admin.create({ userId: user._id, ...profileData });
    } else if (role === "staff") {
      profile = await Staff.create({ userId: user._id, ...profileData });
    } else {
      profile = await Student.create({ userId: user._id, ...profileData });
    }

    // 4. Sign JWT with user._id as payload
    const token = signToken(user._id);

    // 5. Never send password back — even hashed
    user.password = undefined;

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production (HTTPS)
      sameSite: "lax", // or "none" if cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
   
    res.status(201).json({ token, user, profile });
  } catch (err) {
    // Duplicate email hits MongoDB error code 11000
    console.log(err);

    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // .select('+password') — password field has select:false on the schema
    // so it's excluded from all queries by default. We opt-in only here.
    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // comparePassword() — instance method on User model
    // wraps bcrypt.compare internally, keeps bcrypt out of controllers
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    //First Login - Force password reset
    const resettoken = signToken(user._id, "1h");
    if (user.isFirstLogin && ["staff", "student"].includes(user.role)) {
      return res.json({
        message: "First login - reset password required",
        resetRequired: true,
        token: resettoken,
      });
    }
    // If password is correct and it's not first login, proceed as normal
    // Same error message for "not found" and "wrong password"
    // — prevents user enumeration attacks
    const token = signToken(user._id);
    user.password = undefined;

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production (HTTPS)
      sameSite: "lax", // or "none" if cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signToken(user._id, "15m"); // Short-lived token for password reset
    const isSent = await sendMail(
      user.email,
      "Password Reset",
      "Click here to reset your password: " + process.env.FRONTEND_URL ||
        "http://localhost:3000" + "/reset-password?token=" + token
    );
    if (!isSent) {
      return res.status(500).json({ message: "Failed to send email" });
    }
    return res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+password");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid token" });
    }
    user.password = newPassword;
    if (user.isFirstLogin) {
      user.isFirstLogin = false;
    }
    await user.save();
    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};
