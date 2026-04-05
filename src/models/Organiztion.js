import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },
  logo: { type: String },
  contactEmail: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);