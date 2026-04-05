import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true },
  description: { type: String },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  durationYears: { type: Number, required: true, min: 1 },
  totalSemesters: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Unique course code within a department
courseSchema.index({ code: 1, departmentId: 1 }, { unique: true });

export default mongoose.model('Course', courseSchema);