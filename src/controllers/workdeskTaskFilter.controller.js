const Task = require("../models/task.model.js");

const COMPLETED_TASK_STATUSES = ["Pending for Invoicing", "Invoice Raised", "Invoice Paid", "Invoice Write-Off"];
const STRIKE_OFF_STATUS = "Strike Off";
const activeQueueQuery = () => ({
  jobWorkStatus: { $nin: ["Completed", STRIKE_OFF_STATUS] },
  status: { $nin: [...COMPLETED_TASK_STATUSES, STRIKE_OFF_STATUS] }
});

const filterWorkdeskFilterTasks = async (req, res) => {
  try {
    const {
      tab = "ALL",
      search = "",
      source = "ALL",
      status = "ALL",
      page = 1,
      limit = 20
    } = req.body;

    const user = req.user; // injected by auth middleware
    let query = activeQueueQuery();

    /* ================= TAB FILTER ================= */

    if (tab === "HIGH_RISK") {
      query.workLevel = "High Risk";
    }

    if (tab === "PENDENCY") {
      query.workLevel = "Pendency";
    }

    if (tab === "IMPORTANT") {
      query.workLevel = "Important";
    }

    /* ================= SEARCH ================= */

    if (search.trim()) {
      query.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { serviceRequestId: { $regex: search, $options: "i" } },
        { emailSender: { $regex: search, $options: "i" } },
        { chaName: { $regex: search, $options: "i" } },
        { clientDisplayId: { $regex: search, $options: "i" } }
      ];
    }

    /* ================= SOURCE ================= */

    if (source === "DIRECT") {
      query.clientSource = "Direct";
    }

    if (source === "CHA") {
      query.clientSource = "CHA";
    }

    /* ================= STATUS ================= */

    if (status !== "ALL") {
      query.status = COMPLETED_TASK_STATUSES.includes(status) || status === STRIKE_OFF_STATUS
        ? "__NO_ACTIVE_QUEUE_STATUS__"
        : status;
    }

    /* ================= ROLE RESTRICTION ================= */

    if (user.role !== "ADMIN") {
      query.assignedToUserId = user.id;
    }

    /* ================= QUERY ================= */

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (err) {
    console.error("Workdesk filter error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch workdesk tasks"
    });
  }
};

module.exports = { filterWorkdeskFilterTasks };
