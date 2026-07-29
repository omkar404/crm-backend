const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");
const Campaign = require("../models/Campaign");
const CampaignAudience = require("../models/CampaignAudience");
const CampaignSend = require("../models/CampaignSend");
const Lead = require("../models/Lead");
const Mail = require("../models/Mail");
const Counter = require("../models/counter.model");
const sendEmail = require("../config/email");
const { nextSequence } = require("../utils/crm");
const { getProfessionalCampaignSubject } = require("../utils/leadMailSync");

const cleanString = (value) => String(value || "").trim();
const BLOCKED_SENDER_ACCOUNTS = new Set(["omkarmhetar105@gmail.com"]);

const EMAIL_SENT_FILTER_OPTIONS = [
  "jaggdish@eximinq-connect.in",
  "jaggdish@eximinq-audit.in",
  "jaggdish@eximinq-group.in",
  "jaggdish@eximinq-info.in",
  "jaggdish.a@eximinq-advisory.in",
  "jaggdish.acharya@eximinq-global.in",
  "j.acharya@eximinq-desk.in",
  "jaggdish.a@eximinq-exim.in",
  "jaggdish.acharya@eximinq-services.in",
  "Blank",
];

const ENQUIRY_STATUS_OPTIONS = ["Pending", "Reverted", "Close", "No Revert"];
const TURNUP_OPTIONS = ["Yes", "No"];

const mergeFilterOptions = (...optionSets) => [
  ...new Set(optionSets.flat().map((value) => cleanString(value)).filter(Boolean)),
];

