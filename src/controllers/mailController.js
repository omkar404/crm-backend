const fs = require("fs");
const Mail = require("../models/Mail");
const sendEmail = require("../config/email");
const {
  MAIL_EXCEL_HEADERS,
  MAIL_REFERENCE_FILTERS,
} = require("../constants/mailExcel");
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
  parseMaybeJson,
  parsePositiveInt,
  toBoolean,
} = require("../utils/crm");
const XLSX = require("xlsx");

const normalizeMailStatus = (value) => {
  const normalized = cleanString(value).toLowerCase();
  const statusMap = {
    reached: "reached",
    bounced: "bounced",
    stop: "stopped",
    enquiry: "enquiry",
    sent: "sent",
    draft: "draft",
    failed: "failed",
    scheduled: "scheduled",
    contacted: "contacted",
    "not contacted": "not_contacted",
  };

  return statusMap[normalized] || "";
};

const denormalizeMailStatus = (value) => {
  const statusMap = {
    reached: "Reached",
    bounced: "Bounced",
    stopped: "Stop",
    enquiry: "Enquiry",
    sent: "Sent",
    draft: "Draft",
    failed: "Failed",
    scheduled: "Scheduled",
    contacted: "Contacted",
    not_contacted: "Not Contacted",
  };

  return statusMap[value] || value || "";
};

const mergeReferenceOptions = (values = [], fallback = []) =>
  [...new Set([...values.filter(Boolean), ...fallback.filter(Boolean)])];

const mergeCaseInsensitiveOptions = (values = [], fallback = []) => {
  const canonical = new Map();

  fallback.filter(Boolean).forEach((item) => {
    canonical.set(cleanString(item).toLowerCase(), item);
  });

  values.filter(Boolean).forEach((item) => {
    const key = cleanString(item).toLowerCase();
    if (!key || canonical.has(key)) {
      return;
    }
    canonical.set(key, item);
  });

  return [...canonical.values()];
};

const canonicalizeReferenceValue = (value, fallback = []) => {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return "";
  }

  const matched = fallback.find((item) => cleanString(item).toLowerCase() === cleaned.toLowerCase());
  return matched || cleaned;
};

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => cleanString(item))
      .filter(Boolean);
  }

  return [];
};

const exactMailFilterOptions = async () => {
  const baseFilter = { isDeleted: false };
  const [
    sendEmailId,
    templateType,
    templateSubject,
    ipAddress,
    webTabAndType,
    emailVerifiedBoolean,
    verifyEmailRaw,
    emailSentType,
    status,
    city,
    state,
    sourceDate,
  ] = await Promise.all([
    Mail.distinct("from", baseFilter),
    Mail.distinct("templateName", baseFilter),
    Mail.distinct("subject", baseFilter),
    Mail.distinct("ipAddress", baseFilter),
    Mail.distinct("webSource", baseFilter),
    Mail.distinct("emailVerified", baseFilter),
    Mail.distinct("verifyEmail", baseFilter),
    Mail.distinct("emailSent", baseFilter),
    Mail.distinct("status", baseFilter),
    Mail.distinct("city", baseFilter),
    Mail.distinct("state", baseFilter),
    Mail.distinct("sourceDate", baseFilter),
  ]);

  return {
    sendEmailId: mergeReferenceOptions(sendEmailId.filter(Boolean), MAIL_REFERENCE_FILTERS.sendEmailId),
    templateType: mergeReferenceOptions(templateType, MAIL_REFERENCE_FILTERS.templateType),
    templateSubject: templateSubject.filter(Boolean),
    emailDate: sourceDate.filter(Boolean).map((value) => new Date(value).toISOString().slice(0, 10)),
    ipAddress: mergeCaseInsensitiveOptions(ipAddress.filter(Boolean), MAIL_REFERENCE_FILTERS.ipAddress),
    webTabAndType: mergeCaseInsensitiveOptions(webTabAndType.filter(Boolean), MAIL_REFERENCE_FILTERS.webTabAndType),
    emailVerified: mergeReferenceOptions(
      [
        ...emailVerifiedBoolean.filter(Boolean).map((value) => (value ? "Yes" : "No")),
        ...verifyEmailRaw.filter(Boolean),
      ],
      MAIL_REFERENCE_FILTERS.emailVerified
    ),
    emailSentType: mergeReferenceOptions(
      emailSentType.map((value) => (value ? "Yes" : "No")),
      MAIL_REFERENCE_FILTERS.emailSentType
    ),
    status: mergeReferenceOptions(status.filter(Boolean).map(denormalizeMailStatus), MAIL_REFERENCE_FILTERS.status),
    city: city.filter(Boolean),
    state: state.filter(Boolean),
  };
};

