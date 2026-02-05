import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },

    // Task linkage
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    serviceRequestId: String,

    // Client snapshot
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    clientName: String,
    clientDisplayId: String,

    // Service snapshot
    serviceType: String,
    subType: String,

    // Assignment snapshot
    handledByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    handledByName: String,

    // Amounts
    amount: Number,
    gstPercent: Number,
    gstAmount: Number,
    totalAmount: Number,

    // Status
    status: {
      type: String,
      enum: ["Invoice Raised", "Invoice Paid"],
      default: "Invoice Raised"
    },

    issuedDate: Date,
    paidDate: Date,

    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
