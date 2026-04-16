import jwt from "jsonwebtoken";
import AttendanceSession from "../models/AttendanceSession.js";
import AttendanceRecord from "../models/AttendanceRecord.js";

/* ----------------------------------------------------- */
/* 🎯 1. Create Attendance Session (GeoJSON) */
/* ----------------------------------------------------- */
export const createSession = async (req, res) => {
  try {
    const {
      subjectAssignmentId,
      sectionId,
      date,
      slot,
      topic,
      lat,
      lng,
      radius,
    } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Location (lat, lng) is required",
      });
    }

    const session = await AttendanceSession.create({
      subjectAssignmentId,
      sectionId,
      takenBy: req.user.id,
      date,
      slot,
      topic,
      location: {
        type: "Point",
        coordinates: [lng, lat], // ⚠️ [lng, lat]
      },
      radius: radius || 50, // meters
    });

    res.status(201).json({
      message: "Session created",
      session,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------- */
/* 🔐 2. Generate QR Token */
/* ----------------------------------------------------- */
export const generateQR = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status !== "draft") {
      return res.status(400).json({
        message: "Session is not active",
      });
    }

    const token = jwt.sign(
      { sessionId },
      process.env.QR_SECRET,
      { expiresIn: "2m" }
    );

    res.json({
      message: "QR generated",
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------- */
/* 📍 3. Mark Attendance (QR + GeoJSON via $near) */
/* ----------------------------------------------------- */
export const markAttendance = async (req, res) => {
  try {
    const { token, lat, lng } = req.body;

    if (!token || lat == null || lng == null) {
      return res.status(400).json({
        message: "Token and location (lat, lng) required",
      });
    }

    // 🔐 Verify QR Token
    const decoded = jwt.verify(token, process.env.QR_SECRET);
    const { sessionId } = decoded;

    // First fetch base session (to read radius + status)
    const baseSession = await AttendanceSession.findById(sessionId);

    if (!baseSession) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (baseSession.status !== "draft") {
      return res.status(400).json({
        message: "Session is closed",
      });
    }

    // 🔥 GEO VALIDATION using $near (meters)
    const session = await AttendanceSession.findOne({
      _id: sessionId,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat], // student's location
          },
          $maxDistance: baseSession.radius, // meters
        },
      },
    });

    if (!session) {
      return res.status(403).json({
        message: "You are outside allowed area",
      });
    }

    const studentId = req.user.id;

    // ❌ Prevent duplicate
    const existing = await AttendanceRecord.findOne({
      sessionId,
      studentId,
    });

    if (existing) {
      return res.status(400).json({
        message: "Attendance already marked",
      });
    }

    // ⏱ Late logic (optional)
    let status = "present";
    const now = new Date();
    const classStart = new Date(baseSession.date);
    const lateThreshold = 10 * 60 * 1000;

    if (now - classStart > lateThreshold) {
      status = "late";
    }

    // ✅ Create record
    const record = await AttendanceRecord.create({
      sessionId,
      studentId,
      status,
    });

    // 🔢 Update counters
    await AttendanceSession.findByIdAndUpdate(sessionId, {
      $inc: { totalPresent: 1 },
    });

    res.json({
      message: "Attendance marked successfully",
      status,
      record,
    });

  } catch (err) {
    res.status(400).json({
      message: "Invalid or expired QR",
    });
  }
};

/* ----------------------------------------------------- */
/* 📊 4. Get Session Attendance */
/* ----------------------------------------------------- */
export const getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const records = await AttendanceRecord.find({ sessionId })
      .populate("studentId", "name email");

    res.json({
      total: records.length,
      records,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------- */
/* 🔒 5. Submit Session */
/* ----------------------------------------------------- */
export const submitSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findByIdAndUpdate(
      sessionId,
      { status: "submitted" },
      { new: true }
    );

    res.json({
      message: "Session submitted",
      session,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------- */
/* 🧊 6. Lock Session */
/* ----------------------------------------------------- */
export const lockSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findByIdAndUpdate(
      sessionId,
      { status: "locked" },
      { new: true }
    );

    res.json({
      message: "Session locked",
      session,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------- */
/* ❌ 7. Delete Attendance Record */
/* ----------------------------------------------------- */
export const deleteAttendanceRecord = async (req, res) => {
  try {
    const { recordId } = req.params;

    await AttendanceRecord.findByIdAndDelete(recordId);

    res.json({
      message: "Record deleted",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};