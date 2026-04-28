const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const Lead = require("../models/Lead");
const { LEAD_STATUS } = require("../constants/crmOptions");
const { getMappedStateForCity } = require("../constants/locationOptions");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  buildAttachmentMeta,
  buildDateRange,
  cleanString,
  ensureArray,
  escapeRegex,
  nextSequence,
  normalizeEmail,
  normalizePhone,
  parseMaybeJson,
  parsePositiveInt,
} = require("../utils/crm");

const ALL_FIELDS = [
  "name",
  "iecChaNo",
  "landlineNo",
  "mobileNo",
  "email",
  "website",
  "address",
  "city",
  "state",
  "pinCode",
  "contactPerson",
  "designation",
  "employees",
  "turnover",
  "startupCategory",
  "AEOStatus",
  "RCMCPanel",
  "RCMCType",
  "industry",
  "industryBrief",
  "leadType",
  "priorityRating",
  "leadSource",
  "leadStatus",
  "description",
  "notes",
];

const sampleFilePath = path.join(__dirname, "../static/sample-leads.xlsx");

const buildLeadPayload = (req, existing = {}) => {
  const body = req.body || {};
  const incomingAttachments = buildAttachmentMeta(req.files || []);
  const existingAttachments = Array.isArray(existing.attachments) ? existing.attachments : [];
  const preserveExistingAttachments = body.preserveExistingAttachments !== "false";

  const city = cleanString(body.city ?? existing.city);
  const incomingState = cleanString(body.state ?? existing.state);
  const mappedState = getMappedStateForCity(city);

  const payload = {
    name: cleanString(body.name ?? existing.name),
    iecChaNo: cleanString(body.iecChaNo ?? existing.iecChaNo),
    landlineNo: cleanString(body.landlineNo ?? existing.landlineNo),
    mobileNo: cleanString(body.mobileNo ?? existing.mobileNo),
    website: cleanString(body.website ?? existing.website),
    address: cleanString(body.address ?? existing.address),
    city,
    state: mappedState || incomingState,
    pinCode: cleanString(body.pinCode ?? existing.pinCode),
    contactPerson: cleanString(body.contactPerson ?? existing.contactPerson),
    designation: cleanString(body.designation ?? existing.designation),
    employees:
      body.employees === undefined || body.employees === ""
        ? existing.employees ?? null
        : Number(body.employees),
    turnover: body.turnover || existing.turnover,
    startupCategory: body.startupCategory || existing.startupCategory,
    AEOStatus: body.AEOStatus || existing.AEOStatus,
    RCMCPanel: cleanString(body.RCMCPanel ?? existing.RCMCPanel),
    RCMCType: cleanString(body.RCMCType ?? existing.RCMCType),
    industry: cleanString(body.industry ?? existing.industry),
    industryBrief: cleanString(body.industryBrief ?? existing.industryBrief),
    leadType: body.leadType || existing.leadType,
    priorityRating: body.priorityRating || existing.priorityRating,
    leadSource: body.leadSource || existing.leadSource,
    leadStatus: body.leadStatus || existing.leadStatus || "Not Contacted",
    description: body.description ?? existing.description ?? "",
    notes: body.notes ?? existing.notes ?? "",
    email: normalizeEmail(body.email ?? existing.email),
    normalizedEmail: normalizeEmail(body.email ?? existing.email),
    normalizedMobileNo: normalizePhone(body.mobileNo ?? existing.mobileNo),
    metadata: parseMaybeJson(body.metadata, existing.metadata || {}),
    attachments: preserveExistingAttachments
      ? [...existingAttachments, ...incomingAttachments]
      : incomingAttachments,
  };

  return payload;
};

const getDuplicateLead = async ({ email, mobileNo, excludeId }) => {
  const clauses = [];
  if (email) {
    clauses.push({ normalizedEmail: email });
  }
  if (mobileNo) {
    clauses.push({ normalizedMobileNo: mobileNo });
  }

  if (!clauses.length) {
    return null;
  }

  return Lead.findOne({
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: clauses,
  }).lean();
};

