const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const Lead = require("../models/Lead");
const Counter = require("../models/counter.model");
const {
  AEO_STATUS,
  INDUSTRY_OPTIONS,
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_TYPE,
  RCMC_PANEL_OPTIONS,
  RCMC_TYPE_MAP,
  RCMC_TYPE_OPTIONS,
} = require("../constants/crmOptions");
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
const {
  syncLeadDeletionToMail,
  syncLeadsToMailBulk,
  syncLeadStatusToMail,
  syncLeadToMail,
} = require("../utils/leadMailSync");

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
  "senderEmail",
  "emailVerifiedStatus",
  "wifi",
  "browser",
  "emailSentOn",
  "emailTemplate",
  "emailSubjectCode",
  "emailSeen",
  "emailStatus",
  "enquiryStatus",
  "turnup",
  "cdcrNo",
  "cdcrCreation",
  "description",
  "notes",
];

const sampleFilePath = path.join(__dirname, "../static/sample-leads.xlsx");
const IMPORT_BATCH_SIZE = 1000;

const mergeFilterOptions = (...optionSets) => [
  ...new Set(
    optionSets.flat().map((value) => cleanString(value)).filter(Boolean)
  ),
];

const buildLeadFilterOptionsPayload = async () => {
  const baseFilter = { isDeleted: false };
  const [industry, leadType, leadSource, leadStatus, AEOStatus, RCMCPanel, RCMCType, city, state, priorityRating] =
    await Promise.all([
      Lead.distinct("industry", baseFilter),
      Lead.distinct("leadType", baseFilter),
      Lead.distinct("leadSource", baseFilter),
      Lead.distinct("leadStatus", baseFilter),
      Lead.distinct("AEOStatus", baseFilter),
      Lead.distinct("RCMCPanel", baseFilter),
      Lead.distinct("RCMCType", baseFilter),
      Lead.distinct("city", baseFilter),
      Lead.distinct("state", baseFilter),
      Lead.distinct("priorityRating", baseFilter),
    ]);

  const dbTypesByPanelDocs = await Lead.aggregate([
    { $match: { isDeleted: false, RCMCPanel: { $ne: "" }, RCMCType: { $ne: "" } } },
    { $group: { _id: "$RCMCPanel", values: { $addToSet: "$RCMCType" } } },
  ]);

  const dbTypesByPanel = Object.fromEntries(
    dbTypesByPanelDocs.map((row) => [cleanString(row._id), mergeFilterOptions(row.values || [])])
  );

  const rcmcTypeMap = {};
  const panelOptions = mergeFilterOptions(RCMC_PANEL_OPTIONS, RCMCPanel);
  panelOptions.forEach((panel) => {
    rcmcTypeMap[panel] = mergeFilterOptions(
      RCMC_TYPE_MAP[panel] || [],
      dbTypesByPanel[panel] || []
    );
  });

  return {
    industry: mergeFilterOptions(INDUSTRY_OPTIONS, industry),
    leadType: mergeFilterOptions(LEAD_TYPE, leadType),
    leadSource: mergeFilterOptions(LEAD_SOURCE, leadSource),
    leadStatus: mergeFilterOptions(LEAD_STATUS, leadStatus),
    AEOStatus: mergeFilterOptions(AEO_STATUS, AEOStatus),
    RCMCPanel: panelOptions,
    RCMCType: mergeFilterOptions(RCMC_TYPE_OPTIONS, RCMCType),
    RCMCTypeMap: rcmcTypeMap,
    city: mergeFilterOptions(city),
    state: mergeFilterOptions(state),
    priorityRating: mergeFilterOptions(priorityRating),
  };
};

const normalizeImportHeader = (value) =>
  cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const createHeaderAliasMap = (aliases) => {
  const map = new Map();
  Object.entries(aliases).forEach(([field, values]) => {
    values.forEach((value) => {
      map.set(normalizeImportHeader(value), field);
    });
  });
  return map;
};

