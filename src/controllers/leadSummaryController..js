// controllers/leadSummaryController.js

const Lead = require("../models/Lead");

// MASTER INDUSTRY LIST
const INDUSTRY_MASTER = [
   "Agriculture & Farming",
  "Mining & Quarrying",
  "Manufacturing",
  "Construction",
  "Utilities",
  "IT & Software Services",
  "Financial Services",
  "Trade (Wholesale & Retail)",
  "Transport & Logistics",
  "Tourism & Hospitality",
  "Telecommunications",
  "Healthcare",
  "Education",
  "Media & Entertainment",
  "Professional Services",
  "Public Administration",
];

// MASTER LEAD TYPE LIST
const LEAD_TYPE_MASTER = [
  "CHA",
  "Logistics",
  "Freight Forwarder",
  "Manufacturer",
  "Importer",
  "Exporter"
];

// STATUS LIST
const STATUS_CATEGORIES = [
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
  "Spam / Fake Lead",
  "Do Not Touch"
];

exports.getLeadSummary = async (req, res) => {
  try {
    // GROUP BY INDUSTRY
    const rawIndustry = await Lead.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$industry",
          ...STATUS_CATEGORIES.reduce((acc, s) => {
            acc[s] = { $sum: { $cond: [{ $eq: ["$leadStatus", s] }, 1, 0] } };
            return acc;
          }, {}),
          Total: { $sum: 1 }
        }
      }
    ]);

    // GROUP BY LEAD TYPE
    const rawLeadType = await Lead.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$leadType",
          ...STATUS_CATEGORIES.reduce((acc, s) => {
            acc[s] = { $sum: { $cond: [{ $eq: ["$leadStatus", s] }, 1, 0] } };
            return acc;
          }, {}),
          Total: { $sum: 1 }
        }
      }
    ]);

    // MERGE WITH MASTER INDUSTRY LIST
    const industrySummary = INDUSTRY_MASTER.map((name) => {
      const found = rawIndustry.find((r) => r._id === name);
      return (
        found || {
          _id: name,
          ...Object.fromEntries(STATUS_CATEGORIES.map((s) => [s, 0])),
          Total: 0
        }
      );
    });

    // MERGE WITH MASTER LEAD TYPE LIST
    const leadTypeSummary = LEAD_TYPE_MASTER.map((name) => {
      const found = rawLeadType.find((r) => r._id === name);
      return (
        found || {
          _id: name,
          ...Object.fromEntries(STATUS_CATEGORIES.map((s) => [s, 0])),
          Total: 0
        }
      );
    });

    res.json({
      success: true,
      industrySummary,
      leadTypeSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
