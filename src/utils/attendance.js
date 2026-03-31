import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';

/**
 * Returns attendance % for a student in a given subject assignment.
 * @param {ObjectId} studentId
 * @param {ObjectId} subjectAssignmentId
 */
async function getAttendancePercentage(studentId, subjectAssignmentId) {
  const sessions = await AttendanceSession.find({
    subjectAssignmentId,
    status: { $in: ['submitted', 'locked'] },
  }).select('_id');

  const sessionIds = sessions.map(s => s._id);
  if (!sessionIds.length) return { attended: 0, total: 0, percentage: 0 };

  const attended = await AttendanceRecord.countDocuments({
    sessionId: { $in: sessionIds },
    studentId,
    status: { $in: ['present', 'late'] },
  });

  const total = sessionIds.length;
  return {
    attended,
    total,
    percentage: parseFloat(((attended / total) * 100).toFixed(2)),
  };
}

module.exports = { getAttendancePercentage };