const mongoose = require("mongoose");
const { MAIL_STATUS } = require("../constants/crmOptions");

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

const mailSchema = new mongoose.Schema(
  {
    mailId: { type: String, unique: true, index: true },
    name: { type: String, trim: true, default: "", index: true },
    from: { type: String, trim: true, default: "", index: true },
    templateName: { type: String, trim: true, default: "", index: true },
    subject: { type: String, trim: true, default: "", index: true },
    sourceDate: { type: Date, default: null, index: true },
    ipAddress: { type: String, trim: true, default: "", index: true },
    webSource: { type: String, trim: true, default: "", index: true },
    email: { type: String, trim: true, default: "", index: true },
    verifyEmail: { type: String, trim: true, default: "", index: true },
    emailVerified: { type: Boolean, default: false, index: true },
    city: { type: String, trim: true, default: "", index: true },
    emailSent: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: MAIL_STATUS,
      default: "draft",
      index: true,
    },
    state: { type: String, trim: true, default: "", index: true },
    pinCode: { type: String, trim: true, default: "" },
    contactPerson: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    employees: { type: Number, min: 0, default: null },
    turnover: { type: String, trim: true, default: "" },
    startupCategory: { type: String, trim: true, default: "" },
    AEOStatus: { type: String, trim: true, default: "" },
    RCMCPanel: { type: String, trim: true, default: "", index: true },
    RCMCType: { type: String, trim: true, default: "" },
    industry: { type: String, trim: true, default: "", index: true },
    industryBrief: { type: String, trim: true, default: "" },
    leadType: { type: String, trim: true, default: "", index: true },
    priorityRating: { type: String, trim: true, default: "", index: true },
    leadSource: { type: String, trim: true, default: "", index: true },
    leadStatus: { type: String, trim: true, default: "", index: true },
    description: { type: String, default: "" },
    notes: { type: String, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    sentAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, trim: true, default: "", sparse: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastOpenedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

mailSchema.index({ isDeleted: 1, createdAt: -1 });
mailSchema.index({ isDeleted: 1, status: 1, sourceDate: -1 });
mailSchema.index({ isDeleted: 1, templateName: 1, sourceDate: -1 });
mailSchema.index({
  name: "text",
  from: "text",
  email: "text",
  subject: "text",
  city: "text",
  state: "text",
  industry: "text",
  notes: "text",
});

module.exports = mongoose.models.Mail || mongoose.model("Mail", mailSchema);