const chunkArray = (items = [], size = 1000) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const mergeCaseInsensitiveOptions = (values = [], fallback = []) => {
  const canonical = new Map();
  fallback.filter(Boolean).forEach((item) => {
    canonical.set(cleanString(item).toLowerCase(), item);
  });
  values.filter(Boolean).forEach((item) => {
    const key = cleanString(item).toLowerCase();
    if (key && !canonical.has(key)) {
      canonical.set(key, item);
    }
  });
  return [...canonical.values()];
};

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const mapCampaign = (campaign) => ({
  _id: campaign._id,
  name: campaign.name,
  description: campaign.description || "",
  status: campaign.status,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

const mapCampaignSend = (send) => ({
  _id: send._id,
  campaignId: send.campaignId,
  campaignName: send.campaignName,
  leadId: send.leadId,
  leadSnapshot: send.leadSnapshot || {},
  sentFrom: send.sentFrom,
  sentTo: send.sentTo,
  subject: send.subject,
  status: send.status,
  emailStatus: send.emailStatus,
  emailSeen: send.emailSeen,
  sentAt: send.sentAt,
  openedAt: send.openedAt,
  providerMessageId: send.providerMessageId,
  errorMessage: send.errorMessage,
  previousSendId: send.previousSendId,
  createdAt: send.createdAt,
});

const mapCampaignAudience = (audience) => ({
  _id: audience._id,
  campaignId: audience.campaignId,
  campaignName: audience.campaignName,
  leadId: audience.leadId,
  ...(audience.leadSnapshot || {}),
  campaignStatus: audience.campaignStatus || "Draft",
  emailSentFrom: audience.emailSentFrom || "",
  emailSeen: audience.emailSeen || "No",
  emailStatus: audience.emailStatus || "Draft",
  enquiryStatus: audience.enquiryStatus || "",
  turnup: audience.turnup || "",
  createdAt: audience.createdAt,
  updatedAt: audience.updatedAt,
});

const createLeadSnapshot = (lead) => ({
  idNo: lead.idNo || "",
  name: lead.name || "",
  email: lead.email || "",
  mobileNo: lead.mobileNo || "",
  website: lead.website || "",
  industry: lead.industry || "",
  RCMCPanel: lead.RCMCPanel || "",
  RCMCType: lead.RCMCType || "",
  leadSource: lead.leadSource || "",
  leadType: lead.leadType || "",
  priorityRating: lead.priorityRating || "",
  leadStatus: lead.leadStatus || "",
  emailVerifiedStatus: lead.emailVerifiedStatus || "",
  cdcrNo: lead.cdcrNo || "",
});

const buildCampaignMailPayload = ({ campaign, lead, body, subject, userId, existing = {}, sendRecord = null }) => {
  const sentAt = sendRecord?.sentAt || null;
  const isSent = sendRecord?.status === "sent";
  const campaignDisplayName =
    cleanString(sendRecord?.subject) ||
    cleanString(subject) ||
    cleanString(existing.metadata?.campaignName) ||
    getProfessionalCampaignSubject(campaign.name);

  return {
    name: lead.name || "",
    mobileNo: lead.mobileNo || "",
    from: isSent ? sendRecord.sentFrom || "" : existing.from || "",
    senderEmail: isSent ? sendRecord.sentFrom || "" : existing.senderEmail || "",
    subject: campaignDisplayName,
    templateName: campaignDisplayName,
    email: sendRecord?.sentTo || lead.email || "",
    website: lead.website || "",
    emailVerified: true,
    verifyEmail: "Yes",
    emailVerifiedStatus: "Yes",
    emailSent: isSent ? true : existing.emailSent || false,
    status: isSent ? "sent" : existing.status || "draft",
    sourceDate: sentAt || existing.sourceDate || null,
    emailSentOn: sentAt || existing.emailSentOn || null,
    sentAt: sentAt || existing.sentAt || null,
    RCMCPanel: lead.RCMCPanel || "",
    RCMCType: lead.RCMCType || "",
    industry: lead.industry || "",
    leadType: lead.leadType || "",
    priorityRating: lead.priorityRating || "",
    leadSource: lead.leadSource || "",
    leadStatus: lead.leadStatus || "",
    emailTemplate: campaignDisplayName,
    emailSubjectCode: campaignDisplayName,
    emailSeen: existing.emailSeen || "No",
    emailStatus: isSent ? "Sent" : existing.emailStatus || "Draft",
    enquiryStatus: existing.enquiryStatus || "",
    turnup: existing.turnup || "",
    cdcrNo: lead.cdcrNo || "",
    description: body || existing.description || "",
    notes: `Campaign: ${campaignDisplayName}`,
    sourceLeadId: String(lead._id),
    updatedBy: userId || null,
    metadata: {
      ...(existing.metadata || {}),
      source: "campaign",
      campaignMirror: false,
      createdFromCampaign: true,
      campaignId: String(campaign._id),
      campaignName: campaignDisplayName,
      panelName: campaign.name,
      campaignSendId: sendRecord?._id ? String(sendRecord._id) : existing.metadata?.campaignSendId || "",
      leadId: String(lead._id),
      providerMessageId: sendRecord?.providerMessageId || existing.metadata?.providerMessageId || "",
    },
  };
};

const upsertCampaignMail = async ({ campaign, lead, body, userId, sendRecord = null }) => {
  const existing = await Mail.findOne({
    "metadata.source": "campaign",
    "metadata.campaignId": String(campaign._id),
    "metadata.leadId": String(lead._id),
  });

  const payload = buildCampaignMailPayload({
    campaign,
    lead,
    body,
    subject: sendRecord?.subject,
    userId,
    existing: existing?.toObject?.() || existing || {},
    sendRecord,
  });

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return Mail.create({
    ...payload,
    mailId: await nextSequence("mailId", "MAIL"),
    createdBy: userId || null,
  });
};

const publishCampaignSendToMail = async ({ campaign, lead, sendRecord, body, userId }) => {
  if (sendRecord.status !== "sent") return null;
  return upsertCampaignMail({ campaign, lead, sendRecord, body, userId });
};

const reserveMailIds = async (count) => {
  if (!count) return [];

  const counter = await Counter.findOneAndUpdate(
    { name: "mailId" },
    { $inc: { value: count } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const start = counter.value - count + 1;

  return Array.from({ length: count }, (_, index) => `MAIL-${String(start + index).padStart(6, "0")}`);
};

const publishCampaignAudienceToMail = async ({ campaign, leads, body, subject, userId }) => {
  if (!leads.length) return { created: 0, updated: 0 };

  const leadIds = leads.map((lead) => String(lead._id));
  const existingMails = await Mail.find({
    "metadata.source": "campaign",
    "metadata.campaignId": String(campaign._id),
    "metadata.leadId": { $in: leadIds },
  }).lean();
  const existingByLeadId = new Map(
    existingMails.map((mail) => [String(mail.metadata?.leadId || ""), mail])
  );
  const newLeadCount = leads.reduce(
    (count, lead) => count + (existingByLeadId.has(String(lead._id)) ? 0 : 1),
    0
  );
  const mailIds = await reserveMailIds(newLeadCount);
  let nextMailIdIndex = 0;
  let created = 0;
  let updated = 0;

  const operations = leads.map((lead) => {
    const leadId = String(lead._id);
    const existing = existingByLeadId.get(leadId);
    const payload = buildCampaignMailPayload({
      campaign,
      lead,
      body,
      subject,
      userId,
      existing: existing || {},
    });

    if (existing?._id) {
      updated += 1;
      return {
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: payload },
        },
      };
    }

    created += 1;
    return {
      insertOne: {
        document: {
          ...payload,
          mailId: mailIds[nextMailIdIndex++],
          createdBy: userId || null,
        },
      },
    };
  });

  for (let index = 0; index < operations.length; index += 1000) {
    await Mail.bulkWrite(operations.slice(index, index + 1000), { ordered: false });
  }

  return { created, updated };
};

const buildAudienceLeadQuery = ({ panel, leadSource, RCMCPanel, RCMCType }) => {
  const filter = {
    isDeleted: false,
    emailVerifiedStatus: { $regex: "^Yes$", $options: "i" },
  };
  const panelValue = cleanString(panel);

  if (panelValue) {
    if (/website/i.test(panelValue)) {
      filter.leadSource = { $regex: "^Website$", $options: "i" };
    } else if (/rcmc/i.test(panelValue)) {
      filter.leadSource = { $regex: "RCMC", $options: "i" };
    } else if (/epr/i.test(panelValue)) {
      filter.$or = [
        { RCMCPanel: { $regex: "EPR", $options: "i" } },
        { leadSource: { $regex: "EPR", $options: "i" } },
      ];
    } else if (/epcg/i.test(panelValue)) {
      filter.$or = [
        { RCMCPanel: { $regex: "EPCG", $options: "i" } },
        { RCMCType: { $regex: "EPCG", $options: "i" } },
        { leadSource: { $regex: "EPCG", $options: "i" } },
      ];
    } else {
      const normalizedPanel = panelValue.replace(/\s*Panel$/i, "");
      filter.$or = [
        { RCMCPanel: { $regex: normalizedPanel, $options: "i" } },
        { leadSource: { $regex: normalizedPanel, $options: "i" } },
      ];
    }
  }

  if (cleanString(leadSource)) filter.leadSource = leadSource;
  if (cleanString(RCMCPanel)) filter.RCMCPanel = RCMCPanel;
  if (cleanString(RCMCType)) filter.RCMCType = RCMCType;

  return filter;
};

const buildDateRange = (dateValue) => {
  const rawValue = cleanString(dateValue);
  if (!rawValue) return null;

  const start = new Date(rawValue);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  return { $gte: start, $lte: end };
};

const getNameInitialRegex = (ranges = []) => {
  const selected = Array.isArray(ranges) ? ranges : String(ranges || "").split(",");
  const pieces = selected.map(cleanString).filter(Boolean);
  const letters = new Set();

  pieces.forEach((range) => {
    if (range === "A-H") "ABCDEFGH".split("").forEach((letter) => letters.add(letter));
    if (range === "I-P") "IJKLMNOP".split("").forEach((letter) => letters.add(letter));
    if (range === "Q-Z") "QRSTUVWXYZ".split("").forEach((letter) => letters.add(letter));
  });

  return letters.size ? { $regex: `^[${[...letters].join("")}]`, $options: "i" } : null;
};

const buildCampaignLeadQuery = (query) => {
  const filter = {};
  const search = cleanString(query.search);
  const campaignId = toObjectId(query.campaignId);

  if (campaignId) {
    filter.campaignId = campaignId;
  }

  ["emailSeen", "emailStatus", "enquiryStatus", "turnup"].forEach(
    (field) => {
      if (cleanString(query[field])) {
        filter[field] = query[field];
      }
    }
  );

  ["leadSource", "RCMCPanel", "RCMCType", "cdcrNo"].forEach((field) => {
    if (cleanString(query[field])) {
      filter[`leadSnapshot.${field}`] = query[field];
    }
  });

  if (cleanString(query.emailVerified)) {
    filter["leadSnapshot.emailVerifiedStatus"] = { $regex: `^${cleanString(query.emailVerified)}$`, $options: "i" };
  }

  if (cleanString(query.emailSent)) {
    if (query.emailSent === "Blank") {
      filter.$or = [{ emailSentFrom: { $exists: false } }, { emailSentFrom: "" }];
    } else {
      filter.emailSentFrom = { $regex: `^${cleanString(query.emailSent)}$`, $options: "i" };
    }
  }

  const emailSentOn = buildDateRange(query.emailSentOn);
  if (emailSentOn) {
    filter.updatedAt = emailSentOn;
  }

  const nameInitialRegex = getNameInitialRegex(query.nameInitialRanges);
  if (nameInitialRegex) {
    filter["leadSnapshot.name"] = nameInitialRegex;
  }

  if (search) {
    const regex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { "leadSnapshot.idNo": regex },
          { "leadSnapshot.name": regex },
          { "leadSnapshot.email": regex },
          { "leadSnapshot.mobileNo": regex },
          { "leadSnapshot.leadSource": regex },
          { "leadSnapshot.RCMCPanel": regex },
          { "leadSnapshot.RCMCType": regex },
          { campaignName: regex },
        ],
      },
    ];
  }

  return filter;
};

