const Task = require("../models/task.model.js");
const { TASK_STATUSES } = require("../models/task.model.js");
const Client = require("../models/client.model.js");
const User = require("../models/workdeskUser.model.js");
const Invoice = require("../models/invoice.model.js");
const sendEmail = require("../config/email.js");
const { getServiceTypesConfig } = require("../utils/workdeskSettings.js");

const generateSR = () =>
  `SR-${new Date().getFullYear().toString().slice(-2)}${Math.floor(
    1000 + Math.random() * 9000
  )}`;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildAllocationEmail = ({ task, client, staff, adminName }) => {
  const subject = `New Work Allocation: ${task.serviceRequestId} - ${task.clientName}`;

  const lines = [
    `Hello ${staff.name},`,
    "",
    "A new work item has been allocated to you in Eximinq Desk.",
    "",
    `Service Request ID: ${task.serviceRequestId}`,
    `Client ID: ${task.clientDisplayId || "-"}`,
    `Client Name: ${task.clientName}`,
    `Client Source: ${task.clientSource || "-"}`,
    `CHA Name: ${task.chaName || "-"}`,
    `Service Type: ${task.serviceType}`,
    `Sub Type: ${task.subType}`,
    `Assigned To: ${task.assignedToName}`,
    `Allocated By: ${adminName || "Admin"}`,
    `Status: ${task.status}`,
    `SLA (Days): ${task.slaDays}`,
    `Deadline: ${formatDateTime(task.deadline)}`,
    `Client Sender Email: ${task.emailSender || "-"}`,
    `Received Date & Time: ${formatDateTime(task.emailDate)}`,
    `Special Instructions: ${task.details || "-"}`,
    "",
    "Client contact details",
    `Contact Person: ${client.contactPerson || "-"}`,
    `Contact Mobile: ${client.contactMobile || "-"}`,
    `Contact Email: ${client.contactEmail || "-"}`,
    "",
    "Please log in to the Workdesk panel to manage this request.",
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Hello ${staff.name},</p>
      <p>A new work item has been allocated to you in <strong>Eximinq Desk</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tbody>
          ${[
            ["Service Request ID", task.serviceRequestId],
            ["Client ID", task.clientDisplayId || "-"],
            ["Client Name", task.clientName],
            ["Client Source", task.clientSource || "-"],
            ["CHA Name", task.chaName || "-"],
            ["Service Type", task.serviceType],
            ["Sub Type", task.subType],
            ["Assigned To", task.assignedToName],
            ["Allocated By", adminName || "Admin"],
            ["Status", task.status],
            ["SLA (Days)", task.slaDays],
            ["Deadline", formatDateTime(task.deadline)],
            ["Client Sender Email", task.emailSender || "-"],
            ["Received Date & Time", formatDateTime(task.emailDate)],
            ["Special Instructions", task.details || "-"],
            ["Contact Person", client.contactPerson || "-"],
            ["Contact Mobile", client.contactMobile || "-"],
            ["Contact Email", client.contactEmail || "-"],
          ]
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: 600; width: 220px;">${label}</td>
                  <td style="padding: 8px; border: 1px solid #e5e7eb;">${value}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      <p style="margin-top: 16px;">Please log in to the Workdesk panel to manage this request.</p>
    </div>
  `;

  return {
    subject,
    text: lines.join("\n"),
    html,
  };
};

const createTask = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can allocate work" });
  }

  const {
    clientId,
    serviceType,
    subType,
    assignedToUserId,
    slaDays,
    details,
    emailSender,
    emailDate,
  } = req.body;

  if (!clientId || !serviceType || !subType || !assignedToUserId) {
    return res.status(400).json({
      message: "Client, service type, sub type, and assigned staff are required",
    });
  }

  const serviceTypes = await getServiceTypesConfig();
  if (!serviceTypes[serviceType]) {
    return res.status(400).json({ message: "Invalid service type" });
  }

  if (!serviceTypes[serviceType].includes(subType)) {
    return res.status(400).json({ message: "Invalid sub type for service type" });
  }

  const client = await Client.findById(clientId);
  if (!client) {
    return res.status(400).json({ message: "Invalid client" });
  }

  const staff = await User.findById(assignedToUserId);
  if (!staff || staff.role !== "STAFF") {
    return res.status(400).json({ message: "Invalid staff user" });
  }

  const normalizedSenderEmail = emailSender?.trim().toLowerCase();
  if (normalizedSenderEmail) {
    const conflictingUser = await User.findOne({ email: normalizedSenderEmail }).select(
      "_id email role"
    );

    if (conflictingUser) {
      return res.status(400).json({
        message:
          "Client Sender Email cannot be a Workdesk staff/admin email. Please enter the client's email ID.",
      });
    }
  }

  const finalSlaDays = Number(slaDays) > 0 ? Number(slaDays) : 5;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + finalSlaDays);

  const task = await Task.create({
    serviceRequestId: generateSR(),
    clientId: client._id,
    clientName: client.name,
    clientDisplayId: client.clientId,
    clientSource: client.source,
    chaId: client.chaId || null,
    chaName: client.chaName || null,
    serviceType,
    subType,
    assignedToUserId: staff._id,
    assignedToName: staff.name,
    assignedToEmail: staff.email,
    slaDays: finalSlaDays,
    deadline,
    emailSender: normalizedSenderEmail || null,
    emailDate: emailDate ? new Date(emailDate) : null,
    details: details || "",
    status: "Request Initiated",
    history: [
      {
        status: "Request Initiated",
        note: "Task allocated by admin",
        timestamp: new Date(),
      },
    ],
    createdByAdminId: req.user.id,
  });

  let emailInfo = { sent: false };
  try {
    const emailPayload = buildAllocationEmail({
      task,
      client,
      staff,
      adminName: req.user.name,
    });

    await sendEmail({
      to: staff.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    });

    emailInfo = { sent: true, to: staff.email };
  } catch (error) {
    console.error("Task allocation email failed:", error);
    emailInfo = {
      sent: false,
      to: staff.email,
      error: error.message,
    };
  }

  res.status(201).json({
    ...task.toObject(),
    notification: emailInfo,
  });
};

const getTasks = async (req, res) => {
  const filter = req.user.role === "ADMIN" ? {} : { assignedToUserId: req.user.id };

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .select(
      "serviceRequestId clientName clientDisplayId clientSource chaName serviceType subType assignedToName assignedToEmail deadline emailSender status details createdAt"
    )
    .lean();

  res.json(tasks);
};

const getTaskById = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (req.user.role === "STAFF" && task.assignedToUserId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const invoice = await Invoice.findOne({ taskId: task._id }).sort({ createdAt: -1 }).lean();

  res.json({
    ...task.toObject(),
    invoice,
  });
};

const updateTaskStatus = async (req, res) => {
  const { status } = req.body;

  if (!TASK_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const task = await Task.findById(req.params.id).select("_id assignedToUserId status slaBreached");
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (req.user.role === "STAFF" && task.assignedToUserId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (task.status === status) {
    return res.status(400).json({ message: "Task already in this status" });
  }

  const previousStatus = task.status;
  const timestamp = new Date();

  const updatedTask = await Task.findOneAndUpdate(
    { _id: req.params.id, status: previousStatus },
    {
      $set: {
        status,
        updatedAt: timestamp,
        ...(status === "Invoice Paid" ? { slaBreached: false } : {}),
      },
      $push: {
        history: {
          fromStatus: previousStatus,
          toStatus: status,
          action: "STATUS_CHANGE",
          performedById: req.user.id,
          performedByName: req.user.name,
          note: `Status changed from '${previousStatus}' to '${status}'`,
          timestamp,
        },
      },
    },
    { new: true }
  );

  if (!updatedTask) {
    return res.status(409).json({
      message: "Task status was updated by another user. Please refresh and try again.",
    });
  }

  res.json(updatedTask);
};

const addComment = async (req, res) => {
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ message: "Comment text required" });
  }

  const task = await Task.findById(req.params.id).select("_id assignedToUserId");
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (req.user.role === "STAFF" && task.assignedToUserId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const updatedTask = await Task.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        comments: {
          text,
          author: req.user.name,
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  res.json(updatedTask);
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  addComment,
};
