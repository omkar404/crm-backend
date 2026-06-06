require("dotenv").config();

const connectDB = require("../src/config/db");
const mongoose = require("mongoose");
const { backfillLeadDataToMail } = require("../src/utils/leadMailSync");

const run = async () => {
  await connectDB();
  await backfillLeadDataToMail();
  console.log("Lead/Mail backfill completed");
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Lead/Mail backfill failed", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