const LEAD_IMPORT_HEADER_MAP = createHeaderAliasMap({
  name: ["name", "client name", "name of client", "company name"],
  iecChaNo: ["iecchano", "iec cha no", "iec/cha no", "iec cha number"],
  landlineNo: ["landlineno", "landline no", "landline number", "telephone"],
  mobileNo: ["mobileno", "mobile no", "mobile", "mobile number", "phone", "phone number", "contact mobile"],
  email: ["email", "email id", "email address", "client email"],
  website: ["website", "web site", "url"],
  address: ["address", "office address"],
  city: ["city"],
  state: ["state"],
  pinCode: ["pincode", "pin code", "zipcode", "zip code", "postal code"],
  contactPerson: ["contactperson", "contact person", "primary contact"],
  designation: ["designation", "role"],
  employees: ["employees", "employee count", "staff count"],
  turnover: ["turnover"],
  startupCategory: ["startupcategory", "startup category"],
  AEOStatus: ["aeostatus", "aeo status"],
  RCMCPanel: ["rcmcpanel", "rcmc panel"],
  RCMCType: ["rcmctype", "rcmc type"],
  industry: ["industry"],
  industryBrief: ["industrybrief", "industry brief"],
  leadType: ["leadtype", "lead type"],
  priorityRating: ["priorityrating", "priority rating", "priority"],
  leadSource: ["leadsource", "lead source"],
  leadStatus: ["leadstatus", "lead status", "status"],
  senderEmail: ["senderemail", "sender email", "email sent", "from", "from email"],
  emailVerifiedStatus: ["emailverifiedstatus", "email verified status", "email verified", "verify email"],
  wifi: ["wifi"],
  browser: ["browser"],
  emailSentOn: ["emailsenton", "email sent on", "date"],
  emailTemplate: ["emailtemplate", "email template", "template"],
  emailSubjectCode: ["emailsubjectcode", "email subject code", "email subject", "subject code"],
  emailSeen: ["emailseen", "email seen"],
  emailStatus: ["emailstatus", "email status", "mail status"],
  enquiryStatus: ["enquirystatus", "enquiry status"],
  turnup: ["turnup", "turn up"],
  cdcrNo: ["cdcrno", "cdcr no", "cdcr number", "cdcr"],
  cdcrCreation: ["cdcrcreation", "cdcr creation", "cdcr creation date"],
  description: ["description"],
  notes: ["notes", "note"],
});

const mapSheetRowsByHeaders = (sheet, headerMap) => {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) {
    return [];
  }

  const rawHeaders = matrix[0] || [];
  const mappedHeaders = rawHeaders.map((header) => {
    const normalized = normalizeImportHeader(header);
    return headerMap.get(normalized) || cleanString(header);
  });

  return matrix
    .slice(1)
    .filter((row) => row.some((value) => cleanString(value) !== ""))
    .map((row) => {
      const mappedRow = {};
      mappedHeaders.forEach((key, index) => {
        mappedRow[key || `__empty_${index}`] = row[index];
      });
      return mappedRow;
    });
};