const buildCampaignLeadFilterOptions = async () => {
  const baseFilter = { isDeleted: false };
  const [
    leadSource,
    RCMCPanel,
    RCMCType,
    emailVerifiedStatus,
    emailSeen,
    emailStatus,
    enquiryStatus,
    turnup,
    cdcrNo,
  ] = await Promise.all([
    Lead.distinct("leadSource", baseFilter),
    Lead.distinct("RCMCPanel", baseFilter),
    Lead.distinct("RCMCType", baseFilter),
    Lead.distinct("emailVerifiedStatus", baseFilter),
    Lead.distinct("emailSeen", baseFilter),
    Lead.distinct("emailStatus", baseFilter),
    Lead.distinct("enquiryStatus", baseFilter),
    Lead.distinct("turnup", baseFilter),
    Lead.distinct("cdcrNo", baseFilter),
  ]);

  const dbTypesByPanelDocs = await Lead.aggregate([
    { $match: { isDeleted: false, RCMCPanel: { $ne: "" }, RCMCType: { $ne: "" } } },
    { $group: { _id: "$RCMCPanel", values: { $addToSet: "$RCMCType" } } },
  ]);
  const dbTypesByPanel = Object.fromEntries(
    dbTypesByPanelDocs.map((row) => [cleanString(row._id), mergeFilterOptions(row.values || [])])
  );
  const panelOptions = mergeFilterOptions(RCMCPanel);
  const rcmcTypeMap = {};
  panelOptions.forEach((panel) => {
    rcmcTypeMap[panel] = mergeFilterOptions(dbTypesByPanel[panel] || []);
  });

  return {
    leadSource: mergeFilterOptions(leadSource),
    RCMCPanel: panelOptions,
    RCMCType: mergeFilterOptions(RCMCType),
    RCMCTypeMap: rcmcTypeMap,
    emailVerified: ["Yes"],
    emailSent: EMAIL_SENT_FILTER_OPTIONS,
    emailSeen: mergeFilterOptions(["Yes", "No"], emailSeen),
    emailStatus: mergeFilterOptions(["Active", "Stop", "Enquiry - Call", "Enquiry - Mail", "Enquiry - WhatsApp"], emailStatus),
    enquiryStatus: mergeFilterOptions(ENQUIRY_STATUS_OPTIONS, enquiryStatus),
    turnup: mergeFilterOptions(TURNUP_OPTIONS, turnup),
    cdcrNo: mergeFilterOptions(cdcrNo),
  };
};

