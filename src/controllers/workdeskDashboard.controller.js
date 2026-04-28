const WorkdeskTask = require("../models/workdeskTaskFilter.model.js");

const getWorkdeskDashboardAnalytics = async (req, res) => {
    try {
        const user = req.user;
        const now = new Date();

        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);

        const startOfYear = new Date(new Date().getFullYear(), 0, 1);

        let baseMatch = {};
        if (user.role === "STAFF") {
            baseMatch.assignedToUserId = user.id;
        }

        /* ================= REQUEST VOLUME ================= */

        const [daily, weekly, monthly, yearly] = await Promise.all([
            WorkdeskTask.countDocuments({ ...baseMatch, createdAt: { $gte: startOfToday } }),
            WorkdeskTask.countDocuments({ ...baseMatch, createdAt: { $gte: startOfWeek } }),
            WorkdeskTask.countDocuments({ ...baseMatch, createdAt: { $gte: startOfMonth } }),
            WorkdeskTask.countDocuments({ ...baseMatch, createdAt: { $gte: startOfYear } })
        ]);

        /* ================= STATUS COUNTS ================= */

        const totalActive = await WorkdeskTask.countDocuments({
            ...baseMatch,
            status: { $ne: "Invoice Paid" }
        });

        const completed = await WorkdeskTask.countDocuments({
            ...baseMatch,
            status: "Invoice Paid"
        });

        const critical = await WorkdeskTask.countDocuments({
            ...baseMatch,
            status: {
                $in: ["In Process", "Draft Sent for Approval", "Deficiency Raised"]
            }
        });

        /* ================= STAFF LOAD ================= */

        const staffLoad = await WorkdeskTask.aggregate([
            { $match: { ...baseMatch, status: { $ne: "Invoice Paid" } } },
            {
                $group: {
                    _id: "$assignedToName",
                    count: { $sum: 1 }
                }
            }
        ]);

        const staffReadyInvoice = await WorkdeskTask.aggregate([
            {
                $match: {
                    ...baseMatch,
                    status: "Pending for Invoicing"
                }
            },
            {
                $group: {
                    _id: "$assignedToName",
                    count: { $sum: 1 }
                }
            }
        ]);

        /* ================= RISK ================= */

        const overdue = await WorkdeskTask.countDocuments({
            ...baseMatch,
            slaBreached: true,
            status: { $ne: "Invoice Paid" }
        });

        const pending = await WorkdeskTask.countDocuments({
            ...baseMatch,
            status: { $nin: ["Invoice Paid", "Approved"] }
        });

        res.json({
            success: true,
            data: {
                volume: { daily, weekly, monthly, yearly },
                summary: {
                    totalActive,
                    completed,
                    critical
                },
                staffLoad,
                staffReadyInvoice,
                risk: {
                    overdue,
                    pending
                }
            }
        });
    } catch (err) {
        console.error("Dashboard analytics error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard analytics"
        });
    }
};

module.exports = { getWorkdeskDashboardAnalytics };
