const Task = require("../models/task.model.js");
const { TASK_STATUSES, WORK_LEVELS, JOB_WORK_STATUSES } = require("../models/task.model.js");
const Client = require("../models/client.model.js");
const User = require("../models/workdeskUser.model.js");
const Invoice = require("../models/invoice.model.js");
const Counter = require("../models/counter.model.js");
const sendEmail = require("../config/email.js");
const { getServiceTypesConfig } = require("../utils/workdeskSettings.js");
const SERVICE_REQUEST_COUNTER_NAME = "serviceRequestId";
const SERVICE_REQUEST_SEQUENCE_START = 1200;
const INVOICE_MANAGED_TASK_STATUSES = ["Invoice Raised", "Invoice Paid"];
const ADMIN_DIRECT_TASK_STATUSES = ["Invoice Write-Off"];
const STRIKE_OFF_STATUS = "Strike Off";
const INVOICE_LOCKED_STATUSES = ["Invoice Raised", "Invoice Paid", "Invoice Write-Off"];

const generateSR = async () => {
  while (true) {
    await Counter.updateOne(
      { name: SERVICE_REQUEST_COUNTER_NAME },
      {
        $setOnInsert: {
          name: SERVICE_REQUEST_COUNTER_NAME,
          value: SERVICE_REQUEST_SEQUENCE_START - 1,
        },
      },
      {
        upsert: true,
      }
    );

    const counter = await Counter.findOneAndUpdate(
      { name: SERVICE_REQUEST_COUNTER_NAME },
      {
        $inc: { value: 1 },
      },
      {
        new: true,
        upsert: true,
      }
    );

    const serviceRequestId = `SR-${counter.value}`;
    const existingTask = await Task.exists({ serviceRequestId });

    if (!existingTask) {
      return serviceRequestId;
    }
  }
};

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

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && String(value).trim() !== "") {
    return formatAmount(numericValue);
  }
  return String(value);
};

const parseOptionalAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalizedValue =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
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
    `Work Level: ${task.workLevel || "-"}`,
    `Allocated By: ${adminName || "Admin"}`,
    `Status: ${task.status}`,
    `SLA (Days): ${task.slaDays}`,
    `Deadline: ${formatDateTime(task.deadline)}`,
    `Client Sender Email: ${task.emailSender || "-"}`,
    `Received Date & Time: ${formatDateTime(task.emailDate)}`,
    `Special Instructions: ${task.details || "-"}`,
    `Quotation: ${formatDisplayValue(task.quotation)}`,
    `Official Fee: ${formatAmount(task.officialFee)}`,
    `Service Charges: ${formatAmount(task.serviceCharges)}`,
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
            ["Work Level", task.workLevel || "-"],
            ["Allocated By", adminName || "Admin"],
            ["Status", task.status],
            ["SLA (Days)", task.slaDays],
            ["Deadline", formatDateTime(task.deadline)],
            ["Client Sender Email", task.emailSender || "-"],
            ["Received Date & Time", formatDateTime(task.emailDate)],
            ["Special Instructions", task.details || "-"],
            ["Quotation", formatDisplayValue(task.quotation)],
            ["Official Fee", formatAmount(task.officialFee)],
            ["Service Charges", formatAmount(task.serviceCharges)],
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
    quotation,
    officialFee,
    serviceCharges,
    workLevel,
  } = req.body;

  const normalizedQuotation = typeof quotation === "string" ? quotation.trim() : "";
  const normalizedWorkLevel = typeof workLevel === "string" ? workLevel.trim() : "";
  const normalizedOfficialFee = parseOptionalAmount(officialFee);
  const normalizedServiceCharges = parseOptionalAmount(serviceCharges);

  if (normalizedWorkLevel && !WORK_LEVELS.includes(normalizedWorkLevel)) {
    return res.status(400).json({ message: "Invalid work level" });
  }

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

  const createdTask = await Task.create({
    serviceRequestId: await generateSR(),
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
    workLevel: normalizedWorkLevel,
    jobWorkStatus: "Active",
    slaDays: finalSlaDays,
    deadline,
    emailSender: normalizedSenderEmail || null,
    emailDate: emailDate ? new Date(emailDate) : null,
    details: details || "",
    quotation: normalizedQuotation,
    officialFee: normalizedOfficialFee,
    serviceCharges: normalizedServiceCharges,
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

  const task = await Task.findByIdAndUpdate(
    createdTask._id,
    {
      $set: {
        quotation: normalizedQuotation,
        officialFee: normalizedOfficialFee,
        serviceCharges: normalizedServiceCharges,
        workLevel: normalizedWorkLevel,
      },
    },
    { new: true }
  );

  if (!task) {
    return res.status(500).json({ message: "Task created but failed to reload saved data" });
  }

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

  const responseTask = task.toObject();

  res.status(201).json({
    ...responseTask,
    quotation: normalizedQuotation,
    officialFee: normalizedOfficialFee,
    serviceCharges: normalizedServiceCharges,
    workLevel: normalizedWorkLevel,
    notification: emailInfo,
  });
};

const updateTaskDetails = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can edit allocated work" });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const {
    serviceType,
    subType,
    assignedToUserId,
    slaDays,
    emailSender,
    emailDate,
    details,
    quotation,
    officialFee,
    serviceCharges,
    workLevel,
  } = req.body || {};

  const isInvoiceLocked = INVOICE_LOCKED_STATUSES.includes(task.status);
  const hasCommercialEdit = ["quotation", "officialFee", "serviceCharges"].some((field) =>
    Object.prototype.hasOwnProperty.call(req.body || {}, field)
  );

  if (isInvoiceLocked && hasCommercialEdit) {
    return res.status(400).json({
      message: "Invoice-related details cannot be edited after invoice is raised or paid",
    });
  }

  const nextServiceType =
    typeof serviceType === "string" && serviceType.trim() ? serviceType.trim() : task.serviceType;
  const nextSubType =
    typeof subType === "string" && subType.trim() ? subType.trim() : task.subType;

  if (nextServiceType !== task.serviceType || nextSubType !== task.subType) {
    const serviceTypes = await getServiceTypesConfig();
    if (!serviceTypes[nextServiceType]) {
      return res.status(400).json({ message: "Invalid service type" });
    }

    if (!serviceTypes[nextServiceType].includes(nextSubType)) {
      return res.status(400).json({ message: "Invalid sub type for service type" });
    }
  }

  let nextStaff = null;
  if (assignedToUserId && String(assignedToUserId) !== String(task.assignedToUserId)) {
    nextStaff = await User.findById(assignedToUserId);
    if (!nextStaff || nextStaff.role !== "STAFF") {
      return res.status(400).json({ message: "Invalid staff user" });
    }
  }

  const normalizedWorkLevel = typeof workLevel === "string" ? workLevel.trim() : undefined;
  if (normalizedWorkLevel !== undefined && normalizedWorkLevel && !WORK_LEVELS.includes(normalizedWorkLevel)) {
    return res.status(400).json({ message: "Invalid work level" });
  }

  const normalizedSenderEmail =
    typeof emailSender === "string" ? emailSender.trim().toLowerCase() : undefined;
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

  task.serviceType = nextServiceType;
  task.subType = nextSubType;

  if (nextStaff) {
    const previousStaffName = task.assignedToName || "Unassigned";
    task.assignedToUserId = nextStaff._id;
    task.assignedToName = nextStaff.name;
    task.assignedToEmail = nextStaff.email;
    task.history.push({
      fromStatus: previousStaffName,
      toStatus: nextStaff.name,
      action: "STAFF_REASSIGNED",
      performedById: req.user.id,
      performedByName: req.user.name,
      note: `Assigned staff changed from '${previousStaffName}' to '${nextStaff.name}'`,
      timestamp: new Date(),
    });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "slaDays")) {
    const normalizedSlaDays = Number(slaDays);
    if (!Number.isFinite(normalizedSlaDays) || normalizedSlaDays <= 0) {
      return res.status(400).json({ message: "SLA days must be greater than zero" });
    }
    task.slaDays = normalizedSlaDays;
    const deadline = new Date(task.createdAt || Date.now());
    deadline.setDate(deadline.getDate() + normalizedSlaDays);
    task.deadline = deadline;
  }

  if (normalizedSenderEmail !== undefined) {
    task.emailSender = normalizedSenderEmail || null;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "emailDate")) {
    task.emailDate = emailDate ? new Date(emailDate) : null;
  }

  if (typeof details === "string") {
    task.details = details;
  }

  if (normalizedWorkLevel !== undefined) {
    task.workLevel = normalizedWorkLevel;
  }

  if (!isInvoiceLocked) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "quotation")) {
      task.quotation = typeof quotation === "string" ? quotation.trim() : "";
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "officialFee")) {
      task.officialFee = parseOptionalAmount(officialFee);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "serviceCharges")) {
      task.serviceCharges = parseOptionalAmount(serviceCharges);
    }
  }

  await task.save();

  const invoice = await Invoice.findOne({ taskId: task._id }).sort({ createdAt: -1 }).lean();
  res.json({
    ...task.toObject(),
    invoice,
  });
};

