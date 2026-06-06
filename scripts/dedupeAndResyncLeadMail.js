require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Lead = require("../src/models/Lead");
const Mail = require("../src/models/Mail");
const Counter = require("../src/models/counter.model");
const { mapLeadToMailFields } = require("../src/utils/leadMailSync");
const { normalizeEmail, normalizePhone } = require("../src/utils/crm");

const normalizeName = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const qualityScore = (doc = {}) => {
  const fields = [
    doc.name,
    doc.email,
    doc.normalizedEmail,
    doc.mobileNo,
    doc.normalizedMobileNo,
    doc.website,
    doc.address,
    doc.city,
    doc.state,
    doc.pinCode,
    doc.contactPerson,
    doc.designation,
    doc.industry,
    doc.leadSource,
    doc.leadType,
    doc.leadStatus,
  ];

  return fields.reduce((score, value) => (String(value || "").trim() ? score + 1 : score), 0);
};

const buildDuplicateKeys = (lead = {}) => {
  const email = normalizeEmail(lead.email || lead.normalizedEmail);
  const mobile = normalizePhone(lead.mobileNo || lead.normalizedMobileNo);
  const name = normalizeName(lead.name);
  const source = normalizeName(lead.leadSource);
  const keys = [];

  if (email) {
    keys.push(`email:${email}`);
  }

  if (mobile) {
    keys.push(`mobile:${mobile}`);
  }

  // For panel/member-list style imports, many duplicates arrive with no email/mobile.
  // Only collapse those when both contact identifiers are missing and the name/source match exactly.
  if (!email && !mobile && name) {
    keys.push(`name-source:${name}|${source}`);
  }

  return [...new Set(keys)];
};

const pickLeadDuplicates = (leads = []) => {
  const sorted = [...leads].sort((a, b) => {
    const scoreDiff = qualityScore(b) - qualityScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  const keeperByKey = new Map();
  const duplicates = [];

  for (const lead of sorted) {
    const keys = buildDuplicateKeys(lead);
    if (!keys.length) {
      continue;
    }

    const matchedKeeper = keys
      .map((key) => keeperByKey.get(key))
      .find((keeper) => keeper && String(keeper._id) !== String(lead._id));

    if (matchedKeeper) {
      duplicates.push({
        _id: lead._id,
        idNo: lead.idNo,
        name: lead.name,
        leadSource: lead.leadSource || "",
        duplicateOf: matchedKeeper.idNo || String(matchedKeeper._id),
      });
      continue;
    }

    keys.forEach((key) => keeperByKey.set(key, lead));
  }

  return duplicates;
};

const rebuildMailsFromLeads = async () => {
  const BATCH_SIZE = 500;
  const cursor = Lead.find({ isDeleted: false }).lean().cursor();
  let batch = [];

  const flushBatch = async () => {
    if (!batch.length) {
      return;
    }

    const counter = await Counter.findOneAndUpdate(
      { name: "mailId" },
      { $inc: { value: batch.length } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const startValue = counter.value - batch.length + 1;

    const docs = batch.map((lead, index) => ({
      ...mapLeadToMailFields(lead),
      mailId: `MAIL-${String(startValue + index).padStart(6, "0")}`,
      createdBy: lead.createdBy || null,
      updatedBy: lead.updatedBy || lead.createdBy || null,
      isDeleted: false,
      deletedAt: null,
    }));

    await Mail.insertMany(docs, { ordered: false });
    batch = [];
  };

  for await (const lead of cursor) {
    batch.push(lead);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }

  await flushBatch();
};

const run = async () => {
  await connectDB();

  const beforeLeadCount = await Lead.countDocuments({ isDeleted: false });
  const beforeMailCount = await Mail.countDocuments({ isDeleted: false });

  const activeLeads = await Lead.find({ isDeleted: false }).lean();
  const duplicates = pickLeadDuplicates(activeLeads);
  const duplicateIds = duplicates.map((row) => row._id);

  let deletedLeadCount = 0;
  if (duplicateIds.length) {
    const result = await Lead.updateMany(
      { _id: { $in: duplicateIds }, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: "Auto-deduped during Lead/Mail sync cleanup",
        },
      }
    );
    deletedLeadCount = result.modifiedCount || 0;
  }

  // Rebuild Mail directly from the deduped Lead set so both tables remain exactly aligned.
  const deletedMailResult = await Mail.updateMany(
    { isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        notes: "Auto-rebuilt from deduped Leads",
      },
    }
  );

  await rebuildMailsFromLeads();

  const afterLeadCount = await Lead.countDocuments({ isDeleted: false });
  const afterMailCount = await Mail.countDocuments({ isDeleted: false });

  console.log(
    JSON.stringify(
      {
        success: true,
        before: {
          leads: beforeLeadCount,
          mails: beforeMailCount,
        },
        deletedDuplicatesFromLeads: deletedLeadCount,
        rebuiltMailsDeleted: deletedMailResult.modifiedCount || 0,
        after: {
          leads: afterLeadCount,
          mails: afterMailCount,
        },
        countsMatch: afterLeadCount === afterMailCount,
        sampleDuplicatesRemoved: duplicates.slice(0, 20),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Deduplication and resync failed", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
