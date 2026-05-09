const Task = require("../models/task.model.js");

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

        const [
            daily,
            weekly,
            monthly,
            yearly,
            totalActive,
            completed,
            critical,
            staffLoad,
            staffReadyInvoice,
            overdue,
            pending
        ] = await Promise.all([
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfToday } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfWeek } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfMonth } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfYear } }),
            Task.countDocuments({
                ...baseMatch,
                status: { $ne: "Invoice Paid" }
            }),
            Task.countDocuments({
                ...baseMatch,
                status: "Invoice Paid"
            }),
            Task.countDocuments({
                ...baseMatch,
                status: {
                    $in: ["In Process", "Draft Sent for Approval", "Deficiency Raised"]
                }
            }),
            Task.aggregate([
                { $match: { ...baseMatch, status: { $ne: "Invoice Paid" } } },
                {
                    $group: {
                        _id: "$assignedToName",
                        count: { $sum: 1 }
                    }
                }
            ]),
            Task.aggregate([
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
            ]),
            Task.countDocuments({
                ...baseMatch,
                slaBreached: true,
                status: { $ne: "Invoice Paid" }
            }),
            Task.countDocuments({
                ...baseMatch,
                status: { $nin: ["Invoice Paid", "Approved"] }
            })
        ]);

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
