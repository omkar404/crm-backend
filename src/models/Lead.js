const mongoose = require("mongoose");
const {
  AEO_STATUS,
  LEAD_PRIORITY,
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_TYPE,
  STARTUP_CATEGORY,
  TURNOVER_OPTIONS,
} = require("../constants/crmOptions");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true },
    fileName: { type: String, trim: true },
    path: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 },
    extension: { type: String, trim: true },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    idNo: { type: String, required: true, unique: true, index: true },
    idDate: { type: Date, default: Date.now, index: true },
    name: { type: String, required: true, trim: true, index: true },
    iecChaNo: { type: String, trim: true, default: "" },
    landlineNo: { type: String, trim: true, default: "" },
    mobileNo: { type: String, trim: true, default: "" },
    normalizedMobileNo: { type: String, trim: true, default: "", sparse: true, index: true },
    email: { type: String, trim: true, default: "" },
    normalizedEmail: { type: String, trim: true, default: "", sparse: true, index: true },
    website: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "", index: true },
    state: { type: String, trim: true, default: "", index: true },
    pinCode: { type: String, trim: true, default: "" },
    contactPerson: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    employees: { type: Number, min: 0, default: null },
    turnover: { type: String, enum: TURNOVER_OPTIONS, default: undefined },
    startupCategory: { type: String, enum: STARTUP_CATEGORY, default: undefined },
    AEOStatus: { type: String, enum: AEO_STATUS, default: undefined },
    RCMCPanel: { type: String, trim: true, default: "", index: true },
    RCMCType: { type: String, trim: true, default: "" },
    industry: { type: String, trim: true, default: "", index: true },
    industryBrief: { type: String, trim: true, default: "" },
    leadType: { type: String, enum: LEAD_TYPE, default: undefined, index: true },
    priorityRating: { type: String, enum: LEAD_PRIORITY, default: undefined, index: true },
    // Imported association/member lists can carry source values outside the core CRM presets.
    // Keep this field flexible and let filter options merge DB values with master values.
    leadSource: { type: String, trim: true, default: "", index: true },
    leadStatus: {
      type: String,
      enum: LEAD_STATUS,
      default: "Not Contacted",
      index: true,
    },
    senderEmail: { type: String, trim: true, default: "" },
    emailVerifiedStatus: { type: String, trim: true, default: "" },
    wifi: { type: String, trim: true, default: "" },
    browser: { type: String, trim: true, default: "" },
    emailSentOn: { type: Date, default: null },
    emailTemplate: { type: String, trim: true, default: "" },
    emailSubjectCode: { type: String, trim: true, default: "" },
    emailSeen: { type: String, trim: true, default: "" },
    emailStatus: { type: String, trim: true, default: "" },
    enquiryStatus: { type: String, trim: true, default: "" },
    turnup: { type: String, trim: true, default: "" },
    cdcrNo: { type: String, trim: true, default: "" },
    cdcrCreation: { type: Date, default: null },
    description: { type: String, default: "" },
    notes: { type: String, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    sourceMailId: { type: String, trim: true, default: "", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);

leadSchema.index({ isDeleted: 1, createdAt: -1 });
leadSchema.index({ isDeleted: 1, leadStatus: 1, createdAt: -1 });
leadSchema.index({ isDeleted: 1, leadType: 1, leadSource: 1 });
leadSchema.index({
  name: "text",
  email: "text",
  mobileNo: "text",
  city: "text",
  state: "text",
  industry: "text",
  notes: "text",
});

module.exports = mongoose.models.Lead || mongoose.model("Lead", leadSchema);
