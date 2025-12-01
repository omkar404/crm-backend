const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    idNo: { type: String, required: true, unique: true },
    idDate: { type: Date, default: Date.now },

    name: String,
    iecChaNo: String,
    landlineNo: String,
    mobileNo: String,
    email: String,
    website: String,
    address: String,
    city: String,
    state: String,
    pinCode: String,
    contactPerson: String,
    designation: String,

    employees: Number,
    turnover: {
      type: String,
      enum: [
        "NA",
        "Less than 10 Cr",
        "10 Cr - 50 Cr",
        "50 Cr - 100 Cr",
        "100 Cr - 500 Cr",
        "Above 500 Cr",
      ],
    },

    startupCategory: { type: String, enum: ["Yes", "No"] },

    AEOStatus: {
      type: String,
      enum: ["NA", "AEO - T1", "AEO - T2", "AEO - T3", "AEO - LEO"],
    },

    RCMCPanel: String,
    RCMCType: String,

    industry: String,
    industryBrief: String,

    leadType: {
      type: String,
      enum: [
        "CHA",
        "Logistics",
        "Freight Forwarder",
        "Manufacturer",
        "Importer",
        "Exporter",
      ],
    },

    priorityRating: {
      type: String,
      enum: ["Low", "Medium", "High", "Premium"],
    },

    leadSource: {
      type: String,
      enum: [
        "RCMC Panel",
        "CHA Panel",
        "MCA Panel",
        "Website",
        "In Person",
        "In Reference",
        "Print Media",
        "FSSAI Panel",
        "EPR Panel",
        "Web Media",
        "AEO Panel",
        "Others",
      ],
    },

    leadStatus: {
      type: String,
      enum: [
        "Not Contacted",
        "Email Sent",
        "Contact on phone",
        "In Contact",
        "Interested",
        "In Process",
        "Login Created",
        "Login Rejected",
        "Not Interested",
        "Not Contactable",
        "Do Not Touch",
        "Spam / Fake Lead",
      ],
      default: "Not Contacted",
    },

    description: String,
    notes: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
