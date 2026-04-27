const mongoose = require("mongoose");

const mailSchema = new mongoose.Schema(
  {
    from:        { type: String, default: "" },
    to:          { type: [String], default: [] },
    cc:          { type: [String], default: [] },
    bcc:         { type: [String], default: [] },
    subject:     { type: String, default: "" },
    body:        { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "draft", "failed", "scheduled"],
      default: "draft",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    tags:        { type: [String], default: [] },
    attachments: [{ filename: String, path: String, mimetype: String, size: Number }],
    isRead:      { type: Boolean, default: false },
    sentAt:      { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    strict: false, // allow all Excel fields
  }
);

// ✅ Indexes for fast search & filter
mailSchema.index({ status: 1 });
mailSchema.index({ createdAt: -1 });
mailSchema.index({ city: 1 });
mailSchema.index({ state: 1 });
mailSchema.index({ name: 1 });
mailSchema.index({ "Email Id": 1 });

module.exports = mongoose.model("Mail", mailSchema);