const buildMailPayload = (req, existing = {}) => {
  const body = req.body || {};
  const incomingAttachments = buildAttachmentMeta(req.files || []);
  const existingAttachments = Array.isArray(existing.attachments) ? existing.attachments : [];
  const preserveAttachments = toBoolean(body.preserveExistingAttachments);
  const attachments =
    preserveAttachments === false ? incomingAttachments : [...existingAttachments, ...incomingAttachments];

  const sender = normalizeEmail(body.from || body["Email Id"] || existing.from);
  const companyEmail = normalizeEmail(body.email ?? existing.email);
  const sourceDateValue = body.sourceDate || body.Date || existing.sourceDate;
  const city = cleanString(body.city ?? existing.city);
  const incomingState = cleanString(body.state ?? existing.state);
  const mappedState = getMappedStateForCity(city);

  const payload = {
    name: cleanString(body.name ?? existing.name),
    from: sender,
    subject: cleanString(body.subject ?? body.Subject ?? existing.subject),
    status: normalizeMailStatus(body.status ?? body.Status) || existing.status || "draft",
    templateName: cleanString(body.templateName ?? body.Template ?? existing.templateName),
    email: companyEmail,
    verifyEmail: cleanString(body.verifyEmail ?? body["verify email"] ?? existing.verifyEmail),
    city,
    state: mappedState || incomingState,
    ipAddress: canonicalizeReferenceValue(
      body.ipAddress ?? body["IP Address"] ?? existing.ipAddress,
      MAIL_REFERENCE_FILTERS.ipAddress
    ),
    webSource: canonicalizeReferenceValue(
      body.webSource ?? body.Web ?? existing.webSource,
      MAIL_REFERENCE_FILTERS.webTabAndType
    ),
    pinCode: cleanString(body.pinCode ?? existing.pinCode),
    contactPerson: cleanString(body.contactPerson ?? existing.contactPerson),
    designation: cleanString(body.designation ?? existing.designation),
    employees:
      body.employees === undefined || body.employees === "" ? existing.employees ?? null : Number(body.employees),
    turnover: cleanString(body.turnover ?? existing.turnover),
    startupCategory: cleanString(body.startupCategory ?? existing.startupCategory),
    AEOStatus: cleanString(body.AEOStatus ?? existing.AEOStatus),
    RCMCPanel: cleanString(body.RCMCPanel ?? existing.RCMCPanel),
    RCMCType: cleanString(body.RCMCType ?? existing.RCMCType),
    industry: cleanString(body.industry ?? existing.industry),
    industryBrief: cleanString(body.industryBrief ?? existing.industryBrief),
    leadType: cleanString(body.leadType ?? existing.leadType),
    priorityRating: cleanString(body.priorityRating ?? existing.priorityRating),
    leadSource: cleanString(body.leadSource ?? existing.leadSource),
    leadStatus: cleanString(body.leadStatus ?? existing.leadStatus),
    description: body.description ?? existing.description ?? "",
    notes: body.notes ?? existing.notes ?? "",
    attachments,
    metadata: parseMaybeJson(body.metadata, existing.metadata || {}),
  };

  const emailVerified = toBoolean(body.emailVerified ?? body["email verified"]);
  if (emailVerified !== undefined) {
    payload.emailVerified = emailVerified;
  } else if (existing.emailVerified !== undefined) {
    payload.emailVerified = existing.emailVerified;
  }

  const emailSent = toBoolean(body.emailSent ?? body["Email sent"]);
  if (emailSent !== undefined) {
    payload.emailSent = emailSent;
  } else if (existing.emailSent !== undefined) {
    payload.emailSent = existing.emailSent;
  }

  if (sourceDateValue) {
    const sourceDate = new Date(sourceDateValue);
    if (!Number.isNaN(sourceDate.getTime())) {
      payload.sourceDate = sourceDate;
    }
  }

  if (payload.status === "sent" && !existing.sentAt) {
    payload.sentAt = new Date();
    payload.emailSent = true;
  }

  payload.dedupeKey = [
    payload.from,
    payload.email || "",
    payload.subject.toLowerCase(),
    payload.sourceDate ? new Date(payload.sourceDate).toISOString().slice(0, 10) : "",
  ]
    .filter(Boolean)
    .join("|");

  return payload;
};