const buildLeadQuery = (query) => {
  const filter = { isDeleted: false };
  const search = cleanString(query.search);

  ["leadStatus", "industry", "leadType", "leadSource", "AEOStatus", "RCMCPanel", "state", "city", "priorityRating"].forEach(
    (field) => {
      if (cleanString(query[field])) {
        filter[field] = query[field];
      }
    }
  );

  const createdAt = buildDateRange(query.createdFrom, query.createdTo);
  if (createdAt) {
    filter.createdAt = createdAt;
  }

  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [
      { idNo: regex },
      { name: regex },
      { email: regex },
      { mobileNo: regex },
      { contactPerson: regex },
      { city: regex },
      { state: regex },
      { industry: regex },
    ];
  }

  return filter;
};

function generateSample() {
  if (!fs.existsSync(sampleFilePath)) {
    const ws = XLSX.utils.aoa_to_sheet([ALL_FIELDS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    fs.mkdirSync(path.dirname(sampleFilePath), { recursive: true });
    XLSX.writeFile(wb, sampleFilePath);
  }
}

generateSample();

const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [today, week, month, year, total, byStatus, last30days] = await Promise.all([
    Lead.countDocuments({ createdAt: { $gte: startOfDay }, isDeleted: false }),
    Lead.countDocuments({ createdAt: { $gte: startOfWeek }, isDeleted: false }),
    Lead.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: false }),
    Lead.countDocuments({ createdAt: { $gte: startOfYear }, isDeleted: false }),
    Lead.countDocuments({ isDeleted: false }),
    Lead.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$leadStatus", count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    today,
    week,
    month,
    year,
    total,
    byStatus,
    last30days,
  });
});

const getLeadFilterOptions = asyncHandler(async (req, res) => {
  const baseFilter = { isDeleted: false };
  const [industry, leadType, leadSource, leadStatus, AEOStatus, RCMCPanel, city, state, priorityRating] =
    await Promise.all([
      Lead.distinct("industry", baseFilter),
      Lead.distinct("leadType", baseFilter),
      Lead.distinct("leadSource", baseFilter),
      Lead.distinct("leadStatus", baseFilter),
      Lead.distinct("AEOStatus", baseFilter),
      Lead.distinct("RCMCPanel", baseFilter),
      Lead.distinct("city", baseFilter),
      Lead.distinct("state", baseFilter),
      Lead.distinct("priorityRating", baseFilter),
    ]);

  res.json({
    success: true,
    data: {
      industry: industry.filter(Boolean),
      leadType: leadType.filter(Boolean),
      leadSource: leadSource.filter(Boolean),
      leadStatus: leadStatus.filter(Boolean),
      AEOStatus: AEOStatus.filter(Boolean),
      RCMCPanel: RCMCPanel.filter(Boolean),
      city: city.filter(Boolean),
      state: state.filter(Boolean),
      priorityRating: priorityRating.filter(Boolean),
    },
  });
});

const createLead = asyncHandler(async (req, res) => {
  const payload = buildLeadPayload(req);

  if (!payload.name) {
    res.status(400);
    throw new Error("Name is required");
  }

  const duplicate = await getDuplicateLead({
    email: payload.normalizedEmail,
    mobileNo: payload.normalizedMobileNo,
  });

  if (duplicate) {
    res.status(409);
    throw new Error("Lead with same email or mobile number already exists");
  }

  payload.idNo = await nextSequence("leadId", "LEAD");
  payload.idDate = new Date();
  payload.createdBy = req.user?.id || null;
  payload.updatedBy = req.user?.id || null;

  const lead = await Lead.create(payload);

  res.status(201).json({
    success: true,
    message: "Lead created successfully",
    lead,
  });
});

const updateLead = asyncHandler(async (req, res) => {
  const existing = await Lead.findOne({ _id: req.params.id, isDeleted: false });
  if (!existing) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const payload = buildLeadPayload(req, existing.toObject());

  if (!payload.name) {
    res.status(400);
    throw new Error("Name is required");
  }

  const duplicate = await getDuplicateLead({
    email: payload.normalizedEmail,
    mobileNo: payload.normalizedMobileNo,
    excludeId: req.params.id,
  });

  if (duplicate) {
    res.status(409);
    throw new Error("Another lead already exists with same email or mobile number");
  }

  payload.updatedBy = req.user?.id || null;
  Object.assign(existing, payload);
  await existing.save();

  res.json({
    success: true,
    message: "Lead updated successfully",
    lead: existing,
  });
});

