const mongoose = require("mongoose");

const chaSchema = new mongoose.Schema(
  {
    chaname: { type: String, required: true },
    cdcrBase: { type: String, default: "" },
    contactPerson: { type: String },
    mobile: { type: String },
    email: { type: String },
    officeAddress: { type: String },
    remarks: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CHA", chaSchema);
