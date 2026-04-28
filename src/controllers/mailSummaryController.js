// mailSummaryController.js – pure backend code (NO JSX)
const Mail = require("../models/Mail");

exports.getMailSummary = async (req, res) => {
  try {
    const [statusCounts, priorityCounts, totalMails, unreadCount, recentMails] = await Promise.all([
      Mail.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Mail.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
      Mail.countDocuments({ isDeleted: false }),
      Mail.countDocuments({ isDeleted: false, lastOpenedAt: null }),
      Mail.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).select("from to subject status sentAt createdAt"),
    ]);

    const statusMap = {};
    statusCounts.forEach(s => statusMap[s._id] = s.count);
    const priorityMap = {};
    priorityCounts.forEach(p => priorityMap[p._id] = p.count);

    res.json({
      success: true,
      data: {
        total: totalMails,
        unread: unreadCount,
        byStatus: {
          sent: statusMap.sent || 0,
          draft: statusMap.draft || 0,
          failed: statusMap.failed || 0,
          scheduled: statusMap.scheduled || 0,
        },
        byPriority: {
          high: priorityMap.high || 0,
          normal: priorityMap.normal || 0,
          low: priorityMap.low || 0,
        },
        recentMails,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const daily = await Mail.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } },
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const formatted = daily.map(d => ({
      date: `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(d._id.day).padStart(2, "0")}`,
      total: d.total,
      sent: d.sent,
      draft: d.draft,
      failed: d.failed,
    }));

    res.json({ success: true, days, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTagSummary = async (req, res) => {
  try {
    const tags = await Mail.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.json({
      success: true,
      data: tags.map(t => ({ tag: t._id, count: t.count })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
