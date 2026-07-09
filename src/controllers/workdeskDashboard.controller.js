const Task = require("../models/task.model.js");

const getStageTracking = async (baseMatch, status) => {
    const [rows, counts] = await Promise.all([
        Task.find({ ...baseMatch, status })
            .sort({ updatedAt: -1, createdAt: -1 })
            .select(
                "serviceRequestId clientName clientDisplayId clientSource chaName serviceType subType assignedToName assignedToEmail"
            )
            .lean(),
        Task.aggregate([
            { $match: { ...baseMatch, status } },
            {
                $group: {
                    _id: "$assignedToName",
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    const countMap = new Map(counts.map((item) => [item._id || "", item.count]));
    return rows.map((row) => ({
        ...row,
        handledCount: countMap.get(row.assignedToName || "") || 0
    }));
};

const getWorkLevelTracking = (baseMatch, workLevel) =>
    Task.find({ ...baseMatch, workLevel })
        .sort({ updatedAt: -1, createdAt: -1 })
        .select(
            "serviceRequestId clientName clientDisplayId clientSource chaName serviceType subType assignedToName assignedToEmail status officialFee serviceCharges workLevel"
        )
        .lean();

const getActiveTaskTracking = (baseMatch) =>
    Task.find(baseMatch)
        .sort({ updatedAt: -1, createdAt: -1 })
        .select(
            "serviceRequestId clientName clientDisplayId clientSource chaName serviceType subType assignedToName assignedToEmail status officialFee serviceCharges workLevel jobWorkStatus"
        )
        .lean();

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

        const activeWorkLevelMatch = {
            ...baseMatch,
            jobWorkStatus: { $nin: ["Completed", "Strike Off"] },
            status: { $nin: ["Pending for Invoicing", "Invoice Raised", "Invoice Paid", "Invoice Write-Off", "Strike Off"] }
        };

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
            pendingForInvoicingRows,
            invoiceRaisedRows,
            invoicePaidRows,
            invoiceWriteOffRows,
            overdue,
            pending,
            highRisk,
            pendency,
            important,
            activeTaskRows,
            highRiskRows,
            pendencyRows,
            importantRows
        ] = await Promise.all([
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfToday } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfWeek } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfMonth } }),
            Task.countDocuments({ ...baseMatch, createdAt: { $gte: startOfYear } }),
            Task.countDocuments(activeWorkLevelMatch),
            Task.countDocuments({
                ...baseMatch,
                status: "Invoice Paid"
            }),
            Task.countDocuments({
                ...baseMatch,
                status: {
                    $in: ["In Process", "Draft Sent for Approval", "Deficiency Raised"]
                },
                jobWorkStatus: { $nin: ["Completed", "Strike Off"] }
            }),
            Task.aggregate([
                { $match: activeWorkLevelMatch },
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
            getStageTracking(baseMatch, "Pending for Invoicing"),
            getStageTracking(baseMatch, "Invoice Raised"),
            getStageTracking(baseMatch, "Invoice Paid"),
            getStageTracking(baseMatch, "Invoice Write-Off"),
            Task.countDocuments({
                ...activeWorkLevelMatch,
                slaBreached: true,
            }),
            Task.countDocuments({
                ...activeWorkLevelMatch,
                status: { $nin: ["Approved", ...activeWorkLevelMatch.status.$nin] }
            }),
            Task.countDocuments({ ...activeWorkLevelMatch, workLevel: "High Risk" }),
            Task.countDocuments({ ...activeWorkLevelMatch, workLevel: "Pendency" }),
            Task.countDocuments({ ...activeWorkLevelMatch, workLevel: "Important" }),
            getActiveTaskTracking(activeWorkLevelMatch),
            getWorkLevelTracking(activeWorkLevelMatch, "High Risk"),
            getWorkLevelTracking(activeWorkLevelMatch, "Pendency"),
            getWorkLevelTracking(activeWorkLevelMatch, "Important")
        ]);

        res.json({
            success: true,
            data: {
                volume: { daily, weekly, monthly, yearly },
                summary: {
                    totalActive,
                    completed,
                    critical,
                    highRisk,
                    pendency,
                    important,
                    totalPendingForInvoicing: pendingForInvoicingRows.length,
                    totalInvoiceRaised: invoiceRaisedRows.length,
                    totalInvoicePaid: invoicePaidRows.length,
                    totalInvoiceWriteOff: invoiceWriteOffRows.length
                },
                staffLoad,
                staffReadyInvoice,
                invoiceTracking: {
                    pendingForInvoicing: pendingForInvoicingRows,
                    invoiceRaised: invoiceRaisedRows,
                    invoicePaid: invoicePaidRows,
                    invoiceWriteOff: invoiceWriteOffRows
                },
                workLevelTracking: {
                    highRisk: highRiskRows,
                    pendency: pendencyRows,
                    important: importantRows
                },
                activeTasks: activeTaskRows,
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
