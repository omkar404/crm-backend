const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const Lead = require("../models/Lead");

// --------------------------------------------------------------------------
// REQUIRED FIELDS (backend enforced)
// --------------------------------------------------------------------------
const ALL_FIELDS = [
  "name",
  "iecChaNo",
  "landlineNo",
  "mobileNo",
  "email",
  "website",
  "address",
  "city",
  "state",
  "pinCode",
  "contactPerson",
  "designation",
  "employees",
  "turnover",
  "startupCategory",
  "AEOStatus",
  "RCMCPanel",
  "RCMCType",
  "industry",
  "industryBrief",
  "leadType",
  "priorityRating",
  "leadSource",
  "leadStatus",
  "description",
  "notes",
];

const REQUIRED_FIELDS = ["name", "mobileNo", "email"];

// --------------------------------------------------------------------------
// Helper: Validate required fields

function cleanEnums(obj) {
  for (let key in obj) {
    if (obj[key] === "") {
      obj[key] = undefined;
    }
  }
  return obj;
}

// --------------------------------------------------------------------------
function validateRequired(body) {
  for (let f of REQUIRED_FIELDS) {
    if (!body[f] || body[f].toString().trim() === "") {
      return `Fieldss '${f}' is required YESS.`;
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// Helper: Generate sequential ID
// --------------------------------------------------------------------------
async function generateId() {
  const last = await Lead.findOne().sort({ createdAt: -1 });
  const number = last ? Number(last.idNo.split("-")[1]) + 1 : 1;
  return "LEAD-" + String(number).padStart(4, "0");
}

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Basic Counts
    const today = await Lead.countDocuments({
      createdAt: { $gte: startOfDay },
      isDeleted: false,
    });

    const week = await Lead.countDocuments({
      createdAt: { $gte: startOfWeek },
      isDeleted: false,
    });

    const month = await Lead.countDocuments({
      createdAt: { $gte: startOfMonth },
      isDeleted: false,
    });

    const year = await Lead.countDocuments({
      createdAt: { $gte: startOfYear },
      isDeleted: false,
    });

    const total = await Lead.countDocuments({ isDeleted: false });

    // Count by leadStatus
    const byStatus = await Lead.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$leadStatus", count: { $sum: 1 } } },
    ]);

    // Daily trend for chart (last 30 days)
    const last30days = await Lead.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      today,
      week,
      month,
      year,
      total,
      byStatus,
      last30days,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// CREATE LEAD
// --------------------------------------------------------------------------
exports.createLead = async (req, res) => {
  try {
    req.body = cleanEnums(req.body);

    const missing = validateRequired(req.body);
    if (missing) return res.status(400).json({ error: missing });

    const { email, mobileNo, name } = req.body;

    const duplicate = await Lead.findOne({
      $or: [{ email }, { mobileNo }, { name }],
    });

    if (duplicate)
      return res
        .status(400)
        .json({ error: "Lead with same name/email/mobile exists." });

    const idNo = await generateId();

    const lead = await Lead.create({
      idNo,
      idDate: new Date(),
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully!",
      lead,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// UPDATE LEAD
// --------------------------------------------------------------------------
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;

    req.body = cleanEnums(req.body);

    const existing = await Lead.findById(id);
    if (!existing) return res.status(404).json({ error: "Lead not found." });

    const missing = validateRequired(req.body);
    if (missing) return res.status(400).json({ error: missing });

    const { email, mobileNo, name } = req.body;

    const duplicate = await Lead.findOne({
      _id: { $ne: id },
      $or: [{ email }, { mobileNo }, { name }],
    });

    if (duplicate)
      return res
        .status(400)
        .json({ error: "Another lead exists with same name/email/mobile." });

    const updated = await Lead.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: "Lead updated successfully!",
      lead: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// DELETE LEAD (soft delete)
// --------------------------------------------------------------------------
exports.deleteLead = async (req, res) => {
  try {
    const deleted = await Lead.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) return res.status(404).json({ error: "Lead not found" });

    res.json({ message: "Lead deleted successfully", lead: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// LIST LEADS WITH PAGINATION + SEARCH
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// LIST LEADS (pagination + search + full filtering)
// --------------------------------------------------------------------------
exports.listLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      leadStatus,
      industry,
      leadType,
      leadSource,
      AEOStatus,
      RCMCPanel,
    } = req.query;

    const skip = (page - 1) * limit;

    // Construct dynamic filter
    const filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobileNo: { $regex: search, $options: "i" } },
        { idNo: { $regex: search, $options: "i" } },
      ];
    }

    // Extra filters
    if (leadStatus) filter.leadStatus = leadStatus;
    if (industry) filter.industry = industry;
    if (leadType) filter.leadType = leadType;
    if (leadSource) filter.leadSource = leadSource;
    if (AEOStatus) filter.AEOStatus = AEOStatus;
    if (RCMCPanel) filter.RCMCPanel = RCMCPanel;

    // Fetch data
    const total = await Lead.countDocuments(filter);
    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      leads,
    });
  } catch (err) {
    console.error("LIST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// UPDATE STATUS
// --------------------------------------------------------------------------
exports.updateStatus = async (req, res) => {
  try {
    const updated = await Lead.findByIdAndUpdate(
      req.params.id,
      { leadStatus: req.body.leadStatus },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --------------------------------------------------------------------------
// DOWNLOAD SAMPLE FILE
// --------------------------------------------------------------------------
const sampleFilePath = path.join(__dirname, "../static/sample-leads.xlsx");

function generateSample() {
  if (!fs.existsSync(sampleFilePath)) {
    const ws = XLSX.utils.aoa_to_sheet([ALL_FIELDS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    fs.mkdirSync(path.dirname(sampleFilePath), { recursive: true });
    XLSX.writeFile(wb, sampleFilePath);
  }
}
generateSample();

exports.downloadSample = (req, res) => {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=sample-leads.xlsx"
  );

  res.download(sampleFilePath);
};

// --------------------------------------------------------------------------
// IMPORT LEADS (FINAL, FULLY FIXED VERSION)
// --------------------------------------------------------------------------
exports.importLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(req.file.path);

    // ✅ DO NOT HARDCODE SHEET NAME
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return res
        .status(400)
        .json({ error: "Invalid file format. No sheet found." });
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet);

    if (!jsonData.length) {
      return res.status(400).json({ error: "Uploaded file is empty" });
    }

    // Fetch existing emails and mobiles
    const existingLeads = await Lead.find({}, { email: 1, mobileNo: 1 });
    const existingEmails = new Set(existingLeads.map((l) => l.email));
    const existingMobiles = new Set(existingLeads.map((l) => l.mobileNo));

    // Sequential ID
    let currentCount = await Lead.countDocuments();

    let duplicates = 0;
    const uniqueLeads = [];

    jsonData.forEach((lead) => {
      if (
        existingEmails.has(lead.email) ||
        existingMobiles.has(lead.mobileNo)
      ) {
        duplicates++;
      } else {
        currentCount++;

        uniqueLeads.push({
          ...lead,
          idNo: "LEAD-" + String(currentCount).padStart(4, "0"),
          idDate: new Date(),
        });
      }
    });

    if (uniqueLeads.length) {
      await Lead.insertMany(uniqueLeads);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      imported: uniqueLeads.length,
      skipped_duplicates: duplicates,
    });
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