const deleteLead = asyncHandler(async (req, res) => {
  const deleted = await Lead.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } },
    { new: true }
  );

  if (!deleted) {
    res.status(404);
    throw new Error("Lead not found");
  }

  res.json({ success: true, message: "Lead deleted successfully", lead: deleted });
});

const listLeads = asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
  const skip = (page - 1) * limit;
  const filter = buildLeadQuery(req.query);
  const includeFilters = String(req.query.includeFilters || "").toLowerCase() === "true";

  const [total, leads] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const response = {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    leads,
  };

  if (includeFilters) {
    const baseFilter = { isDeleted: false };
    const [industry, leadType, leadSource, leadStatus, AEOStatus, RCMCPanel, city, state, priorityRating] =
      await Promise.all([
        Lead.distinct("industry", baseFilter),
        Lead.distinct("leadType", baseFilter),
        Lead.distinct("leadSource", baseFilter),
        Lead.distinct("leadStatus", baseFilter),
        Lead.distinct("AEOStatus", baseFilter),
        Lead.distinct("RCMCPanel", baseFilter),
        Lead.distinct("city", baseFilter),
        Lead.distinct("state", baseFilter),
        Lead.distinct("priorityRating", baseFilter),
      ]);

    response.filterOptions = {
      industry: industry.filter(Boolean),
      leadType: leadType.filter(Boolean),
      leadSource: leadSource.filter(Boolean),
      leadStatus: leadStatus.filter(Boolean),
      AEOStatus: AEOStatus.filter(Boolean),
      RCMCPanel: RCMCPanel.filter(Boolean),
      city: city.filter(Boolean),
      state: state.filter(Boolean),
      priorityRating: priorityRating.filter(Boolean),
    };
  }

  res.json(response);
});

const getLeadById = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, isDeleted: false }).lean();

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  res.json({ success: true, lead });
});

const updateStatus = asyncHandler(async (req, res) => {
  const status = req.body.leadStatus || req.body.status;
  if (!LEAD_STATUS.includes(status)) {
    res.status(400);
    throw new Error("Invalid lead status");
  }

  const updated = await Lead.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { leadStatus: status, updatedBy: req.user?.id || null } },
    { new: true }
  );

  if (!updated) {
    res.status(404);
    throw new Error("Lead not found");
  }

  res.json({ success: true, lead: updated });
});

const downloadSample = asyncHandler(async (req, res) => {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=sample-leads.xlsx");
  res.download(sampleFilePath);
});

const normalizeImportedLead = (row) => {
  const email = normalizeEmail(row.email);
  const mobile = normalizePhone(row.mobileNo || row.mobile || row.phone);
  const city = cleanString(row.city);
  const state = getMappedStateForCity(city) || cleanString(row.state);

  return {
    name: cleanString(row.name),
    iecChaNo: cleanString(row.iecChaNo),
    landlineNo: cleanString(row.landlineNo),
    mobileNo: mobile,
    normalizedMobileNo: mobile,
    email,
    normalizedEmail: email,
    website: cleanString(row.website),
    address: cleanString(row.address),
    city,
    state,
    pinCode: cleanString(row.pinCode),
    contactPerson: cleanString(row.contactPerson),
    designation: cleanString(row.designation),
    employees: row.employees ? Number(row.employees) : null,
    turnover: row.turnover || undefined,
    startupCategory: row.startupCategory || undefined,
    AEOStatus: row.AEOStatus || undefined,
    RCMCPanel: cleanString(row.RCMCPanel),
    RCMCType: cleanString(row.RCMCType),
    industry: cleanString(row.industry),
    industryBrief: cleanString(row.industryBrief),
    leadType: row.leadType || undefined,
    priorityRating: row.priorityRating || undefined,
    leadSource: row.leadSource || undefined,
    leadStatus: row.leadStatus || "Not Contacted",
    description: row.description || "",
    notes: row.notes || "",
    metadata: row,
  };
};

