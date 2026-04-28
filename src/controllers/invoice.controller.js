const Invoice = require("../models/invoice.model.js");
const Task = require("../models/task.model.js");

const generateInvoiceNo = () =>
  `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

const raiseInvoice = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const { taskId, amount, gstPercent = 18 } = req.body;

  const task = await Task.findById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (task.status !== "Pending for Invoicing") {
    return res
      .status(400)
      .json({ message: "Task not ready for invoicing" });
  }

  const gstAmount = (amount * gstPercent) / 100;
  const totalAmount = amount + gstAmount;

  const invoice = await Invoice.create({
    invoiceNumber: generateInvoiceNo(),

    taskId: task._id,
    serviceRequestId: task.serviceRequestId,

    clientId: task.clientId,
    clientName: task.clientName,
    clientDisplayId: task.clientDisplayId,

    serviceType: task.serviceType,
    subType: task.subType,

    handledByUserId: task.assignedToUserId,
    handledByName: task.assignedToName,

    amount,
    gstPercent,
    gstAmount,
    totalAmount,

    issuedDate: new Date(),
    createdByAdminId: req.user.id
  });

  // Sync task status
  task.status = "Invoice Raised";
  task.history.push({
    status: "Invoice Raised",
    note: "Invoice generated",
    timestamp: new Date()
  });
  await task.save();

  res.status(201).json(invoice);
};

const markInvoicePaid = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  invoice.status = "Invoice Paid";
  invoice.paidDate = new Date();
  await invoice.save();

  // Sync task
  const task = await Task.findById(invoice.taskId);
  task.status = "Invoice Paid";
  task.history.push({
    status: "Invoice Paid",
    note: "Payment received",
    timestamp: new Date()
  });
  await task.save();

  res.json(invoice);
};

const getInvoices = async (req, res) => {
  let invoices;

  if (req.user.role === "ADMIN") {
    invoices = await Invoice.find().sort({ createdAt: -1 });
  } else {
    invoices = await Invoice.find({
      handledByUserId: req.user.id
    }).sort({ createdAt: -1 });
  }

  res.json(invoices);
};

module.exports = {
  raiseInvoice,
  markInvoicePaid,
  getInvoices
};
