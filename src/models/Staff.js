import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  employeeId: { type: String, required: true, unique: true },
  designation: { type: String, required: true },
  qualifications: [{ type: String }],
  joiningDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);