const importLeads = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }

  const workbook = XLSX.readFile(req.file.path, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    fs.unlink(req.file.path, () => {});
    res.status(400);
    throw new Error("No sheet found in file");
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) {
    fs.unlink(req.file.path, () => {});
    res.status(400);
    throw new Error("Excel/CSV file is empty");
  }

  const replaceMode = cleanString(req.query.mode).toLowerCase() === "replace";
  if (replaceMode) {
    await Lead.updateMany(
      { isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } }
    );
  }

  const existingLeads = await Lead.find(
    { isDeleted: false },
    { _id: 1, normalizedEmail: 1, normalizedMobileNo: 1 }
  ).lean();

  const emailMap = new Map(existingLeads.filter((lead) => lead.normalizedEmail).map((lead) => [lead.normalizedEmail, lead._id]));
  const mobileMap = new Map(existingLeads.filter((lead) => lead.normalizedMobileNo).map((lead) => [lead.normalizedMobileNo, lead._id]));
  const pendingKeys = new Set();

  const operations = [];
  const skippedRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    const lead = normalizeImportedLead(rows[index]);

    if (!lead.name) {
      skippedRows.push({ rowNumber: index + 2, reason: "name is required" });
      continue;
    }

    const dedupeKey = lead.normalizedEmail || lead.normalizedMobileNo;
    if (dedupeKey && pendingKeys.has(dedupeKey)) {
      skippedRows.push({
        rowNumber: index + 2,
        reason: "duplicate row in import file",
      });
      continue;
    }

    const existingId = emailMap.get(lead.normalizedEmail) || mobileMap.get(lead.normalizedMobileNo);
    if (!existingId && !lead.normalizedEmail && !lead.normalizedMobileNo) {
      skippedRows.push({
        rowNumber: index + 2,
        reason: "either email or mobileNo is required for import deduplication",
      });
      continue;
    }

    if (existingId) {
      operations.push({
        updateOne: {
          filter: { _id: existingId },
          update: {
            $set: {
              ...lead,
              updatedBy: req.user?.id || null,
              isDeleted: false,
            },
          },
        },
      });
      continue;
    }

    const nextId = await nextSequence("leadId", "LEAD");
    operations.push({
      insertOne: {
        document: {
          ...lead,
          idNo: nextId,
          idDate: new Date(),
          createdBy: req.user?.id || null,
          updatedBy: req.user?.id || null,
          isDeleted: false,
        },
      },
    });

    if (lead.normalizedEmail) {
      pendingKeys.add(lead.normalizedEmail);
    }
    if (lead.normalizedMobileNo) {
      pendingKeys.add(lead.normalizedMobileNo);
    }
  }

  if (operations.length) {
    await Lead.bulkWrite(operations, { ordered: false });
  }

  fs.unlink(req.file.path, () => {});

  res.json({
    success: true,
    totalRows: rows.length,
    imported: operations.length,
    skipped: skippedRows.length,
    skippedDetails: skippedRows,
  });
});

const bulkDeleteLeads = asyncHandler(async (req, res) => {
  const result = await Lead.updateMany(
    { _id: { $in: req.body.ids }, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} lead(s) deleted`,
  });
});

const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const status = req.body.status || req.body.leadStatus;
  if (!LEAD_STATUS.includes(status)) {
    res.status(400);
    throw new Error("Invalid lead status");
  }

  const result = await Lead.updateMany(
    { _id: { $in: req.body.ids }, isDeleted: false },
    { $set: { leadStatus: status, updatedBy: req.user?.id || null } }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} lead(s) updated`,
  });
});

module.exports = {
  createLead,
  listLeads,
  getLeadById,
  updateStatus,
  updateLead,
  deleteLead,
  importLeads,
  downloadSample,
  getDashboardStats,
  getLeadFilterOptions,
  bulkDeleteLeads,
  bulkUpdateStatus,
};
