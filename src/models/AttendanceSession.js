import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema(
  {
    subjectAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubjectAssignment",
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    date: { type: Date, required: true },
    slot: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"],
      required: true,
    },
    topic: { type: String }, // optional: what was taught this session
    status: {
      type: String,
      enum: ["draft", "submitted", "locked"],
      default: "draft",
      // draft   → staff is still marking
      // submitted → finalized by staff
      // locked  → admin/HOD has frozen it (no edits allowed)
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    radius: {
      type: Number, // in meters
      default: 50, // e.g. 50m classroom radius
    },
    totalPresent: { type: Number, default: 0 }, // denormalized counter for fast stats
    totalAbsent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Prevent duplicate sessions for the same subject+section on the same date+slot
attendanceSessionSchema.index(
  { subjectAssignmentId: 1, date: 1, slot: 1 },
  { unique: true },
  { location: "2dsphere" }
);

export default mongoose.model("AttendanceSession", attendanceSessionSchema);
