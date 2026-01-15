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

    const { name, email, mobileNo } = req.body;

    // 🔴 Only mandatory field
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Name is required.",
      });
    }

    // Duplicate check ONLY if email or mobile exists
    if (email || mobileNo) {
      const duplicate = await Lead.findOne({
        $or: [
          email ? { email } : undefined,
          mobileNo ? { mobileNo } : undefined,
        ].filter(Boolean),
      });

      if (duplicate) {
        return res.status(400).json({
          error: "Lead with same email or mobile number already exists.",
        });
      }
    }

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
    if (!existing) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const { name, email, mobileNo } = req.body;

    // 🔴 Name still mandatory on update
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Name is required.",
      });
    }

    // Duplicate check ONLY if email or mobile exists
    if (email || mobileNo) {
      const duplicate = await Lead.findOne({
        _id: { $ne: id },
        $or: [
          email ? { email } : undefined,
          mobileNo ? { mobileNo } : undefined,
        ].filter(Boolean),
      });

      if (duplicate) {
        return res.status(400).json({
          error:
            "Another lead already exists with same email or mobile number.",
        });
      }
    }

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

    const { v4: uuidv4 } = require("uuid");
    const XLSX = require("xlsx");
    const fs = require("fs");

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      return res.status(400).json({ error: "No sheet found in file" });
    }

    // const rawData = XLSX.utils.sheet_to_json(sheet);
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      defval: "", // IMPORTANT
    });

    if (!rawData.length) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    const emptyToUndefined = (v) =>
      v === "" || v === null || v === undefined ? undefined : v;

    // Normalize
    const normalizeRow = (row) => ({
      name: row.name ? row.name.toString().trim().toUpperCase() : "",

      iecChaNo: row.iecChaNo || "",
      landlineNo: row.landlineNo || "",

      mobileNo: row.mobileNo ? row.mobileNo.toString().replace(/\D/g, "") : "",

      email: row.email ? row.email.toString().trim().toLowerCase() : "",

      website: row.website || "",
      address: row.address || "",
      city: row.city || "",
      state: row.state || "",
      pinCode: row.pinCode || "",

      contactPerson: row.contactPerson || "",
      designation: row.designation || "",

      employees: row.employees ? Number(row.employees) : undefined,

      // ✅ ENUM SAFE FIELDS
      turnover: emptyToUndefined(row.turnover),
      startupCategory: emptyToUndefined(row.startupCategory),
      AEOStatus: emptyToUndefined(row.AEOStatus),

      leadType: emptyToUndefined(row.leadType),
      priorityRating: emptyToUndefined(row.priorityRating),
      leadSource: emptyToUndefined(row.leadSource),
      leadStatus: emptyToUndefined(row.leadStatus),

      RCMCPanel: row.RCMCPanel || "",
      RCMCType: row.RCMCType || "",

      industry: row.industry || "",
      industryBrief: row.industryBrief || "",
      description: row.description || "",
      notes: row.notes || "",
    });

    const data = rawData.map(normalizeRow);

    // Fetch existing DB data
    const existingLeads = await Lead.find(
      { isDeleted: false },
      { email: 1, mobileNo: 1, name: 1 }
    );
    const existingNames = new Set(existingLeads.map((l) => l.name));
    const existingEmails = new Set(existingLeads.map((l) => l.email));
    const existingMobiles = new Set(existingLeads.map((l) => l.mobileNo));

    const uniqueLeads = [];
    const skippedRows = [];

    data.forEach((lead, index) => {
      const reasons = [];

      if (!lead.name) {
        reasons.push("Name is missing");
      }

      if (lead.name && existingNames.has(lead.name)) {
        reasons.push("Name already exists");
      }

      // 2️⃣ Duplicate checks
      if (lead.email && existingEmails.has(lead.email)) {
        reasons.push("Email already exists");
      }

      if (lead.mobileNo && existingMobiles.has(lead.mobileNo)) {
        reasons.push("Mobile already exists");
      }

      // ❌ If any reason exists → skip
      if (reasons.length) {
        skippedRows.push({
          rowNumber: index + 2,
          name: lead.name,
          email: lead.email,
          mobileNo: lead.mobileNo,
          reasons,
        });

        return;
      }

      // ✅ Unique lead
      // currentCount++;

      // uniqueLeads.push({
      //   ...lead,
      //   isDeleted: false,
      //   idNo: "LEAD-" + String(currentCount).padStart(4, "0"),
      //   idDate: new Date(),
      // });

      uniqueLeads.push({
        ...lead,
        isDeleted: false,
        idNo: "LEAD-" + uuidv4(), // ✅ ALWAYS UNIQUE
        idDate: new Date(),
      });

      existingNames.add(lead.name);
      existingEmails.add(lead.email);
      existingMobiles.add(lead.mobileNo);
    });

    if (uniqueLeads.length) {
      await Lead.insertMany(uniqueLeads);
    }

    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      totalRows: rawData.length,
      imported: uniqueLeads.length,
      skipped: skippedRows.length,
      skippedDetails: skippedRows.map((r) => ({
        rowNumber: r.rowNumber,
        name: r.name,
        email: r.email,
        mobileNo: r.mobileNo,
        reasons: r.reasons, // array
      })),
    });
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
