const fs = require("fs");
const Mail = require("../models/Mail");
const sendEmail = require("../config/email");
const {
  MAIL_EXCEL_HEADERS,
  MAIL_REFERENCE_FILTERS,
} = require("../constants/mailExcel");
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
const { syncMailToLead } = require("../utils/leadMailSync");
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

const mergePreferredReferenceOptions = (values = [], fallback = []) =>
  [...new Set([...fallback.filter(Boolean), ...values.filter(Boolean)])];

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

const MAIL_IMPORT_HEADER_MAP = createHeaderAliasMap({
  name: ["name", "client name", "name of client", "company name"],
  iecChaNo: ["iecchano", "iec cha no", "iec/cha no"],
  landlineNo: ["landlineno", "landline no", "landline number", "telephone"],
  mobileNo: ["mobileno", "mobile no", "mobile", "mobile number", "phone", "phone number", "contact mobile"],
  email: ["email", "email address", "client email", "email id"],
  templateName: ["template", "email template"],
  subject: ["subject", "email subject"],
  sourceDate: ["date", "source date", "email sent on"],
  ipAddress: ["ip address"],
  webSource: ["web", "web source"],
  verifyEmail: ["verify email"],
  city: ["city"],
  senderEmail: ["email sent", "sender email", "from", "from email", "email id"],
  status: ["status"],
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
  leadStatus: ["leadstatus", "lead status"],
  emailVerifiedStatus: ["emailverifiedstatus", "email verified status", "email verified"],
  wifi: ["wifi"],
  browser: ["browser"],
  emailSentOn: ["emailsenton", "email sent on"],
  emailTemplate: ["emailtemplate", "email template"],
  emailSubjectCode: ["emailsubjectcode", "email subject code", "email subject"],
  emailSeen: ["emailseen", "email seen"],
  emailStatus: ["emailstatus", "email status"],
  enquiryStatus: ["enquirystatus", "enquiry status"],
  turnup: ["turnup", "turn up"],
  cdcrNo: ["cdcrno", "cdcr no", "cdcr number", "cdcr"],
  cdcrCreation: ["cdcrcreation", "cdcr creation", "cdcr creation date"],
  description: ["description"],
  notes: ["notes", "note"],
});

