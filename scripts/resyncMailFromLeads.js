require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Lead = require("../src/models/Lead");
const Mail = require("../src/models/Mail");
const Counter = require("../src/models/counter.model");
const { mapLeadToMailFields } = require("../src/utils/leadMailSync");

const BATCH_SIZE = 500;

const rebuildMailsFromLeads = async () => {
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

  const deletedMailResult = await Mail.updateMany(
    { isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        notes: "Auto-rebuilt from active Leads",
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
        rebuiltMailsDeleted: deletedMailResult.modifiedCount || 0,
        after: {
          leads: afterLeadCount,
          mails: afterMailCount,
        },
        countsMatch: afterLeadCount === afterMailCount,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Mail rebuild from leads failed", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