const resolveCampaign = async ({ campaignId, campaignName, userId }) => {
  const cleanName = cleanString(campaignName);

  if (campaignId) {
    const objectId = toObjectId(campaignId);
    if (!objectId) return null;
    return Campaign.findOne({ _id: objectId, status: { $ne: "archived" } });
  }

  if (!cleanName) return null;

  return Campaign.findOneAndUpdate(
    { name: cleanName },
    {
      $setOnInsert: {
        name: cleanName,
        status: "active",
        createdBy: userId || null,
      },
      $set: { updatedBy: userId || null },
    },
    { new: true, upsert: true }
  );
};

const listCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await Campaign.find({ status: { $ne: "archived" } })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, campaigns: campaigns.map(mapCampaign) });
});

const listCampaignLeads = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const filter = buildCampaignLeadQuery(req.query);
  const includeFilters = String(req.query.includeFilters || "").toLowerCase() === "true";

  const [total, leads] = await Promise.all([
    CampaignAudience.countDocuments(filter),
    CampaignAudience.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const response = {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    leads: leads.map(mapCampaignAudience),
  };

  if (includeFilters) {
    response.filterOptions = await buildCampaignLeadFilterOptions();
  }

  res.json(response);
});

const createCampaign = asyncHandler(async (req, res) => {
  const name = cleanString(req.body.name);
  if (!name) {
    res.status(400);
    throw new Error("Campaign name is required");
  }

  const campaign = await Campaign.findOneAndUpdate(
    { name },
    {
      $setOnInsert: {
        name,
        createdBy: req.user?.id || null,
      },
      $set: {
        description: cleanString(req.body.description),
        status: cleanString(req.body.status) || "active",
        updatedBy: req.user?.id || null,
      },
    },
    { new: true, upsert: true }
  );

  res.status(201).json({ success: true, campaign: mapCampaign(campaign) });
});