const mapMailResponse = (mail) => ({
  ...mail,
  "Sr No": mail.metadata?.["Sr No"] || "",
  name: mail.name || "",
  iecChaNo: mail.iecChaNo || "",
  landlineNo: mail.landlineNo || "",
  mobileNo: mail.mobileNo || "",
  "Email Id": mail.from,
  Template: mail.templateName,
  Subject: mail.subject,
  Date: mail.sourceDate,
  "IP Address": mail.ipAddress,
  Web: mail.webSource,
  email: mail.email || "",
  "verify email": mail.verifyEmail || "",
  "email verified": mail.verifyEmail || (mail.emailVerified ? "Yes" : ""),
  city: mail.city || "",
  "Email sent": mail.emailSent ? "Yes" : "No",
  Status: denormalizeMailStatus(mail.status),
  state: mail.state || "",
  pinCode: mail.pinCode || "",
  contactPerson: mail.contactPerson || "",
  designation: mail.designation || "",
  employees: mail.employees ?? "",
  turnover: mail.turnover || "",
  startupCategory: mail.startupCategory || "",
  AEOStatus: mail.AEOStatus || "",
  RCMCPanel: mail.RCMCPanel || "",
  RCMCType: mail.RCMCType || "",
  industry: mail.industry || "",
  industryBrief: mail.industryBrief || "",
  leadType: mail.leadType || "",
  priorityRating: mail.priorityRating || "",
  leadSource: mail.leadSource || "",
  leadStatus: mail.leadStatus || "",
  description: mail.description || "",
  notes: mail.notes || "",
});

const buildMailQuery = (query) => {
  const filter = { isDeleted: false };
  const search = cleanString(query.search);
  const column = cleanString(query.column);

  if (query.status) {
    filter.status = normalizeMailStatus(query.status) || query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  const exactMappings = {
    templateType: "templateName",
    templateSubject: "subject",
    ipAddress: "ipAddress",
    webTabAndType: "webSource",
    city: "city",
    state: "state",
  };

  const sendEmailIds = normalizeStringList(query.sendEmailId);
  if (sendEmailIds.length === 1) {
    filter.from = { $regex: `^${escapeRegex(sendEmailIds[0])}$`, $options: "i" };
  } else if (sendEmailIds.length > 1) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: sendEmailIds.map((value) => ({
          from: { $regex: `^${escapeRegex(value)}$`, $options: "i" },
        })),
      },
    ];
  }

  Object.entries(exactMappings).forEach(([input, field]) => {
    if (cleanString(query[input])) {
      filter[field] = { $regex: `^${escapeRegex(cleanString(query[input]))}$`, $options: "i" };
    }
  });

  if (cleanString(query.emailVerified)) {
    const rawValue = cleanString(query.emailVerified);
    const boolValue = toBoolean(rawValue);
    if (boolValue !== undefined) {
      filter.emailVerified = boolValue;
    } else {
      filter.verifyEmail = { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" };
    }
  }

  if (cleanString(query.emailSentType)) {
    const boolValue = toBoolean(query.emailSentType);
    if (boolValue !== undefined) {
      filter.emailSent = boolValue;
    }
  }

  const sourceDateRange = buildDateRange(query.sourceDateFrom, query.sourceDateTo, query.emailDate);
  if (sourceDateRange) {
    filter.sourceDate = sourceDateRange;
  }

  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };
    if (column) {
      filter[column] = regex;
    } else {
      filter.$or = [
        { mailId: regex },
        { name: regex },
        { from: regex },
        { email: regex },
        { subject: regex },
        { city: regex },
        { state: regex },
        { notes: regex },
        { webSource: regex },
        { RCMCPanel: regex },
        { leadType: regex },
        { leadSource: regex },
        { leadStatus: regex },
      ];
    }
  }

  return filter;
};

