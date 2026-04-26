import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true },
  description: { type: String },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  headOfDept: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required:false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Unique department code within an organization
departmentSchema.index({ code: 1, organizationId: 1 }, { unique: true });

export default mongoose.model('Department', departmentSchema);