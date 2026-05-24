const Lead = require("../models/Lead");
const Mail = require("../models/Mail");
const Counter = require("../models/counter.model");
const { nextSequence, normalizeEmail, normalizePhone } = require("./crm");

let isBackfillInProgress = false;

const buildLeadMatchFilter = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  return {
    isDeleted: false,
    normalizedEmail: normalized,
  };
};

const buildMailMatchFilter = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  return {
    isDeleted: false,
    $or: [{ email: normalized }, { from: normalized }],
  };
};

const mapLeadToMailFields = (lead) => {
  const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);

  return {
    idNo: lead.idNo || "",
    idDate: lead.idDate || null,
    name: lead.name || "",
    iecChaNo: lead.iecChaNo || "",
    landlineNo: lead.landlineNo || "",
    mobileNo: lead.mobileNo || "",
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
    name: mail.name || normalizedEmail || mail.subject || "Untitled Lead",
    iecChaNo: mail.iecChaNo || "",
    landlineNo: mail.landlineNo || "",
    mobileNo: mail.mobileNo || "",
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
  const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);
  if (!normalizedEmail) {
    return;
  }

  const filter = buildMailMatchFilter(normalizedEmail);
  const mailFields = mapLeadToMailFields(lead);
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
  const normalizedEmail = normalizeEmail(mail.email || mail.from);
  if (!normalizedEmail) {
    return;
  }

  const filter = buildLeadMatchFilter(normalizedEmail);
  const leadFields = mapMailToLeadFields(mail);
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
  const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);
  if (!normalizedEmail) {
    return;
  }

  await Mail.updateMany(buildMailMatchFilter(normalizedEmail), {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: userId || null,
    },
  });
};

const syncLeadStatusToMail = async (lead, userId) => {
  const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);
  if (!normalizedEmail) {
    return;
  }

  await Mail.updateMany(buildMailMatchFilter(normalizedEmail), {
    $set: {
      leadStatus: lead.leadStatus || "",
      updatedBy: userId || null,
    },
  });
};

const syncLeadsToMailBulk = async (leads, userId) => {
  const leadsByEmail = new Map();

  for (const lead of leads || []) {
    const normalizedEmail = normalizeEmail(lead.email || lead.normalizedEmail);
    if (!normalizedEmail) {
      continue;
    }
    leadsByEmail.set(normalizedEmail, lead);
  }

  const emails = [...leadsByEmail.keys()];
  if (!emails.length) {
    return;
  }

  const existingMails = await Mail.find(
    {
      isDeleted: false,
      $or: [{ email: { $in: emails } }, { from: { $in: emails } }],
    },
    { _id: 1, email: 1, from: 1 }
  ).lean();

  const existingEmailSet = new Set();
  existingMails.forEach((mail) => {
    const email = normalizeEmail(mail.email);
    const from = normalizeEmail(mail.from);
    if (email) {
      existingEmailSet.add(email);
    }
    if (from) {
      existingEmailSet.add(from);
    }
  });

  const operations = [];
  const pendingInsertIndexes = [];

  for (const [email, lead] of leadsByEmail.entries()) {
    const mailFields = mapLeadToMailFields(lead);

    if (existingEmailSet.has(email)) {
      operations.push({
        updateMany: {
          filter: buildMailMatchFilter(email),
          update: {
            $set: {
              ...mailFields,
              updatedBy: userId || null,
            },
          },
        },
      });
      continue;
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
  }

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
  syncLeadToMail,
  syncLeadsToMailBulk,
  syncMailToLead,
  syncLeadDeletionToMail,
  syncLeadStatusToMail,
};
