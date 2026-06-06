require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Lead = require("../src/models/Lead");
const Mail = require("../src/models/Mail");
const Counter = require("../src/models/counter.model");
const { mapLeadToMailFields } = require("../src/utils/leadMailSync");

const normalizeName = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeSource = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const scoreLead = (lead = {}) => {
  const weightedFields = [
    ["email", 5],
    ["normalizedEmail", 5],
    ["mobileNo", 4],
    ["normalizedMobileNo", 4],
    ["website", 2],
    ["address", 3],
    ["city", 2],
    ["state", 2],
    ["contactPerson", 2],
    ["designation", 1],
    ["industry", 1],
  ];

  let score = 0;
  for (const [field, weight] of weightedFields) {
    if (String(lead[field] || "").trim()) {
      score += weight;
    }
  }

  return score;
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

  const leads = await Lead.find({ isDeleted: false }).lean();
  const groups = new Map();

  for (const lead of leads) {
    const key = `${normalizeName(lead.name)}|${normalizeSource(lead.leadSource)}`;
    if (!normalizeName(lead.name)) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(lead);
  }

  const duplicateIds = [];
  const sampleRemoved = [];

  for (const groupLeads of groups.values()) {
    if (groupLeads.length <= 1) {
      continue;
    }

    const sorted = [...groupLeads].sort((a, b) => {
      const scoreDiff = scoreLead(b) - scoreLead(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const keeper = sorted[0];
    const removed = sorted.slice(1);
    removed.forEach((lead) => {
      duplicateIds.push(lead._id);
      if (sampleRemoved.length < 25) {
        sampleRemoved.push({
          removedIdNo: lead.idNo,
          keptIdNo: keeper.idNo,
          name: lead.name,
          leadSource: lead.leadSource || "",
        });
      }
    });
  }

  let deletedLeads = 0;
  if (duplicateIds.length) {
    const result = await Lead.updateMany(
      { _id: { $in: duplicateIds }, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: "Auto-deduped by normalized company name + lead source",
        },
      }
    );
    deletedLeads = result.modifiedCount || 0;
  }

  const deletedMailsResult = await Mail.updateMany(
    { isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        notes: "Auto-rebuilt from name-source deduped Leads",
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
        before: { leads: beforeLeadCount, mails: beforeMailCount },
        deletedLeads,
        rebuiltMailsDeleted: deletedMailsResult.modifiedCount || 0,
        after: { leads: afterLeadCount, mails: afterMailCount },
        countsMatch: afterLeadCount === afterMailCount,
        sampleRemoved,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Name-source dedupe and resync failed", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
