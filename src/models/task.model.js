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
    "Application Drafting in Progress"
  ],
  "Application Drafting in Progress": [
    "Draft Sent for Approval"
  ],
  "Draft Sent for Approval": [
    "Draft Approved",
    "Deficiency Raised"
  ],
  "Draft Approved": [
    "Submission"
  ],
  "Submission": [
    "Official Fees Paid",
    "Deficiency Raised"
  ],
  "Official Fees Paid": [
    "In Process"
  ],
  "In Process": [
    "Approved",
    "Deficiency Raised"
  ],
  "Deficiency Raised": [
    "Deficiency Query Reply Awaited from Client"
  ],
  "Deficiency Query Reply Awaited from Client": [
    "Deficiency Replied"
  ],
  "Deficiency Replied": [
    "In Process"
  ],
  "Approved": [
    "Pending for Invoicing"
  ],
  "Pending for Invoicing": [
    "Invoice Raised"
  ],
  "Invoice Raised": [
    "Invoice Paid"
  ]
};

const TASK_STATUSES = [
  "Request Initiated",
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
  "Invoice Paid"
];

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

    // SLA
    slaDays: Number,
    deadline: Date,

    // Email tracking
    emailSender: String,
    emailDate: Date,

    details: String,

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

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
module.exports.STATUS_TRANSITIONS = STATUS_TRANSITIONS;
module.exports.TASK_STATUSES = TASK_STATUSES;