const generateCampaignAudience = asyncHandler(async (req, res) => {
  const campaignSubject = cleanString(req.body.subject);
  const campaign = await resolveCampaign({
    campaignId: req.body.campaignId,
    campaignName: req.body.campaignName,
    userId: req.user?.id,
  });

  if (!campaign) {
    res.status(400);
    throw new Error("Campaign is required");
  }

  const leadFilter = buildAudienceLeadQuery({
    panel: req.body.panel || req.body.campaignName,
    leadSource: req.body.leadSource,
    RCMCPanel: req.body.RCMCPanel,
    RCMCType: req.body.RCMCType,
  });
  const leads = await Lead.find(leadFilter).sort({ createdAt: -1, _id: -1 }).lean();
  const eligibleLeadIds = leads.map((lead) => lead._id);
  const operations = leads.map((lead) => ({
    updateOne: {
      filter: { campaignId: campaign._id, leadId: lead._id },
      update: {
        $set: {
          campaignName: campaignSubject || getProfessionalCampaignSubject(campaign.name),
          leadSnapshot: createLeadSnapshot(lead),
          campaignStatus: "Draft",
          emailSentFrom: "",
          emailSeen: "No",
          emailStatus: "Draft",
          enquiryStatus: "",
          turnup: "",
          generatedBy: req.user?.id || null,
        },
      },
      upsert: true,
    },
  }));

  for (const operationChunk of chunkArray(operations, 1000)) {
    await CampaignAudience.bulkWrite(operationChunk, { ordered: false });
  }

  await CampaignAudience.deleteMany({
    campaignId: campaign._id,
    leadId: { $nin: eligibleLeadIds },
  });

  await publishCampaignAudienceToMail({
    campaign,
    leads,
    body: req.body.body || "",
    subject: campaignSubject,
    userId: req.user?.id,
  });

  await Mail.deleteMany({
    "metadata.source": "campaign",
    "metadata.campaignId": String(campaign._id),
    "metadata.leadId": { $nin: eligibleLeadIds.map((id) => String(id)) },
    emailSent: { $ne: true },
  });

  const audience = await CampaignAudience.find({ campaignId: campaign._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();

  res.status(201).json({
    success: true,
    campaign: mapCampaign(campaign),
    generated: leads.length,
    audience: audience.map(mapCampaignAudience),
  });
});

const listCampaignAudience = asyncHandler(async (req, res) => {
  const campaignId = toObjectId(req.query.campaignId);
  if (!campaignId) {
    res.json({ success: true, total: 0, audience: [] });
    return;
  }

  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
  const skip = (page - 1) * limit;
  const filter = { campaignId };

  const [total, audience] = await Promise.all([
    CampaignAudience.countDocuments(filter),
    CampaignAudience.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
  ]);

  res.json({
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    audience: audience.map(mapCampaignAudience),
  });
});

const listSenderAccounts = asyncHandler(async (req, res) => {
  const configured = [
    process.env.SMTP_FROM,
    process.env.SMTP_USER,
    process.env.GMAIL_USER,
  ].filter(Boolean);
  const history = await CampaignSend.distinct("sentFrom");
  const senders = [
    ...new Set([...configured, ...history].map((item) => cleanString(item).toLowerCase()).filter(Boolean)),
  ].filter((sender) => !BLOCKED_SENDER_ACCOUNTS.has(sender));

  res.json({ success: true, senders });
});

const listCampaignHistory = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.leadId) {
    const leadId = toObjectId(req.query.leadId);
    if (leadId) filter.leadId = leadId;
  }

  if (req.query.campaignId) {
    const campaignId = toObjectId(req.query.campaignId);
    if (campaignId) filter.campaignId = campaignId;
  }

  const sends = await CampaignSend.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, history: sends.map(mapCampaignSend) });
});

