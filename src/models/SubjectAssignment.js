import mongoose from 'mongoose';    

const subjectAssignmentSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  academicYear: {
    type: String,
    required: true,   // e.g. "2024-25"
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// A subject can only be assigned once per section per academic year
subjectAssignmentSchema.index(
  { subjectId: 1, sectionId: 1, academicYear: 1 },
  { unique: true }
);

export default mongoose.model('SubjectAssignment', subjectAssignmentSchema);