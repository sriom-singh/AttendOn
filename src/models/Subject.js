import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true },
  description: { type: String },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  year: { type: Number, required: true, min: 1 },
  semester: { type: Number, required: true, min: 1 },
  type: {
    type: String,
    enum: ['theory', 'lab', 'project', 'tutorial'],
    default: 'theory',
  },
  creditHours: { type: Number, required: true, default: 3 },
  isElective: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Subject code must be unique within a course
subjectSchema.index({ code: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);