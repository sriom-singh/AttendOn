 import AttendanceRecord from '../models/AttendanceRecord.js';
import mongoose from 'mongoose';

// GET /api/students/:id/attendance/summary?from=2024-01-01&to=2024-06-30
export const getStudentAttendanceSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const matchStage = {
      student: new mongoose.Types.ObjectId(req.params.id)
    };
    if (from || to) {
      matchStage.date = {};
      if (from) matchStage.date.$gte = new Date(from);
      if (to)   matchStage.date.$lte = new Date(to);
    }

    const [result] = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          present:       { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent:        { $sum: { $cond: [{ $eq: ['$status', 'absent']  }, 1, 0] } },
          late:          { $sum: { $cond: [{ $eq: ['$status', 'late']    }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalSessions: 1,
          present: 1, absent: 1, late: 1,
          attendancePercent: {
            $round: [{
              $multiply: [
                { $divide: ['$present', { $max: ['$totalSessions', 1] }] },
                100
              ]
            }, 2]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: result || { totalSessions: 0, present: 0, absent: 0, late: 0, attendancePercent: 0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sections/:id/attendance/report?from=&to=
// Returns every student in the section ranked by attendance %
export const getSectionAttendanceReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const report = await AttendanceRecord.aggregate([
      {
        $match: {
          section: new mongoose.Types.ObjectId(req.params.id),
          ...(Object.keys(dateFilter).length && { date: dateFilter })
        }
      },
      {
        $group: {
          _id:           '$student',
          totalSessions: { $sum: 1 },
          present:       { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent:        { $sum: { $cond: [{ $eq: ['$status', 'absent']  }, 1, 0] } }
        }
      },
      {
        $project: {
          totalSessions: 1, present: 1, absent: 1,
          attendancePercent: {
            $round: [{
              $multiply: [{ $divide: ['$present', { $max: ['$totalSessions', 1] }] }, 100]
            }, 2]
          }
        }
      },
      {
        $lookup: {
          from:         'students',
          localField:   '_id',
          foreignField: '_id',
          as:           'student',
          pipeline:     [{ $project: { name: 1, rollNumber: 1 } }]
        }
      },
      { $unwind: '$student' },
      { $sort:  { attendancePercent: -1 } }
    ]);

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/students/:id/attendance/subjects?from=&to=
// Breaks down attendance per subject for a student
export const getSubjectWiseBreakdown = async (req, res) => {
  try {
    const { from, to } = req.query;
    const matchStage = {
      student: new mongoose.Types.ObjectId(req.params.id)
    };
    if (from || to) {
      matchStage.date = {};
      if (from) matchStage.date.$gte = new Date(from);
      if (to)   matchStage.date.$lte = new Date(to);
    }

    const breakdown = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:           '$subject',
          totalSessions: { $sum: 1 },
          present:       { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent:        { $sum: { $cond: [{ $eq: ['$status', 'absent']  }, 1, 0] } },
          late:          { $sum: { $cond: [{ $eq: ['$status', 'late']    }, 1, 0] } }
        }
      },
      {
        $project: {
          totalSessions: 1, present: 1, absent: 1, late: 1,
          attendancePercent: {
            $round: [{
              $multiply: [{ $divide: ['$present', { $max: ['$totalSessions', 1] }] }, 100]
            }, 2]
          }
        }
      },
      {
        $lookup: {
          from:         'subjects',
          localField:   '_id',
          foreignField: '_id',
          as:           'subject',
          pipeline:     [{ $project: { name: 1, code: 1 } }]
        }
      },
      { $unwind: '$subject' },
      { $sort:  { 'subject.name': 1 } }
    ]);

    res.json({ success: true, data: breakdown });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sections/:id/attendance/low?threshold=75&from=&to=
// Returns students whose attendance % is below threshold (default 75)
export const getLowAttendanceStudents = async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold || 75);
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const students = await AttendanceRecord.aggregate([
      {
        $match: {
          section: new mongoose.Types.ObjectId(req.params.id),
          ...(Object.keys(dateFilter).length && { date: dateFilter })
        }
      },
      {
        $group: {
          _id:           '$student',
          totalSessions: { $sum: 1 },
          present:       { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }
        }
      },
      {
        $project: {
          totalSessions: 1, present: 1,
          attendancePercent: {
            $round: [{
              $multiply: [{ $divide: ['$present', { $max: ['$totalSessions', 1] }] }, 100]
            }, 2]
          }
        }
      },
      { $match: { attendancePercent: { $lt: threshold } } },
      {
        $lookup: {
          from:         'students',
          localField:   '_id',
          foreignField: '_id',
          as:           'student',
          pipeline:     [{ $project: { name: 1, rollNumber: 1, email: 1 } }]
        }
      },
      { $unwind: '$student' },
      { $sort:  { attendancePercent: 1 } }
    ]);

    res.json({
      success: true,
      data:    students,
      meta:    { threshold, count: students.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/students/:id/attendance/trend?groupBy=week&from=&to=
// groupBy: 'day' | 'week' | 'month'  (default: week)
export const getAttendanceTrend = async (req, res) => {
  try {
    const { groupBy = 'week', from, to } = req.query;
    const matchStage = {
      student: new mongoose.Types.ObjectId(req.params.id)
    };
    if (from || to) {
      matchStage.date = {};
      if (from) matchStage.date.$gte = new Date(from);
      if (to)   matchStage.date.$lte = new Date(to);
    }

    const dateGroupMap = {
      day:   { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } },
      week:  { year: { $year: '$date' }, week: { $isoWeek: '$date' } },
      month: { year: { $year: '$date' }, month: { $month: '$date' } }
    };

    const groupKey = dateGroupMap[groupBy] || dateGroupMap.week;

    const trend = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:           groupKey,
          totalSessions: { $sum: 1 },
          present:       { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          firstDate:     { $min: '$date' }
        }
      },
      {
        $project: {
          period:        '$_id',
          totalSessions: 1,
          present:       1,
          firstDate:     1,
          attendancePercent: {
            $round: [{
              $multiply: [{ $divide: ['$present', { $max: ['$totalSessions', 1] }] }, 100]
            }, 2]
          }
        }
      },
      { $sort: { firstDate: 1 } }
    ]);

    res.json({ success: true, data: trend, meta: { groupBy } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