const mapMailSheetRowsByHeaders = (sheet) => {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) {
    return [];
  }

  const rawHeaders = matrix[0] || [];
  const normalizedHeaders = rawHeaders.map((header) => normalizeImportHeader(header));

  const mappedHeaders = rawHeaders.map((header, index) => {
    const normalized = normalizedHeaders[index];

    if (normalized === "emailid") {
      const hasCompanyEmailHeader = normalizedHeaders.includes("email");
      const hasSenderHeader = normalizedHeaders.some((item) =>
        ["emailsent", "senderemail", "from", "fromemail"].includes(item)
      );

      if (hasCompanyEmailHeader && !hasSenderHeader) {
        return "from";
      }

      if (hasSenderHeader) {
        return "email";
      }
    }

    return MAIL_IMPORT_HEADER_MAP.get(normalized) || cleanString(header);
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

const resolveMailSender = (source = {}, fallback = {}) =>
  normalizeEmail(
    source.from ??
      source.senderEmail ??
      source.emailId ??
      source.emailID ??
      source["Email Id"] ??
      source["Email ID"] ??
      source.sender ??
      source.From ??
      fallback.from ??
      fallback.emailId
  );

const resolveEmailSentValue = (source = {}, fallback) => {
  const value =
    source.emailSent ??
    source.emailSentValue ??
    source["Email sent"] ??
    source["Email Sent"] ??
    source.email_sent ??
    fallback;

  return toBoolean(value);
};

const exactMailFilterOptions = async () => {
  const baseFilter = { isDeleted: false };
  const [
    leadSource,
    senderEmail,
    fromEmail,
    templateType,
    templateSubject,
    sourceDate,
    ipAddress,
    webTabAndType,
    emailVerifiedBoolean,
    emailVerifiedStatus,
    verifyEmailRaw,
    emailSeen,
    openedMailIds,
    emailStatus,
    status,
    enquiryStatus,
    turnup,
    cdcrNo,
  ] = await Promise.all([
    Mail.distinct("leadSource", baseFilter),
    Mail.distinct("senderEmail", baseFilter),
    Mail.distinct("from", baseFilter),
    Mail.distinct("templateName", baseFilter),
    Mail.distinct("subject", baseFilter),
    Mail.distinct("sourceDate", baseFilter),
    Mail.distinct("ipAddress", baseFilter),
    Mail.distinct("webSource", baseFilter),
    Mail.distinct("emailVerified", baseFilter),
    Mail.distinct("emailVerifiedStatus", baseFilter),
    Mail.distinct("verifyEmail", baseFilter),
    Mail.distinct("emailSeen", baseFilter),
    Mail.distinct("_id", { ...baseFilter, lastOpenedAt: { $ne: null } }),
    Mail.distinct("emailStatus", baseFilter),
    Mail.distinct("status", baseFilter),
    Mail.distinct("enquiryStatus", baseFilter),
    Mail.distinct("turnup", baseFilter),
    Mail.distinct("cdcrNo", baseFilter),
  ]);

  return {
    leadSource: leadSource.filter(Boolean),
    emailId: mergePreferredReferenceOptions(
      mergeCaseInsensitiveOptions(
        [...senderEmail.filter(Boolean), ...fromEmail.filter(Boolean)],
        []
      ),
      MAIL_REFERENCE_FILTERS.sendEmailId
    ),
    sendEmailId: mergePreferredReferenceOptions(
      mergeCaseInsensitiveOptions(
        [...senderEmail.filter(Boolean), ...fromEmail.filter(Boolean)],
        []
      ),
      MAIL_REFERENCE_FILTERS.sendEmailId
    ),
    templateType: mergeReferenceOptions(templateType, MAIL_REFERENCE_FILTERS.templateType),
    templateSubject: templateSubject.filter(Boolean),
    emailDate: sourceDate.filter(Boolean).map((value) => new Date(value).toISOString().slice(0, 10)),
    ipAddress: mergeCaseInsensitiveOptions(ipAddress.filter(Boolean), MAIL_REFERENCE_FILTERS.ipAddress),
    webTabAndType: mergeCaseInsensitiveOptions(webTabAndType.filter(Boolean), MAIL_REFERENCE_FILTERS.webTabAndType),
    emailVerified: mergeReferenceOptions(
      [
        ...emailVerifiedBoolean.filter(Boolean).map((value) => (value ? "Yes" : "No")),
        ...emailVerifiedStatus.filter(Boolean),
        ...verifyEmailRaw.filter(Boolean),
      ],
      MAIL_REFERENCE_FILTERS.emailVerified
    ),
    emailSent: [...MAIL_REFERENCE_FILTERS.emailSentType],
    emailSentType: [...MAIL_REFERENCE_FILTERS.emailSentType],
    emailSeen: mergeReferenceOptions(
      [
        ...emailSeen.filter(Boolean),
        ...(openedMailIds.length ? ["Yes"] : []),
      ],
      ["Yes", "No"]
    ),
    emailStatus: mergeReferenceOptions(
      [
        ...emailStatus.filter(Boolean),
        ...status.filter(Boolean).map(denormalizeMailStatus),
      ],
      ["Active", "Stop", "Enquiry - Call", "Enquiry - Mail", "Enquiry - WhatsApp"]
    ),
    status: mergeReferenceOptions(status.filter(Boolean).map(denormalizeMailStatus), MAIL_REFERENCE_FILTERS.status),
    enquiryStatus: enquiryStatus.filter(Boolean),
    turnup: turnup.filter(Boolean),
    cdcrNo: cdcrNo.filter(Boolean),
  };
};

const buildMailPayload = (req, existing = {}) => {
  const body = req.body || {};
  const incomingAttachments = buildAttachmentMeta(req.files || []);
  const existingAttachments = Array.isArray(existing.attachments) ? existing.attachments : [];
  const preserveAttachments = toBoolean(body.preserveExistingAttachments);
  const attachments =
    preserveAttachments === false ? incomingAttachments : [...existingAttachments, ...incomingAttachments];

  const sender = resolveMailSender(body, existing);
  const companyEmail = normalizeEmail(body.email ?? existing.email);
  const sourceDateValue = body.sourceDate || body.Date || existing.sourceDate;
  const city = cleanString(body.city ?? existing.city);
  const incomingState = cleanString(body.state ?? existing.state);

  const payload = {
    name: cleanString(body.name ?? existing.name),
    iecChaNo: cleanString(body.iecChaNo ?? existing.iecChaNo),
    landlineNo: cleanString(body.landlineNo ?? existing.landlineNo),
    mobileNo: cleanString(body.mobileNo ?? existing.mobileNo),
    from: sender,
    subject: cleanString(body.subject ?? body.Subject ?? existing.subject),
    status: normalizeMailStatus(body.status ?? body.Status) || existing.status || "draft",
    templateName: cleanString(body.templateName ?? body.Template ?? existing.templateName),
    email: companyEmail,
    verifyEmail: cleanString(body.verifyEmail ?? body["verify email"] ?? existing.verifyEmail),
    website: cleanString(body.website ?? existing.website),
    address: cleanString(body.address ?? existing.address),
    city,
    state: incomingState,
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
    senderEmail: normalizeEmail(body.senderEmail ?? existing.senderEmail ?? sender),
    emailVerifiedStatus: cleanString(body.emailVerifiedStatus ?? existing.emailVerifiedStatus),
    wifi: cleanString(body.wifi ?? existing.wifi),
    browser: cleanString(body.browser ?? existing.browser),
    emailTemplate: cleanString(body.emailTemplate ?? body.templateName ?? body.Template ?? existing.emailTemplate ?? existing.templateName),
    emailSubjectCode: cleanString(body.emailSubjectCode ?? existing.emailSubjectCode),
    emailSeen: cleanString(body.emailSeen ?? existing.emailSeen),
    emailStatus: cleanString(body.emailStatus ?? existing.emailStatus),
    enquiryStatus: cleanString(body.enquiryStatus ?? existing.enquiryStatus),
    turnup: cleanString(body.turnup ?? existing.turnup),
    cdcrNo: cleanString(body.cdcrNo ?? existing.cdcrNo),
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

  const emailSent = resolveEmailSentValue(body, existing.emailSent);
  if (emailSent !== undefined) {
    payload.emailSent = emailSent;
  } else if (existing.emailSent !== undefined) {
    payload.emailSent = existing.emailSent;
  }

  if (sourceDateValue) {
    const sourceDate = new Date(sourceDateValue);
    if (!Number.isNaN(sourceDate.getTime())) {
      payload.sourceDate = sourceDate;
      payload.emailSentOn = sourceDate;
    }
  }

  const cdcrCreationValue = body.cdcrCreation || existing.cdcrCreation;
  if (cdcrCreationValue) {
    const cdcrCreation = new Date(cdcrCreationValue);
    if (!Number.isNaN(cdcrCreation.getTime())) {
      payload.cdcrCreation = cdcrCreation;
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
  emailId: mail.from || "",
  "Sr No": mail.metadata?.["Sr No"] || "",
  name: mail.name || "",
  iecChaNo: mail.iecChaNo || "",
  landlineNo: mail.landlineNo || "",
  mobileNo: mail.mobileNo || "",
  "Email Id": mail.from,
  senderEmail: mail.senderEmail || "",
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
  emailVerifiedStatus: mail.emailVerifiedStatus || "",
  wifi: mail.wifi || "",
  browser: mail.browser || "",
  emailSentOn: mail.emailSentOn || mail.sourceDate || "",
  emailTemplate: mail.emailTemplate || mail.templateName || "",
  emailSubjectCode: mail.emailSubjectCode || "",
  emailSeen: mail.emailSeen || (mail.lastOpenedAt ? "Yes" : ""),
  emailStatus: mail.emailStatus || denormalizeMailStatus(mail.status),
  enquiryStatus: mail.enquiryStatus || "",
  turnup: mail.turnup || "",
  cdcrNo: mail.cdcrNo || "",
  cdcrCreation: mail.cdcrCreation || "",
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
    emailId: "from",
    leadSource: "leadSource",
    templateType: "templateName",
    templateSubject: "subject",
    ipAddress: "ipAddress",
    webTabAndType: "webSource",
    city: "city",
    state: "state",
    emailStatus: "emailStatus",
    enquiryStatus: "enquiryStatus",
    turnup: "turnup",
    cdcrNo: "cdcrNo",
  };

  const legacyEmailSentSenderFilter =
    cleanString(query.emailSent) && toBoolean(query.emailSent) === undefined ? query.emailSent : undefined;
  const sendEmailIds = normalizeStringList(query.emailId || query.sendEmailId || legacyEmailSentSenderFilter);
  const blankSelected = sendEmailIds.some((value) => cleanString(value).toLowerCase() === "blank");
  const actualSendEmailIds = sendEmailIds.filter((value) => cleanString(value).toLowerCase() !== "blank");

  if (actualSendEmailIds.length === 1 || blankSelected) {
    const orConditions = [];

    if (actualSendEmailIds.length === 1) {
      orConditions.push(
        { from: { $regex: `^${escapeRegex(actualSendEmailIds[0])}$`, $options: "i" } },
        { senderEmail: { $regex: `^${escapeRegex(actualSendEmailIds[0])}$`, $options: "i" } }
      );
    }

    if (blankSelected) {
      orConditions.push(
        { from: { $in: ["", null] } },
        { senderEmail: { $in: ["", null] } }
      );
    }

    filter.$and = [
      ...(filter.$and || []),
      {
        $or: orConditions,
      },
    ];
  } else if (actualSendEmailIds.length > 1) {
    const orConditions = actualSendEmailIds.flatMap((value) => ([
      { from: { $regex: `^${escapeRegex(value)}$`, $options: "i" } },
      { senderEmail: { $regex: `^${escapeRegex(value)}$`, $options: "i" } },
    ]));

    if (blankSelected) {
      orConditions.push(
        { from: { $in: ["", null] } },
        { senderEmail: { $in: ["", null] } }
      );
    }

    filter.$and = [
      ...(filter.$and || []),
      {
        $or: orConditions,
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
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { emailVerified: boolValue },
            { emailVerifiedStatus: { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" } },
            { verifyEmail: { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" } },
          ],
        },
      ];
    } else {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { emailVerifiedStatus: { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" } },
            { verifyEmail: { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" } },
          ],
        },
      ];
    }
  }

  if (cleanString(query.emailSeen)) {
    const rawValue = cleanString(query.emailSeen);
    const boolValue = toBoolean(rawValue);
    if (boolValue === true) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { emailSeen: { $regex: "^Yes$", $options: "i" } },
            { lastOpenedAt: { $ne: null } },
          ],
        },
      ];
    } else if (boolValue === false) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { emailSeen: { $regex: "^No$", $options: "i" } },
            {
              $and: [
                {
                  $or: [
                    { emailSeen: { $exists: false } },
                    { emailSeen: "" },
                    { emailSeen: null },
                  ],
                },
                {
                  $or: [
                    { lastOpenedAt: { $exists: false } },
                    { lastOpenedAt: null },
                  ],
                },
              ],
            },
          ],
        },
      ];
    } else {
      filter.emailSeen = { $regex: `^${escapeRegex(rawValue)}$`, $options: "i" };
    }
  }

  const emailSentFilterValue = cleanString(query.emailSentType)
    ? query.emailSentType
    : cleanString(query.emailSent) && toBoolean(query.emailSent) !== undefined
      ? query.emailSent
      : undefined;

  if (emailSentFilterValue !== undefined) {
    const boolValue = toBoolean(emailSentFilterValue);
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
  await syncMailToLead(mail.toObject(), req.user?.id);
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
  await syncMailToLead(existing.toObject(), req.user?.id);

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

  await syncMailToLead(mail, req.user?.id);

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

  const updatedMails = await Mail.find({ _id: { $in: req.body.ids }, isDeleted: false }).lean();
  for (const mail of updatedMails) {
    await syncMailToLead(mail, req.user?.id);
  }

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
  await syncMailToLead(mail.toObject(), req.user?.id);

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
  const sender = resolveMailSender(row);
  const companyEmail = normalizeEmail(row.email);
  const emailSent = resolveEmailSentValue(row);
  const sourceDate = row.Date || row.sourceDate || row.date;
  const normalizedStatus = normalizeMailStatus(row.Status || row.status);
  const verifyEmail = cleanString(row["verify email"] || row.verifyEmail);
  const city = cleanString(row.city || row.__empty_7 || row.__empty_8);
  const state = cleanString(row.state || row.__empty_9 || row.__empty_10);

  return {
    name: cleanString(row.name),
    iecChaNo: cleanString(row.iecChaNo),
    landlineNo: cleanString(row.landlineNo),
    mobileNo: cleanString(row.mobileNo),
    from: sender,
    emailId: sender,
    subject: cleanString(row.Subject || row.subject),
    status: normalizedStatus || (emailSent ? "sent" : "draft"),
    templateName: cleanString(row.Template || row.templateName),
    email: companyEmail,
    verifyEmail,
    website: cleanString(row.website),
    address: cleanString(row.address),
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
    senderEmail: sender,
    emailVerifiedStatus: cleanString(row.emailVerifiedStatus || row["EMAIL VERIFIED"]),
    wifi: cleanString(row.wifi || row.WIFI),
    browser: cleanString(row.browser || row.BROWSER),
    emailSentOn: sourceDate ? new Date(sourceDate) : undefined,
    emailTemplate: cleanString(row.emailTemplate || row["Email Template"] || row.Template),
    emailSubjectCode: cleanString(row.emailSubjectCode || row["Email Subject"]),
    emailSeen: cleanString(row.emailSeen || row["Email Seen"]),
    emailStatus: cleanString(row.emailStatus || row["Email Status"]),
    enquiryStatus: cleanString(row.enquiryStatus || row["Enquiry Status"]),
    turnup: cleanString(row.turnup || row.Turnup || row["Turn Up"]),
    cdcrNo: cleanString(row.cdcrNo || row["CDCR NO"]),
    cdcrCreation:
      row.cdcrCreation || row["CDCR Creation"]
        ? new Date(row.cdcrCreation || row["CDCR Creation"])
        : undefined,
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
  const rows = mapMailSheetRowsByHeaders(firstSheet);

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

    if (
      cleanString(row["Email sent"] ?? row["Email Sent"] ?? row.emailSent ?? row.emailSentValue) &&
      resolveEmailSentValue(row) === undefined
    ) {
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

  const importedEmails = rows
    .map((row) => normalizeEmail(row.email || resolveMailSender(row)))
    .filter(Boolean);

  if (importedEmails.length) {
    const syncedMails = await Mail.find({
      isDeleted: false,
      $or: [{ email: { $in: importedEmails } }, { from: { $in: importedEmails } }],
    }).lean();

    for (const mail of syncedMails) {
      await syncMailToLead(mail, req.user?.id);
    }
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