const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const match = {};
  const audienceMatch = {};
  if (req.query.campaignId) {
    const campaignId = toObjectId(req.query.campaignId);
    if (campaignId) {
      match.campaignId = campaignId;
      audienceMatch.campaignId = campaignId;
    }
  }

  const [
    statusCounts,
    senderCounts,
    totalLeads,
    totalCampaigns,
    audienceRecords,
    audienceLeads,
    campaignNames,
  ] = await Promise.all([
    CampaignSend.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    CampaignSend.aggregate([
      { $match: match },
      { $group: { _id: "$sentFrom", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    CampaignSend.distinct("leadId", match),
    Campaign.countDocuments({ status: { $ne: "archived" } }),
    CampaignAudience.countDocuments(audienceMatch),
    CampaignAudience.distinct("leadId", audienceMatch),
    CampaignAudience.distinct("campaignName", {}),
  ]);

  const totalSends = statusCounts.reduce((sum, item) => sum + item.count, 0);

  res.json({
    success: true,
    analytics: {
      totalCampaigns,
      audienceRecords,
      uniqueAudienceLeads: audienceLeads.length,
      campaignNames: mergeFilterOptions(campaignNames),
      totalSends,
      uniqueLeads: totalLeads.length,
      byStatus: statusCounts.map((item) => ({ status: item._id || "unknown", count: item.count })),
      bySender: senderCounts.map((item) => ({ sender: item._id || "unknown", count: item.count })),
    },
  });
});

const sendCampaign = asyncHandler(async (req, res) => {
  const leadIds = Array.isArray(req.body.leadIds) ? req.body.leadIds : [req.body.leadId].filter(Boolean);
  const objectIds = leadIds.map(toObjectId).filter(Boolean);
  const sentFrom = cleanString(req.body.sentFrom).toLowerCase();
  const subject = cleanString(req.body.subject);
  const body = cleanString(req.body.body);
  const previousSendId = toObjectId(req.body.previousSendId);

  if (!objectIds.length) {
    res.status(400);
    throw new Error("At least one lead is required");
  }

  if (!sentFrom) {
    res.status(400);
    throw new Error("Sender email is required");
  }

  if (!subject) {
    res.status(400);
    throw new Error("Subject is required");
  }

  const campaign = await resolveCampaign({
    campaignId: req.body.campaignId,
    campaignName: req.body.campaignName,
    userId: req.user?.id,
  });

  if (!campaign) {
    res.status(400);
    throw new Error("Campaign is required");
  }

  const leads = await Lead.find({
    _id: { $in: objectIds },
    isDeleted: false,
    emailVerifiedStatus: { $regex: "^Yes$", $options: "i" },
  }).lean();
  const results = [];

  for (const lead of leads) {
    const sentTo = cleanString(lead.email).toLowerCase();
    const sendRecord = await CampaignSend.create({
      campaignId: campaign._id,
      campaignName: subject,
      leadId: lead._id,
      leadSnapshot: createLeadSnapshot(lead),
      sentFrom,
      sentTo: sentTo || "missing-email",
      subject,
      body,
      status: "queued",
      emailStatus: "Queued",
      previousSendId: previousSendId || null,
      createdBy: req.user?.id || null,
    });

    if (!sentTo) {
      sendRecord.status = "failed";
      sendRecord.emailStatus = "Failed";
      sendRecord.errorMessage = "Lead does not have an email address";
      await sendRecord.save();
      results.push(mapCampaignSend(sendRecord.toObject()));
      continue;
    }

    try {
      const info = await sendEmail({
        from: sentFrom,
        to: sentTo,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br />"),
      });

      sendRecord.status = "sent";
      sendRecord.emailStatus = "Sent";
      sendRecord.sentAt = new Date();
      sendRecord.providerMessageId = info?.messageId || "";
    } catch (error) {
      sendRecord.status = "failed";
      sendRecord.emailStatus = "Failed";
      sendRecord.errorMessage = error.message;
    }

    await sendRecord.save();
    await CampaignAudience.findOneAndUpdate(
      { campaignId: campaign._id, leadId: lead._id },
      {
        $set: {
          emailSentFrom: sentFrom,
          emailStatus: sendRecord.emailStatus,
          campaignStatus: sendRecord.status === "sent" ? "Email Sent" : "Draft",
        },
      }
    );
    await publishCampaignSendToMail({
      campaign,
      lead,
      sendRecord,
      body,
      userId: req.user?.id,
    });
    results.push(mapCampaignSend(sendRecord.toObject()));
  }

  res.status(201).json({
    success: true,
    campaign: mapCampaign(campaign),
    sends: results,
  });
});

module.exports = {
  createCampaign,
  generateCampaignAudience,
  getCampaignAnalytics,
  listCampaignAudience,
  listCampaignLeads,
  listCampaignHistory,
  listCampaigns,
  listSenderAccounts,
  sendCampaign,
};
