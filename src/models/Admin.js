import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    permissions: {
      type: [String],
      enum: [
        "manage_org",
        "manage_dept",
        "manage_courses",
        "manage_users",
        "all",
      ],
      default: ["all"],
    },
    isSuperAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
