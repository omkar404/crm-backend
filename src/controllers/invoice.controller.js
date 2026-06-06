const Invoice = require("../models/invoice.model.js");
const Task = require("../models/task.model.js");

const generateInvoiceNo = () =>
  `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

const generateReceiptNo = () =>
  `RCPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

const parseAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const roundAmount = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveUniqueInvoiceNumber = async (requestedNumber, currentInvoiceId = null) => {
  const baseNumber =
    typeof requestedNumber === "string" && requestedNumber.trim()
      ? requestedNumber.trim()
      : generateInvoiceNo();

  const existingExact = await Invoice.findOne({
    invoiceNumber: baseNumber,
    ...(currentInvoiceId ? { _id: { $ne: currentInvoiceId } } : {}),
  })
    .select("_id")
    .lean();

  if (!existingExact) {
    return baseNumber;
  }

  const similarNumbers = await Invoice.find(
    {
      invoiceNumber: { $regex: `^${escapeRegex(baseNumber)}(?:-\\d+)?$`, $options: "i" },
      ...(currentInvoiceId ? { _id: { $ne: currentInvoiceId } } : {}),
    },
    { invoiceNumber: 1 }
  ).lean();

  const usedSuffixes = new Set(
    similarNumbers
      .map((row) => {
        const match = String(row.invoiceNumber || "").match(new RegExp(`^${escapeRegex(baseNumber)}-(\\d+)$`, "i"));
        return match ? Number(match[1]) : 0;
      })
      .filter((value) => Number.isFinite(value))
  );

  let suffix = 1;
  while (usedSuffixes.has(suffix)) {
    suffix += 1;
  }

  return `${baseNumber}-${suffix}`;
};

const buildTaskResponse = async (taskId) => {
  const task = await Task.findById(taskId).lean();
  const invoice = await Invoice.findOne({ taskId }).sort({ createdAt: -1 }).lean();

  return {
    ...task,
    invoice,
  };
};

const raiseInvoice = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const {
    taskId,
    invoiceNumber,
    quotationMode,
    officialFee,
    serviceCharges,
    netAmount,
    gstAmount,
    issuedDate,
  } = req.body;

  const task = await Task.findById(taskId);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  if (!["Pending for Invoicing", "Invoice Raised"].includes(task.status)) {
    return res.status(400).json({ message: "Task not ready for invoicing" });
  }

  const existingInvoice = await Invoice.findOne({ taskId: task._id }).sort({ createdAt: -1 });
  if (existingInvoice || task.status === "Invoice Raised") {
    return res.status(400).json({
      message: "Invoice details cannot be edited after invoice is raised",
    });
  }

  const normalizedQuotationMode =
    typeof (quotationMode ?? task.quotation) === "string"
      ? String(quotationMode ?? task.quotation).trim()
      : "";
  const normalizedOfficialFee = parseAmount(officialFee ?? task.officialFee);
  const normalizedServiceCharges = parseAmount(serviceCharges ?? task.serviceCharges);
  const normalizedNetAmount = parseAmount(netAmount);
  const normalizedGstAmount = parseAmount(gstAmount);

  if (normalizedNetAmount === null) {
    return res.status(400).json({ message: "Net amount could not be determined" });
  }

  if (normalizedGstAmount === null) {
    return res.status(400).json({ message: "GST amount is required" });
  }

  const totalAmount = roundAmount(normalizedNetAmount + normalizedGstAmount);
  const invoiceDate = issuedDate ? new Date(issuedDate) : new Date();
  const normalizedInvoiceNumber = await resolveUniqueInvoiceNumber(
    typeof invoiceNumber === "string" && invoiceNumber.trim() ? invoiceNumber.trim() : generateInvoiceNo()
  );

  const invoicePayload = {
    invoiceNumber: normalizedInvoiceNumber,
    taskId: task._id,
    serviceRequestId: task.serviceRequestId,
    clientId: task.clientId,
    clientName: task.clientName,
    clientDisplayId: task.clientDisplayId,
    serviceType: task.serviceType,
    subType: task.subType,
    handledByUserId: task.assignedToUserId,
    handledByName: task.assignedToName,
    quotationMode: normalizedQuotationMode,
    officialFee: normalizedOfficialFee,
    serviceCharges: normalizedServiceCharges,
    netAmount: normalizedNetAmount,
    amount: normalizedNetAmount,
    gstPercent: null,
    gstAmount: normalizedGstAmount,
    totalAmount,
    issuedDate: invoiceDate,
    status: "Invoice Raised",
    createdByAdminId: req.user.id,
  };

  let invoice;
  try {
    invoice = await Invoice.create(invoicePayload);
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.invoiceNumber) {
      const fallbackInvoiceNumber = await resolveUniqueInvoiceNumber(
        generateInvoiceNo()
      );

      invoice = await Invoice.create({
        ...invoicePayload,
        invoiceNumber: fallbackInvoiceNumber,
      });
    } else {
      throw error;
    }
  }

  const previousStatus = task.status;
  task.status = "Invoice Raised";
  task.history.push({
    fromStatus: previousStatus,
    toStatus: "Invoice Raised",
    action: "INVOICE_RAISED",
    performedById: req.user.id,
    performedByName: req.user.name,
    note: "Invoice generated by admin",
    timestamp: new Date(),
  });
  await task.save();

  res.status(existingInvoice ? 200 : 201).json(await buildTaskResponse(task._id));
};

const markInvoicePaid = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin only" });
  }

  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  if (invoice.status === "Invoice Paid") {
    return res.status(400).json({
      message: "Invoice payment details cannot be edited after invoice is paid",
    });
  }

  const paidDate = req.body?.paidDate ? new Date(req.body.paidDate) : new Date();
  const tdsAmount = parseAmount(req.body?.tdsAmount) ?? 0;
  const receivedAmount = roundAmount((invoice.totalAmount || 0) - tdsAmount);

  invoice.status = "Invoice Paid";
  invoice.paidDate = paidDate;
  invoice.receivedAmount = receivedAmount;
  invoice.tdsAmount = tdsAmount;
  invoice.receiptAcknowledgement = invoice.receiptAcknowledgement || generateReceiptNo();
  await invoice.save();

  const task = await Task.findById(invoice.taskId);
  if (!task) {
    return res.status(404).json({ message: "Task not found for invoice" });
  }

  if (task.status === "Invoice Paid") {
    return res.status(400).json({
      message: "Invoice payment details cannot be edited after invoice is paid",
    });
  }

  const previousStatus = task.status;
  task.status = "Invoice Paid";
  task.slaBreached = false;
  task.history.push({
    fromStatus: previousStatus,
    toStatus: "Invoice Paid",
    action: "INVOICE_PAID",
    performedById: req.user.id,
    performedByName: req.user.name,
    note: "Invoice payment recorded by admin",
    timestamp: new Date(),
  });
  await task.save();

  res.json(await buildTaskResponse(task._id));
};

const getInvoices = async (req, res) => {
  const query = req.user.role === "ADMIN" ? {} : { handledByUserId: req.user.id };
  const invoices = await Invoice.find(query).sort({ createdAt: -1 });
  res.json(invoices);
};

module.exports = {
  raiseInvoice,
  markInvoicePaid,
  getInvoices,
};