const getAllMails = asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
  const skip = (page - 1) * limit;
  const filter = buildMailQuery(req.query);
  const includeFilters = String(req.query.includeFilters || "").toLowerCase() === "true";

  const [total, mails] = await Promise.all([
    Mail.countDocuments(filter),
    Mail.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const response = {
    success: true,
    data: mails.map(mapMailResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };

  if (includeFilters) {
    response.filterOptions = await exactMailFilterOptions();
  }

  res.json(response);
});

const getFilterOptions = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await exactMailFilterOptions(),
  });
});

const getMailById = asyncHandler(async (req, res) => {
  const mail = await Mail.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { lastOpenedAt: new Date() } },
    { new: true }
  ).lean();

  if (!mail) {
    res.status(404);
    throw new Error("Mail not found");
  }

  res.json({ success: true, data: mapMailResponse(mail) });
});

const createMail = asyncHandler(async (req, res) => {
  const payload = buildMailPayload(req);

  if (!payload.subject) {
    res.status(400);
    throw new Error("Subject is required");
  }

  if (!payload.from) {
    res.status(400);
    throw new Error("Email Id is required");
  }

  payload.mailId = await nextSequence("mailId", "MAIL");
  payload.createdBy = req.user?.id || null;
  payload.updatedBy = req.user?.id || null;

  const mail = await Mail.create(payload);
  res.status(201).json({ success: true, data: mapMailResponse(mail.toObject()) });
});

const updateMail = asyncHandler(async (req, res) => {
  const existing = await Mail.findOne({ _id: req.params.id, isDeleted: false });
  if (!existing) {
    res.status(404);
    throw new Error("Mail not found");
  }

  const payload = buildMailPayload(req, existing.toObject());
  payload.updatedBy = req.user?.id || null;

  Object.assign(existing, payload);
  await existing.save();

  res.json({ success: true, data: mapMailResponse(existing.toObject()) });
});

const updateMailStatus = asyncHandler(async (req, res) => {
  const normalizedStatus = normalizeMailStatus(req.body.status);
  const updates = {
    status: normalizedStatus || req.body.status,
    updatedBy: req.user?.id || null,
  };

  if (updates.status === "sent") {
    updates.sentAt = new Date();
    updates.emailSent = true;
  }

  const mail = await Mail.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: updates },
    { new: true }
  ).lean();

  if (!mail) {
    res.status(404);
    throw new Error("Mail not found");
  }

  res.json({ success: true, data: mapMailResponse(mail) });
});

const deleteMail = asyncHandler(async (req, res) => {
  const mail = await Mail.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } },
    { new: true }
  ).lean();

  if (!mail) {
    res.status(404);
    throw new Error("Mail not found");
  }

  res.json({ success: true, message: "Mail deleted successfully" });
});

const bulkUpdateMailStatus = asyncHandler(async (req, res) => {
  const update = {
    status: normalizeMailStatus(req.body.status) || req.body.status,
    updatedBy: req.user?.id || null,
  };

  if (update.status === "sent") {
    update.sentAt = new Date();
    update.emailSent = true;
  }

  const result = await Mail.updateMany(
    { _id: { $in: req.body.ids }, isDeleted: false },
    { $set: update }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} mail(s) updated`,
  });
});

const bulkDeleteMails = asyncHandler(async (req, res) => {
  const result = await Mail.updateMany(
    { _id: { $in: req.body.ids }, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: req.user?.id || null,
      },
    }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} mail(s) deleted`,
  });
});

