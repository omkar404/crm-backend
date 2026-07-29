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
    leadSource: String,
    leadType: String,
    priorityRating: String,
    leadStatus: String,
    emailVerifiedStatus: String,
  },
  { _id: false }
);

const campaignSendSchema = new mongoose.Schema(
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
    sentFrom: { type: String, required: true, trim: true, lowercase: true, index: true },
    sentTo: { type: String, required: true, trim: true, lowercase: true, index: true },
    subject: { type: String, trim: true, default: "" },
    body: { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "sent", "failed"],
      default: "queued",
      index: true,
    },
    emailStatus: { type: String, trim: true, default: "" },
    emailSeen: { type: String, trim: true, default: "No" },
    sentAt: { type: Date, default: null, index: true },
    openedAt: { type: Date, default: null },
    providerMessageId: { type: String, trim: true, default: "" },
    errorMessage: { type: String, trim: true, default: "" },
    previousSendId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampaignSend",
      default: null,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true, minimize: false }
);

campaignSendSchema.index({ leadId: 1, campaignId: 1, createdAt: -1 });
campaignSendSchema.index({ campaignId: 1, sentFrom: 1, status: 1 });

module.exports =
  mongoose.models.CampaignSend || mongoose.model("CampaignSend", campaignSendSchema);
