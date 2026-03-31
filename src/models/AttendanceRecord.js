import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    required: true,
  },
  remarks: { type: String },   // e.g. "medical leave", "late by 10 min"
}, { timestamps: true });

// A student can only have one record per session
attendanceRecordSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true }
);

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);