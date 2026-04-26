// controllers/organizationController.js
import Organization from "../models/Organiztion.js";
import Department from "../models/Department.js";
import Course from "../models/Course.js";
import Student from "../models/Student.js";
import Staff from "../models/Staff.js";

export const createOrg = async (req, res) => {
  try {
    const { name, description, logo, contactEmail } = req.body;

    // Guard: org names should be globally unique
    const exists = await Organization.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (exists) {
      return res.status(409).json({
        message: "An organization with this name already exists",
      });
    }

    // createdBy always comes from the verified JWT — never from req.body
    const org = await Organization.create({
      name,
      description,
      logo,
      contactEmail,
      createdBy: req.user._id,
    });

    res.status(201).json({ org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllOrgs = async (req, res) => {
  try {
    const { isActive, search, page = 1, limit = 10 } = req.query;

    const matchStage = {};
    if (isActive !== undefined) matchStage.isActive = isActive === "true";
    if (search) {
      matchStage.name = { $regex: search, $options: "i" };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Aggregation pipeline — joins department count in one query
    const [result] = await Organization.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },

      // Facet runs two sub-pipelines in parallel on the same dataset
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: Number(limit) },

            // Look up department count for each org
            {
              $lookup: {
                from: "departments",
                localField: "_id",
                foreignField: "organizationId",
                as: "departments",
              },
            },
            {
              $addFields: {
                departmentCount: { $size: "$departments" },
              },
            },
            // Drop the raw departments array — we only want the count
            { $project: { departments: 0 } },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;

    res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      orgs: result.data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrgById = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Fetch departments + counts in parallel — no sequential awaits
    const [departments, courseCount, studentCount] = await Promise.all([
      Department.find({ organizationId: org._id, isActive: true })
        .select("name code headOfDept isActive")
        .populate("headOfDept", "employeeId designation"),

      // Course count: go through departments first
      Department.find({ organizationId: org._id })
        .distinct("_id")
        .then((deptIds) =>
          Course.countDocuments({ departmentId: { $in: deptIds } })
        ),

      // Student count: go through departments too
      Department.find({ organizationId: org._id })
        .distinct("_id")
        .then((deptIds) =>
          Student.countDocuments({
            departmentId: { $in: deptIds },
            isActive: true,
          })
        ),
    ]);

    res.status(200).json({
      org,
      departments,
      summary: {
        departmentCount: departments.length,
        courseCount,
        studentCount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// controllers/organizationController.js

export const getOrgsByCreator = async (req, res) => {
  try {
    // If :userId param is provided (admin fetching another user's orgs)
    // otherwise fall back to the logged-in user themselves
    const creatorId = req.params.userId || req.user._id;

    // If an admin is querying another user's orgs, validate the target exists
    if (req.params.userId) {
      const targetUser = await User.findById(creatorId).select("_id isActive");
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    const {
      isActive,
      search,
      page  = 1,
      limit = 10,
    } = req.query;

    const filter = { createdBy: creatorId };
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search)                 filter.name = { $regex: search, $options: "i" };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Organization.countDocuments(filter);

    const orgs = await Organization
      .find(filter)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      orgs,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateOrg = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Ownership check — superAdmin can edit any org,
    // a regular admin can only edit orgs they created
    const isOwner = org.createdBy.toString() === req.user._id.toString();
    const isSuper = req.admin.isSuperAdmin;

    if (!isOwner && !isSuper) {
      return res.status(403).json({
        message: "You can only edit organizations you created",
      });
    }

    // Whitelist — block updating createdBy, isActive, _id via this route
    const allowed = ["name", "description", "logo", "contactEmail"];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Check new name doesn't clash with another org (case-insensitive)
    if (updates.name) {
      const clash = await Organization.findOne({
        name: { $regex: `^${updates.name}$`, $options: "i" },
        _id: { $ne: org._id }, // exclude self
      });
      if (clash) {
        return res.status(409).json({
          message: "Organization name already taken",
        });
      }
    }

    const updated = await Organization.findByIdAndUpdate(org._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ org: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deactivateOrg = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const org = await Organization.findById(req.params.id).session(session);

    if (!org) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!org.isActive) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Organization is already inactive" });
    }

    // Write 1 — deactivate the org itself
    org.isActive = false;
    await org.save({ session });

    // Write 2 — cascade: deactivate all departments under this org
    const { modifiedCount } = await Department.updateMany(
      { organizationId: org._id },
      { isActive: false },
      { session }
    );

    await session.commitTransaction();

    res.status(200).json({
      message: "Organization deactivated",
      deptDeactivated: modifiedCount,
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// PATCH /api/organizations/:id/reactivate — mirror operation
export const reactivateOrg = async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Note: departments are NOT auto-reactivated on purpose —
    // admin should selectively reactivate them to avoid restoring
    // departments that were already inactive before the org was deactivated
    res.status(200).json({ org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOrgStats = async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const orgId = new mongoose.Types.ObjectId(req.params.id);

    const [stats] = await Organization.aggregate([
      { $match: { _id: orgId } },

      // Join all departments for this org
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "organizationId",
          as: "departments",
        },
      },

      // Unwind so we can look up courses per department
      { $unwind: { path: "$departments", preserveNullAndEmpty: true } },

      // Join courses per department
      {
        $lookup: {
          from: "courses",
          localField: "departments._id",
          foreignField: "departmentId",
          as: "departments.courses",
        },
      },

      // Join active staff per department
      {
        $lookup: {
          from: "staffs",
          localField: "departments._id",
          foreignField: "departmentId",
          as: "departments.staffList",
        },
      },

      // Re-group back to org level
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          isActive: { $first: "$isActive" },
          createdAt: { $first: "$createdAt" },
          departments: { $push: "$departments" },
          totalCourses: {
            $sum: { $size: { $ifNull: ["$departments.courses", []] } },
          },
          totalStaff: {
            $sum: { $size: { $ifNull: ["$departments.staffList", []] } },
          },
        },
      },

      // Compute final summary fields
      {
        $addFields: {
          totalDepartments: { $size: "$departments" },
        },
      },

      // Drop raw arrays — we only return the counts
      {
        $project: {
          name: 1,
          isActive: 1,
          createdAt: 1,
          totalDepartments: 1,
          totalCourses: 1,
          totalStaff: 1,
        },
      },
    ]);

    if (!stats) {
      return res.status(404).json({ message: "Organization not found" });
    }

    res.status(200).json({ stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
