import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true },         // e.g. "A", "B", "Morning"
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  specializationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialization',
    default: null,                                  // null = no specialization
  },
  year: { type: Number, required: true, min: 1 },
  semester: { type: Number, required: true, min: 1 },
  maxStrength: { type: Number, required: true, default: 60 },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// A section name must be unique per course + year + semester + specialization
sectionSchema.index(
  { name: 1, courseId: 1, year: 1, semester: 1, specializationId: 1 },
  { unique: true }
);

export default mongoose.model('Section', sectionSchema);