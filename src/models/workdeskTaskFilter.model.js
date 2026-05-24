const mongoose = require("mongoose");

const workdeskTaskSchema = new mongoose.Schema(
  {
    serviceRequestId: { type: String, required: true, index: true },

    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    clientName: String,
    clientDisplayId: String,

    clientSource: {
      type: String,
      enum: ["Direct", "CHA"],
      default: "Direct"
    },

    chaId: { type: mongoose.Schema.Types.ObjectId, ref: "CHA" },
    chaName: String,

    serviceType: String,
    subType: String,

    emailSender: String,
    emailDate: Date,

    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },

    assignedToName: String,
    jobWorkStatus: {
      type: String,
      enum: ["Active", "Completed", "Strike Off"],
      default: "Active"
    },

    status: {
      type: String,
      enum: [
        "Request Initiated",
        "Quote to be Sent",
        "Quote Approval Pending",
        "Quote Approved",
        "Application Drafting in Progress",
        "Draft Sent for Approval",
        "Draft Approved",
        "Submission",
        "Official Fees Paid",
        "In Process",
        "Deficiency Raised",
        "Deficiency Query Reply Awaited from Client",
        "Deficiency Replied",
        "Approved",
        "Pending for Invoicing",
        "Invoice Raised",
        "Invoice Paid",
        "Strike Off"
      ],
      default: "Request Initiated"
    },

    deadline: Date,
    slaBreached: { type: Boolean, default: false },

    createdBy: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkdeskTaskFilter", workdeskTaskSchema);
