const mongoose = require("mongoose");

const leadSnapshotSchema = new mongoose.Schema(
  {
    idNo: String,
    name: String,
    email: String,
    mobileNo: String,
    website: String,
    industry: String,
    RCMCPanel: String,
    RCMCType: String,
    leadSource: String,
    leadType: String,
    priorityRating: String,
    leadStatus: String,
    emailVerifiedStatus: String,
    cdcrNo: String,
  },
  { _id: false }
);

const campaignAudienceSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    campaignName: { type: String, required: true, trim: true, index: true },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    leadSnapshot: { type: leadSnapshotSchema, default: {} },
    campaignStatus: { type: String, trim: true, default: "Draft", index: true },
    emailSentFrom: { type: String, trim: true, default: "" },
    emailSeen: { type: String, trim: true, default: "No" },
    emailStatus: { type: String, trim: true, default: "Draft" },
    enquiryStatus: { type: String, trim: true, default: "" },
    turnup: { type: String, trim: true, default: "" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true, minimize: false }
);

campaignAudienceSchema.index({ campaignId: 1, leadId: 1 }, { unique: true });
campaignAudienceSchema.index({ campaignId: 1, campaignStatus: 1 });

module.exports =
  mongoose.models.CampaignAudience ||
  mongoose.model("CampaignAudience", campaignAudienceSchema);
