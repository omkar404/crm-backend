const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    fromStatus: String,
    toStatus: String,
    action: String, 
    performedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performedByName: String,
    note: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema({
  text: String,
  author: String,
  timestamp: Date
});

const STATUS_TRANSITIONS = {
  "Request Initiated": [
    "Quote to be Sent",
    "Strike Off",
  ],
  "Quote to be Sent": [
    "Quote Approval Pending",
    "Strike Off",
  ],
  "Quote Approval Pending": [
    "Quote Approved",
    "Strike Off",
  ],
  "Quote Approved": [
    "Application Drafting in Progress",
    "Strike Off",
  ],
  "Application Drafting in Progress": [
    "Draft Sent for Approval",
    "Strike Off",
  ],
  "Draft Sent for Approval": [
    "Draft Approved",
    "Deficiency Raised",
    "Strike Off",
  ],
  "Draft Approved": [
    "Submission",
    "Strike Off",
  ],
  "Submission": [
    "Official Fees Paid",
    "Deficiency Raised",
    "Strike Off",
  ],
  "Official Fees Paid": [
    "In Process",
    "Strike Off",
  ],
  "In Process": [
    "Approved",
    "Deficiency Raised",
    "Strike Off",
  ],
  "Deficiency Raised": [
    "Deficiency Query Reply Awaited from Client",
    "Strike Off",
  ],
  "Deficiency Query Reply Awaited from Client": [
    "Deficiency Replied",
    "Strike Off",
  ],
  "Deficiency Replied": [
    "In Process",
    "Strike Off",
  ],
  "Approved": [
    "Pending for Invoicing",
    "Strike Off",
  ],
  "Pending for Invoicing": [
    "Invoice Raised",
    "Strike Off",
  ],
  "Invoice Raised": [
    "Invoice Paid",
    "Strike Off",
  ],
  "Invoice Paid": [
    "Strike Off",
  ],
};

const TASK_STATUSES = [
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
  "Strike Off",
];

const WORK_LEVELS = ["High Risk", "Pendency", "Important"];
const JOB_WORK_STATUSES = ["Active", "Completed", "Strike Off"];

const taskSchema = new mongoose.Schema(
  {
    serviceRequestId: { type: String, unique: true },

    // Client linkage
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    clientName: String,
    clientDisplayId: String,

    // Source auto-inherit
    clientSource: { type: String, enum: ["Direct", "CHA"] },
    chaId: { type: mongoose.Schema.Types.ObjectId, ref: "CHA" },
    chaName: String,

    // Service
    serviceType: { type: String, required: true },
    subType: { type: String, required: true },

    // Assignment
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedToName: String,
    assignedToEmail: String,
    workLevel: {
      type: String,
      enum: [...WORK_LEVELS, ""],
      default: "",
    },
    jobWorkStatus: {
      type: String,
      enum: JOB_WORK_STATUSES,
      default: "Active",
    },

    // SLA
    slaDays: Number,
    deadline: Date,

    // Email tracking
    emailSender: String,
    emailDate: Date,

    details: String,
    quotation: {
      type: String,
      enum: ["Via WhatsApp", "Email", "Agreed", ""],
      default: "",
    },
    officialFee: { type: Number, default: null },
    serviceCharges: { type: Number, default: null },

    // Workflow
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "Request Initiated"
    },
    history: [historySchema],
    comments: [commentSchema],

    slaBreached: { type: Boolean, default: false },

    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

taskSchema.index({ assignedToUserId: 1, createdAt: -1 });
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ assignedToUserId: 1, status: 1, createdAt: -1 });
taskSchema.index({ clientId: 1, createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
module.exports.STATUS_TRANSITIONS = STATUS_TRANSITIONS;
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.WORK_LEVELS = WORK_LEVELS;
module.exports.JOB_WORK_STATUSES = JOB_WORK_STATUSES;