const getTasks = async (req, res) => {
  const isAdmin = req.user.role === "ADMIN";
  const filter = isAdmin
    ? {}
    : {
        assignedToUserId: req.user.id,
        status: { $ne: STRIKE_OFF_STATUS },
        jobWorkStatus: { $ne: STRIKE_OFF_STATUS },
      };

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .select(
      "serviceRequestId clientName clientDisplayId clientSource chaName serviceType subType assignedToUserId assignedToName assignedToEmail workLevel jobWorkStatus deadline emailSender status details quotation officialFee serviceCharges createdAt"
    )
    .lean();

  res.json(tasks);
};

const getTaskById = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const isAdmin = req.user.role === "ADMIN";

  if (!isAdmin && task.assignedToUserId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!isAdmin && (task.status === STRIKE_OFF_STATUS || task.jobWorkStatus === STRIKE_OFF_STATUS)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const invoice = isAdmin
    ? await Invoice.findOne({ taskId: task._id }).sort({ createdAt: -1 }).lean()
    : null;

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

  if (status === STRIKE_OFF_STATUS && req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can strike off tasks" });
  }

  if (ADMIN_DIRECT_TASK_STATUSES.includes(status) && req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can write off invoices" });
  }

  if (INVOICE_MANAGED_TASK_STATUSES.includes(status)) {
    return res.status(400).json({
      message: "Invoice statuses can only be managed from Invoice Management",
    });
  }

  const task = await Task.findById(req.params.id).select("_id assignedToUserId status slaBreached");
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (req.user.role !== "ADMIN" && task.assignedToUserId.toString() !== req.user.id) {
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
        ...(status === "Invoice Paid" || status === "Invoice Write-Off" ? { slaBreached: false } : {}),
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

const updateTaskJobWork = async (req, res) => {
  const { jobWorkStatus } = req.body;

  if (!JOB_WORK_STATUSES.includes(jobWorkStatus) || jobWorkStatus === "Active") {
    return res.status(400).json({ message: "Invalid job work status" });
  }

  const task = await Task.findById(req.params.id).select(
    "_id assignedToUserId jobWorkStatus status"
  );
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (req.user.role !== "ADMIN" && task.assignedToUserId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (task.jobWorkStatus === jobWorkStatus) {
    return res.status(400).json({ message: "Task already in this job work status" });
  }

  const previousJobWorkStatus = task.jobWorkStatus || "Active";
  const timestamp = new Date();

  const updatedTask = await Task.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        jobWorkStatus,
        updatedAt: timestamp,
      },
      $push: {
        history: {
          fromStatus: previousJobWorkStatus,
          toStatus: jobWorkStatus,
          action: "JOB_WORK_UPDATE",
          performedById: req.user.id,
          performedByName: req.user.name,
          note:
            jobWorkStatus === "Completed"
              ? "Job work marked as completed"
              : "Task marked as strike off",
          timestamp,
        },
      },
    },
    { new: true }
  );

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

  if (req.user.role !== "ADMIN" && task.assignedToUserId.toString() !== req.user.id) {
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
  updateTaskDetails,
  getTasks,
  getTaskById,
  updateTaskStatus,
  updateTaskJobWork,
  addComment,
};