const sendMailRecord = asyncHandler(async (req, res) => {
  const mail = await Mail.findOne({ _id: req.params.id, isDeleted: false });
  if (!mail) {
    res.status(404);
    throw new Error("Mail not found");
  }

  try {
    await sendEmail({
      to: [mail.email || mail.from].filter(Boolean),
      subject: mail.subject,
      text: mail.description || mail.notes || "",
      html: mail.description || mail.notes || "",
      attachments: mail.attachments.map((item) => ({
        filename: item.originalName,
        path: item.path,
      })),
    });

    mail.status = "sent";
    mail.emailSent = true;
    mail.sentAt = new Date();
  } catch (error) {
    mail.status = "failed";
    mail.metadata = {
      ...(mail.metadata || {}),
      lastSendError: error.message,
    };
    await mail.save();
    res.status(502);
    throw new Error(`Mail send failed: ${error.message}`);
  }

  mail.updatedBy = req.user?.id || null;
  await mail.save();

  res.json({
    success: true,
    message: "Mail sent successfully",
    data: mapMailResponse(mail.toObject()),
  });
});

const downloadMailSample = asyncHandler(async (req, res) => {
  const workbook = XLSX.utils.book_new();

  const sheet1 = XLSX.utils.aoa_to_sheet([MAIL_EXCEL_HEADERS]);
  XLSX.utils.book_append_sheet(workbook, sheet1, "Sheet1");

  const maxRows = Math.max(
    MAIL_REFERENCE_FILTERS.sendEmailId.length,
    MAIL_REFERENCE_FILTERS.ipAddress.length,
    MAIL_REFERENCE_FILTERS.webTabAndType.length,
    MAIL_REFERENCE_FILTERS.emailSentType.length,
    MAIL_REFERENCE_FILTERS.status.length
  );
  const sheet2Rows = Array.from({ length: maxRows }, (_, index) => [
    MAIL_REFERENCE_FILTERS.sendEmailId[index] || "",
    MAIL_REFERENCE_FILTERS.emailSentType[index] || "",
    MAIL_REFERENCE_FILTERS.status[index] || "",
    MAIL_REFERENCE_FILTERS.ipAddress[index] || "",
    MAIL_REFERENCE_FILTERS.webTabAndType[index] || "",
  ]);
  const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(workbook, sheet2, "Sheet2");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=sample-mails.xlsx");
  res.send(buffer);
});

const normalizeImportedMail = (row) => {
  const sender = normalizeEmail(row["Email Id"] || row.from || row.sender || row["From"]);
  const companyEmail = normalizeEmail(row.email);
  const emailSent = toBoolean(row["Email sent"] ?? row.emailSent);
  const sourceDate = row.Date || row.sourceDate || row.date;
  const normalizedStatus = normalizeMailStatus(row.Status || row.status);
  const verifyEmail = cleanString(row["verify email"] || row.verifyEmail);
  const city = cleanString(row.city);
  const state = getMappedStateForCity(city) || cleanString(row.state);

  return {
    name: cleanString(row.name),
    from: sender,
    subject: cleanString(row.Subject || row.subject),
    status: normalizedStatus || (emailSent ? "sent" : "draft"),
    templateName: cleanString(row.Template || row.templateName),
    email: companyEmail,
    verifyEmail,
    city,
    state,
    ipAddress: canonicalizeReferenceValue(
      row["IP Address"] || row.ipAddress,
      MAIL_REFERENCE_FILTERS.ipAddress
    ),
    webSource: canonicalizeReferenceValue(
      row.Web || row.webSource,
      MAIL_REFERENCE_FILTERS.webTabAndType
    ),
    emailVerified: toBoolean(row["email verified"] ?? row.emailVerified) || false,
    emailSent: emailSent || false,
    sourceDate: sourceDate ? new Date(sourceDate) : undefined,
    pinCode: cleanString(row.pinCode),
    contactPerson: cleanString(row.contactPerson),
    designation: cleanString(row.designation),
    employees: row.employees === "" ? null : Number(row.employees),
    turnover: cleanString(row.turnover),
    startupCategory: cleanString(row.startupCategory),
    AEOStatus: cleanString(row.AEOStatus),
    RCMCPanel: cleanString(row.RCMCPanel),
    RCMCType: cleanString(row.RCMCType),
    industry: cleanString(row.industry),
    industryBrief: cleanString(row.industryBrief),
    leadType: cleanString(row.leadType),
    priorityRating: cleanString(row.priorityRating),
    leadSource: cleanString(row.leadSource),
    leadStatus: cleanString(row.leadStatus),
    description: row.description || "",
    notes: row.notes || "",
    metadata: row,
  };
};

