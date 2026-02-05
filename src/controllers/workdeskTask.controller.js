import Task from "../models/task.model.js";

import { TASK_STATUSES, STATUS_TRANSITIONS } from "../models/task.model.js";

import Client from "../models/client.model.js";
import User from "../models/workdeskUser.model.js";
import { DEFAULT_SERVICE_TYPES } from "../constants/serviceTypes.js"; 

const generateSR = () =>
  `SR-${new Date().getFullYear().toString().slice(-2)}${Math.floor(
    1000 + Math.random() * 9000
  )}`;

export const createTask = async (req, res) => {
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
    emailDate
  } = req.body;

  // ✅ HARD VALIDATION (NON-NEGOTIABLE)
  if (!clientId || !serviceType || !subType || !assignedToUserId) {
    return res.status(400).json({
      message: "Client, service type, sub type, and assigned staff are required"
    });
  }

  // ✅ Validate serviceType
  if (!DEFAULT_SERVICE_TYPES[serviceType]) {
    return res.status(400).json({ message: "Invalid service type" });
  }

  // ✅ Validate subType belongs to serviceType
  if (!DEFAULT_SERVICE_TYPES[serviceType].includes(subType)) {
    return res.status(400).json({ message: "Invalid sub type for service type" });
  }

  // Validate client
  const client = await Client.findById(clientId);
  if (!client) {
    return res.status(400).json({ message: "Invalid client" });
  }

  // Validate staff
  const staff = await User.findById(assignedToUserId);
  if (!staff || staff.role !== "STAFF") {
    return res.status(400).json({ message: "Invalid staff user" });
  }

  // SLA (default 5 days, must be > 0)
  const finalSlaDays = Number(slaDays) > 0 ? Number(slaDays) : 5;
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + finalSlaDays);

  const task = await Task.create({
    serviceRequestId: generateSR(),

    // Client snapshot
    clientId: client._id,
    clientName: client.name,
    clientDisplayId: client.clientId,
    clientSource: client.source,
    chaId: client.chaId || null,
    chaName: client.chaName || null,

    // Service
    serviceType,
    subType,

    // Assignment
    assignedToUserId: staff._id,
    assignedToName: staff.name,

    // SLA
    slaDays: finalSlaDays,
    deadline,

    // Email
    emailSender: emailSender || null,
    emailDate: emailDate ? new Date(emailDate) : null,

    details: details || "",

    // Workflow
    status: "Request Initiated",
    history: [
      {
        status: "Request Initiated",
        note: "Task allocated by admin",
        timestamp: new Date()
      }
    ],

    createdByAdminId: req.user.id
  });

  res.status(201).json(task);
};

export const getTasks = async (req, res) => {
  const filter =
    req.user.role === "ADMIN"
      ? {}
      : { assignedToUserId: req.user.id };

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .select(
      "serviceRequestId clientName serviceType subType status deadline assignedToName createdAt"
    );

  res.json(tasks);
};

export const updateTaskStatus = async (req, res) => {
  const { status } = req.body;

  if (!TASK_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (
    req.user.role === "STAFF" &&
    task.assignedToUserId.toString() !== req.user.id
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (task.status === status) {
    return res.status(400).json({ message: "Task already in this status" });
  }

  const allowedNext = STATUS_TRANSITIONS[task.status] || [];
  if (!allowedNext.includes(status)) {
    return res.status(400).json({
      message: `Cannot move from '${task.status}' to '${status}'`
    });
  }

  const previousStatus = task.status;

  task.status = status;

  // SLA auto-clear if completed
  if (status === "Invoice Paid") {
    task.slaBreached = false;
  }

  task.history.push({
    fromStatus: previousStatus,
    toStatus: status,
    action: "STATUS_CHANGE",
    performedById: req.user.id,
    performedByName: req.user.name,
    note: `Status changed from '${previousStatus}' to '${status}'`,
    timestamp: new Date()
  });

  await task.save();
  res.json(task);
};

export const addComment = async (req, res) => {
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ message: "Comment text required" });
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (
    req.user.role === "STAFF" &&
    task.assignedToUserId.toString() !== req.user.id
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }

  task.comments.push({
    text,
    author: req.user.name,
    timestamp: new Date()
  });

  await task.save();
  res.json(task);
};