const chunkArray = (items, size) => {
  if (!Array.isArray(items) || size <= 0) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildLeadPayload = (req, existing = {}) => {
  const body = req.body || {};
  const incomingAttachments = buildAttachmentMeta(req.files || []);
  const existingAttachments = Array.isArray(existing.attachments) ? existing.attachments : [];
  const preserveExistingAttachments = body.preserveExistingAttachments !== "false";

  const city = cleanString(body.city ?? existing.city);
  const incomingState = cleanString(body.state ?? existing.state);

  const payload = {
    name: cleanString(body.name ?? existing.name),
    iecChaNo: cleanString(body.iecChaNo ?? existing.iecChaNo),
    landlineNo: cleanString(body.landlineNo ?? existing.landlineNo),
    mobileNo: cleanString(body.mobileNo ?? existing.mobileNo),
    website: cleanString(body.website ?? existing.website),
    address: cleanString(body.address ?? existing.address),
    city,
    state: incomingState,
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
    senderEmail: normalizeEmail(body.senderEmail ?? existing.senderEmail),
    emailVerifiedStatus: cleanString(body.emailVerifiedStatus ?? existing.emailVerifiedStatus),
    wifi: cleanString(body.wifi ?? existing.wifi),
    browser: cleanString(body.browser ?? existing.browser),
    emailSentOn: body.emailSentOn || existing.emailSentOn || null,
    emailTemplate: cleanString(body.emailTemplate ?? existing.emailTemplate),
    emailSubjectCode: cleanString(body.emailSubjectCode ?? existing.emailSubjectCode),
    emailSeen: cleanString(body.emailSeen ?? existing.emailSeen),
    emailStatus: cleanString(body.emailStatus ?? existing.emailStatus),
    enquiryStatus: cleanString(body.enquiryStatus ?? existing.enquiryStatus),
    turnup: cleanString(body.turnup ?? existing.turnup),
    cdcrNo: cleanString(body.cdcrNo ?? existing.cdcrNo),
    cdcrCreation: body.cdcrCreation || existing.cdcrCreation || null,
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

  ["leadStatus", "industry", "leadType", "leadSource", "AEOStatus", "RCMCPanel", "RCMCType", "state", "city", "priorityRating"].forEach(
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
  const ws = XLSX.utils.aoa_to_sheet([ALL_FIELDS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sample");
  fs.mkdirSync(path.dirname(sampleFilePath), { recursive: true });
  XLSX.writeFile(wb, sampleFilePath);
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
  res.json({
    success: true,
    data: await buildLeadFilterOptionsPayload(),
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
  await syncLeadToMail(lead.toObject(), req.user?.id);

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

  const emailChanged = payload.normalizedEmail !== existing.normalizedEmail;
  const mobileChanged = payload.normalizedMobileNo !== existing.normalizedMobileNo;
  const duplicate = await getDuplicateLead({
    email: emailChanged ? payload.normalizedEmail : "",
    mobileNo: mobileChanged ? payload.normalizedMobileNo : "",
    excludeId: req.params.id,
  });


  if (duplicate) {
    res.status(409);
    throw new Error("Another lead already exists with same email or mobile number");
  }

  payload.updatedBy = req.user?.id || null;
  Object.assign(existing, payload);
  await existing.save();
  await syncLeadToMail(existing.toObject(), req.user?.id);

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

  await syncLeadDeletionToMail(deleted.toObject(), req.user?.id);

  res.json({ success: true, message: "Lead deleted successfully", lead: deleted });
});

const listLeads = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

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
    response.filterOptions = await buildLeadFilterOptionsPayload();
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

  await syncLeadStatusToMail(updated.toObject(), req.user?.id);

  res.json({ success: true, lead: updated });
});

const downloadSample = asyncHandler(async (req, res) => {
  generateSample();
  const fileBuffer = fs.readFileSync(sampleFilePath);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=sample-leads.xlsx");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.send(fileBuffer);
});

const normalizeImportedLead = (row) => {
  const email = normalizeEmail(row.email);
  const mobile = normalizePhone(row.mobileNo || row.mobile || row.phone);
  const city = cleanString(row.city || row.__empty_7 || row.__empty_8);
  const state = cleanString(row.state || row.__empty_9 || row.__empty_10);

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
    turnover: cleanString(row.turnover) || undefined,
    startupCategory: cleanString(row.startupCategory) || undefined,
    AEOStatus: cleanString(row.AEOStatus) || undefined,
    RCMCPanel: cleanString(row.RCMCPanel),
    RCMCType: cleanString(row.RCMCType),
    industry: cleanString(row.industry),
    industryBrief: cleanString(row.industryBrief),
    leadType: cleanString(row.leadType) || undefined,
    priorityRating: cleanString(row.priorityRating) || undefined,
    leadSource: cleanString(row.leadSource) || undefined,
    leadStatus: cleanString(row.leadStatus) || "Not Contacted",
    senderEmail: normalizeEmail(row.senderEmail),
    emailVerifiedStatus: cleanString(row.emailVerifiedStatus),
    wifi: cleanString(row.wifi),
    browser: cleanString(row.browser),
    emailSentOn: row.emailSentOn ? new Date(row.emailSentOn) : undefined,
    emailTemplate: cleanString(row.emailTemplate),
    emailSubjectCode: cleanString(row.emailSubjectCode),
    emailSeen: cleanString(row.emailSeen),
    emailStatus: cleanString(row.emailStatus),
    enquiryStatus: cleanString(row.enquiryStatus),
    turnup: cleanString(row.turnup),
    cdcrNo: cleanString(row.cdcrNo),
    cdcrCreation: row.cdcrCreation ? new Date(row.cdcrCreation) : undefined,
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

  try {
    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      res.status(400);
      throw new Error("No sheet found in file");
    }

    const rows = mapSheetRowsByHeaders(sheet, LEAD_IMPORT_HEADER_MAP);
    if (!rows.length) {
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

    const skippedRows = [];
    let importedCount = 0;

    for (const [chunkIndex, rowChunk] of chunkArray(rows, IMPORT_BATCH_SIZE).entries()) {
      const operations = [];
      const pendingInsertRows = [];
      const importedLeadIds = [];
      const rowOffset = chunkIndex * IMPORT_BATCH_SIZE;

      for (let index = 0; index < rowChunk.length; index += 1) {
        const lead = normalizeImportedLead(rowChunk[index]);

        if (!lead.name) {
          skippedRows.push({ rowNumber: rowOffset + index + 2, reason: "name is required" });
          continue;
        }

        operations.push({
          insertOne: {
            document: {
              ...lead,
              idNo: "",
              idDate: new Date(),
              createdBy: req.user?.id || null,
              updatedBy: req.user?.id || null,
              isDeleted: false,
            },
          },
        });
        pendingInsertRows.push({
          operationIndex: operations.length - 1,
          rowNumber: rowOffset + index + 2,
        });
      }

      if (!pendingInsertRows.length) {
        continue;
      }

      const counter = await Counter.findOneAndUpdate(
        { name: "leadId" },
        { $inc: { value: pendingInsertRows.length } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const startValue = counter.value - pendingInsertRows.length + 1;
      pendingInsertRows.forEach(({ operationIndex }, rangeIndex) => {
        const idNo = `LEAD-${String(startValue + rangeIndex).padStart(6, "0")}`;
        operations[operationIndex].insertOne.document.idNo = idNo;
        importedLeadIds.push(idNo);
        pendingInsertRows[rangeIndex].idNo = idNo;
      });

      await Lead.bulkWrite(operations, { ordered: false });

      const syncedLeads = await Lead.find({
        isDeleted: false,
        idNo: { $in: importedLeadIds },
      }).lean();

      const persistedIds = new Set(syncedLeads.map((lead) => lead.idNo));
      pendingInsertRows.forEach(({ idNo, rowNumber }) => {
        if (idNo && !persistedIds.has(idNo)) {
          skippedRows.push({
            rowNumber,
            reason: "row could not be saved",
          });
        }
      });

      if (syncedLeads.length) {
        await syncLeadsToMailBulk(syncedLeads, req.user?.id);
        importedCount += syncedLeads.length;
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      imported: importedCount,
      skipped: skippedRows.length,
      skippedDetails: skippedRows,
    });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

const bulkDeleteLeads = asyncHandler(async (req, res) => {
  const result = await Lead.updateMany(
    { _id: { $in: req.body.ids }, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } }
  );

  const deletedLeads = await Lead.find({ _id: { $in: req.body.ids } }).lean();
  for (const lead of deletedLeads) {
    await syncLeadDeletionToMail(lead, req.user?.id);
  }

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

  const updatedLeads = await Lead.find({ _id: { $in: req.body.ids }, isDeleted: false }).lean();
  for (const lead of updatedLeads) {
    await syncLeadStatusToMail(lead, req.user?.id);
  }

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
