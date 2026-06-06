const Lead = require("../models/Lead");
const Mail = require("../models/Mail");
const Counter = require("../models/counter.model");
const { nextSequence, normalizeEmail, normalizePhone } = require("./crm");

let isBackfillInProgress = false;
const MAIL_SYNC_BATCH_SIZE = 500;

const compact = (values) => [...new Set(values.filter(Boolean))];
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

const buildMailMatchConditions = (lead = {}) => {
  const leadId = lead._id ? String(lead._id) : "";
  const idNo = lead.idNo || "";

  return compact([
    leadId ? { sourceLeadId: leadId } : null,
    idNo ? { idNo } : null,
  ]);
};

const buildLeadMatchConditions = (mail = {}) => {
  const mailId = mail._id ? String(mail._id) : "";
  const idNo = mail.idNo || "";
  const normalizedEmail = normalizeEmail(mail.email || mail.from);
  const normalizedMobile = normalizePhone(mail.mobileNo);

  return compact([
    mailId ? { sourceMailId: mailId } : null,
    idNo ? { idNo } : null,
    normalizedEmail ? { normalizedEmail } : null,
    normalizedMobile ? { normalizedMobileNo: normalizedMobile } : null,
  ]);
};

const buildMailMatchFilter = (lead = {}) => {
  const conditions = buildMailMatchConditions(lead);
  if (!conditions.length) {
    return null;
  }

  return {
    isDeleted: false,
    $or: conditions,
  };
};

const buildLeadMatchFilter = (mail = {}) => {
  const conditions = buildLeadMatchConditions(mail);
  if (!conditions.length) {
    return null;
  }

  return {
    isDeleted: false,
    $or: conditions,
  };
};

const mapLeadToMailFields = (lead) => {
  const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);

  return {
    sourceLeadId: lead._id ? String(lead._id) : lead.sourceLeadId || "",
    idNo: lead.idNo || "",
    idDate: lead.idDate || null,
    name: lead.name || "",
    iecChaNo: lead.iecChaNo || "",
    landlineNo: lead.landlineNo || "",
    mobileNo: normalizePhone(lead.mobileNo || lead.normalizedMobileNo),
    from: lead.senderEmail || "",
    email: normalizedEmail,
    subject: lead.name || normalizedEmail || "Lead Record",
    website: lead.website || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    pinCode: lead.pinCode || "",
    contactPerson: lead.contactPerson || "",
    designation: lead.designation || "",
    employees: lead.employees ?? null,
    turnover: lead.turnover || "",
    startupCategory: lead.startupCategory || "",
    AEOStatus: lead.AEOStatus || "",
    RCMCPanel: lead.RCMCPanel || "",
    RCMCType: lead.RCMCType || "",
    industry: lead.industry || "",
    industryBrief: lead.industryBrief || "",
    leadType: lead.leadType || "",
    priorityRating: lead.priorityRating || "",
    leadSource: lead.leadSource || "",
    leadStatus: lead.leadStatus || "",
    senderEmail: lead.senderEmail || "",
    emailVerifiedStatus: lead.emailVerifiedStatus || "",
    wifi: lead.wifi || "",
    browser: lead.browser || "",
    emailSentOn: lead.emailSentOn || null,
    emailTemplate: lead.emailTemplate || "",
    emailSubjectCode: lead.emailSubjectCode || "",
    emailSeen: lead.emailSeen || "",
    emailStatus: lead.emailStatus || "",
    enquiryStatus: lead.enquiryStatus || "",
    turnup: lead.turnup || "",
    cdcrNo: lead.cdcrNo || "",
    cdcrCreation: lead.cdcrCreation || null,
    description: lead.description || "",
    notes: lead.notes || "",
    isDeleted: false,
    deletedAt: null,
  };
};

const mapMailToLeadFields = (mail) => {
  const normalizedEmail = normalizeEmail(mail.email || mail.from);

  return {
    sourceMailId: mail._id ? String(mail._id) : mail.sourceMailId || "",
    name: mail.name || normalizedEmail || mail.subject || "Untitled Lead",
    iecChaNo: mail.iecChaNo || "",
    landlineNo: mail.landlineNo || "",
    mobileNo: normalizePhone(mail.mobileNo),
    normalizedMobileNo: normalizePhone(mail.mobileNo),
    email: normalizedEmail,
    normalizedEmail,
    website: mail.website || "",
    address: mail.address || "",
    city: mail.city || "",
    state: mail.state || "",
    pinCode: mail.pinCode || "",
    contactPerson: mail.contactPerson || "",
    designation: mail.designation || "",
    employees: mail.employees ?? null,
    turnover: mail.turnover || undefined,
    startupCategory: mail.startupCategory || undefined,
    AEOStatus: mail.AEOStatus || undefined,
    RCMCPanel: mail.RCMCPanel || "",
    RCMCType: mail.RCMCType || "",
    industry: mail.industry || "",
    industryBrief: mail.industryBrief || "",
    leadType: mail.leadType || undefined,
    priorityRating: mail.priorityRating || undefined,
    leadSource: mail.leadSource || undefined,
    leadStatus: mail.leadStatus || "Not Contacted",
    senderEmail: mail.senderEmail || mail.from || "",
    emailVerifiedStatus: mail.emailVerifiedStatus || "",
    wifi: mail.wifi || "",
    browser: mail.browser || "",
    emailSentOn: mail.emailSentOn || null,
    emailTemplate: mail.emailTemplate || "",
    emailSubjectCode: mail.emailSubjectCode || "",
    emailSeen: mail.emailSeen || "",
    emailStatus: mail.emailStatus || "",
    enquiryStatus: mail.enquiryStatus || "",
    turnup: mail.turnup || "",
    cdcrNo: mail.cdcrNo || "",
    cdcrCreation: mail.cdcrCreation || null,
    description: mail.description || "",
    notes: mail.notes || "",
    isDeleted: false,
    deletedAt: null,
  };
};