const importMails = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No import file uploaded");
  }

  const workbook = XLSX.readFile(req.file.path, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
  const actualHeaders = (sheetRows[0] || []).map((header) => cleanString(header));
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

  if (
    MAIL_EXCEL_HEADERS.length !== actualHeaders.length ||
    MAIL_EXCEL_HEADERS.some((header, index) => header !== actualHeaders[index])
  ) {
    fs.unlink(req.file.path, () => { });
    res.status(400);
    throw new Error(`Invalid mail format. Expected headers: ${MAIL_EXCEL_HEADERS.join(", ")}`);
  }

  const rows = rawRows.filter((row) => Object.values(row).some((value) => cleanString(value) !== ""));

  if (!rows.length) {
    fs.unlink(req.file.path, () => { });
    res.status(400);
    throw new Error("Import file is empty");
  }

  const replaceMode = cleanString(req.query.mode).toLowerCase() === "replace";
  if (replaceMode) {
    await Mail.updateMany(
      { isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user?.id || null } }
    );
  }

  const operations = [];
  const errors = [];
  let inserted = 0;

  rows.forEach((row, index) => {
    const normalized = normalizeImportedMail(row);

    if (!normalized.subject || !normalized.from) {
      errors.push({
        rowNumber: index + 2,
        name: normalized.name,
        email: normalized.email || normalized.from,
        mobileNo: normalized.mobileNo,
        reason: "Email Id and Subject are required",
      });
      return;
    }

    if (cleanString(row["Email sent"]) && toBoolean(row["Email sent"]) === undefined) {
      errors.push({
        rowNumber: index + 2,
        name: normalized.name,
        email: normalized.email || normalized.from,
        mobileNo: normalized.mobileNo,
        reason: "Email sent must be Yes or No",
      });
      return;
    }

    if (cleanString(row.Status) && !normalized.status) {
      errors.push({
        rowNumber: index + 2,
        name: normalized.name,
        email: normalized.email || normalized.from,
        mobileNo: normalized.mobileNo,
        reason: `Status must be one of: ${MAIL_REFERENCE_FILTERS.status.join(", ")}`,
      });
      return;
    }

    normalized.dedupeKey = [
      normalized.from,
      normalized.email || "",
      normalized.subject.toLowerCase(),
      normalized.sourceDate && !Number.isNaN(new Date(normalized.sourceDate).getTime())
        ? new Date(normalized.sourceDate).toISOString().slice(0, 10)
        : "",
    ]
      .filter(Boolean)
      .join("|");

    operations.push({
      updateOne: {
        filter: normalized.dedupeKey ? { dedupeKey: normalized.dedupeKey } : { _id: null },
        update: {
          $set: {
            ...normalized,
            updatedBy: req.user?.id || null,
            isDeleted: false,
          },
          $setOnInsert: {
            mailId: undefined,
            createdBy: req.user?.id || null,
          },
        },
        upsert: true,
      },
    });
  });

  for (const operation of operations) {
    if (operation.updateOne.update.$setOnInsert.mailId === undefined) {
      operation.updateOne.update.$setOnInsert.mailId = await nextSequence("mailId", "MAIL");
    }
  }

  if (operations.length) {
    const result = await Mail.bulkWrite(operations, { ordered: false });
    inserted = (result.upsertedCount || 0) + (result.modifiedCount || 0);
  }

  fs.unlink(req.file.path, () => { });

  res.json({
    success: true,
    totalRows: rows.length,
    processed: operations.length,
    imported: inserted,
    skipped: errors.length,
    skippedDetails: errors,
  });
});

module.exports = {
  getAllMails,
  getFilterOptions,
  getMailById,
  createMail,
  updateMail,
  updateMailStatus,
  deleteMail,
  bulkUpdateMailStatus,
  bulkDeleteMails,
  sendMail: sendMailRecord,
  downloadMailSample,
  importMails,
};