const syncLeadToMail = async (lead, userId) => {
  const filter = buildMailMatchFilter(lead);
  const mailFields = mapLeadToMailFields(lead);

  if (!filter) {
    await Mail.create({
      ...mailFields,
      mailId: await nextSequence("mailId", "MAIL"),
      createdBy: userId || null,
      updatedBy: userId || null,
    });
    return;
  }

  const existingMail = await Mail.findOne(filter).select("_id").lean();

  if (existingMail) {
    await Mail.updateMany(filter, {
      $set: {
        ...mailFields,
        updatedBy: userId || null,
      },
    });
    return;
  }

  await Mail.create({
    ...mailFields,
    mailId: await nextSequence("mailId", "MAIL"),
    createdBy: userId || null,
    updatedBy: userId || null,
  });
};

const syncMailToLead = async (mail, userId) => {
  const filter = buildLeadMatchFilter(mail);
  const leadFields = mapMailToLeadFields(mail);

  if (!filter) {
    await Lead.create({
      ...leadFields,
      idNo: await nextSequence("leadId", "LEAD"),
      idDate: new Date(),
      createdBy: userId || null,
      updatedBy: userId || null,
    });
    return;
  }

  const existingLead = await Lead.findOne(filter);

  if (existingLead) {
    Object.assign(existingLead, {
      ...leadFields,
      updatedBy: userId || null,
    });
    await existingLead.save();
    return;
  }

  await Lead.create({
    ...leadFields,
    idNo: await nextSequence("leadId", "LEAD"),
    idDate: new Date(),
    createdBy: userId || null,
    updatedBy: userId || null,
  });
};

const syncLeadDeletionToMail = async (lead, userId) => {
  const filter = buildMailMatchFilter(lead);
  if (!filter) {
    return;
  }

  await Mail.updateMany(filter, {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: userId || null,
    },
  });
};

const syncLeadStatusToMail = async (lead, userId) => {
  const filter = buildMailMatchFilter(lead);
  if (!filter) {
    return;
  }

  await Mail.updateMany(filter, {
    $set: {
      leadStatus: lead.leadStatus || "",
      updatedBy: userId || null,
    },
  });
};

const syncLeadsToMailBulk = async (leads, userId) => {
  const validLeads = (leads || []).filter(Boolean);
  if (!validLeads.length) {
    return;
  }

  for (const leadChunk of chunkArray(validLeads, MAIL_SYNC_BATCH_SIZE)) {
    const leadIds = compact(leadChunk.map((lead) => (lead._id ? String(lead._id) : "")));
    const idNos = compact(leadChunk.map((lead) => lead.idNo));

    const existingMails = await Mail.find(
      {
        isDeleted: false,
        $or: compact([
          leadIds.length ? { sourceLeadId: { $in: leadIds } } : null,
          idNos.length ? { idNo: { $in: idNos } } : null,
        ]),
      },
      { _id: 1, sourceLeadId: 1, idNo: 1 }
    ).lean();

    const mailLookup = new Map();
    existingMails.forEach((mail) => {
      if (mail.sourceLeadId) {
        mailLookup.set(`lead:${mail.sourceLeadId}`, mail);
      }
      if (mail.idNo) {
        mailLookup.set(`idNo:${mail.idNo}`, mail);
      }
    });

    const operations = [];
    const pendingInsertIndexes = [];

    leadChunk.forEach((lead) => {
      const leadId = lead._id ? String(lead._id) : "";
      const idNo = lead.idNo || "";
      const mailFields = mapLeadToMailFields(lead);
      const matchedMail =
        (leadId && mailLookup.get(`lead:${leadId}`)) ||
        (idNo && mailLookup.get(`idNo:${idNo}`));

      if (matchedMail) {
        operations.push({
          updateOne: {
            filter: { _id: matchedMail._id },
            update: {
              $set: {
                ...mailFields,
                updatedBy: userId || null,
              },
            },
          },
        });
        return;
      }

      operations.push({
        insertOne: {
          document: {
            ...mailFields,
            mailId: "",
            createdBy: userId || null,
            updatedBy: userId || null,
          },
        },
      });
      pendingInsertIndexes.push(operations.length - 1);
    });

    if (pendingInsertIndexes.length) {
      const counter = await Counter.findOneAndUpdate(
        { name: "mailId" },
        { $inc: { value: pendingInsertIndexes.length } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const startValue = counter.value - pendingInsertIndexes.length + 1;
      pendingInsertIndexes.forEach((operationIndex, rangeIndex) => {
        operations[operationIndex].insertOne.document.mailId = `MAIL-${String(startValue + rangeIndex).padStart(6, "0")}`;
      });
    }

    if (operations.length) {
      await Mail.bulkWrite(operations, { ordered: false });
    }
  }
};

const backfillLeadDataToMail = async () => {
  if (isBackfillInProgress) {
    return;
  }

  isBackfillInProgress = true;

  try {
    const cursor = Lead.find({ isDeleted: false }).lean().cursor();

    for await (const lead of cursor) {
      await syncLeadToMail(lead, lead.updatedBy || lead.createdBy || null);
    }
  } finally {
    isBackfillInProgress = false;
  }
};

module.exports = {
  backfillLeadDataToMail,
  mapLeadToMailFields,
  syncLeadToMail,
  syncLeadsToMailBulk,
  syncMailToLead,
  syncLeadDeletionToMail,
  syncLeadStatusToMail,
};
