// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");

// const {
//   getAllMails,
//   getMailById,
//   createMail,
//   updateMail,
//   deleteMail,
//   sendMail,
// } = require("../controllers/mailController");

// const {
//   getMailSummary,
//   getDailySummary,
//   getTagSummary,
//   getFilterOptions,
// } = require("../controllers/mailSummaryController");

// const {
//   importFromExcel,
//   importFromUpload,
// } = require("../controllers/mailImportController");

// // Multer setup for file upload
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, "../../uploads"));
//   },
//   filename: (req, file, cb) => {
//     cb(null, "EEPC_MAHARASTRA.xlsx");
//   },
// });
// const upload = multer({
//   storage,
//   fileFilter: (req, file, cb) => {
//     if (
//       file.mimetype ===
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
//       file.mimetype === "application/vnd.ms-excel"
//     ) {
//       cb(null, true);
//     } else {
//       cb(new Error("Only .xlsx files are allowed"));
//     }
//   },
// });

// // ── Import Routes (FIRST - before any /:id) ────────────────────────────────
// router.post("/import-excel", importFromExcel);
// router.post("/import-excel/upload", upload.single("file"), importFromUpload);

// // ── Summary Routes ─────────────────────────────────────────────────────────
// router.get("/summary/daily", getDailySummary);
// router.get("/summary/tags", getTagSummary);
// router.get("/summary", getMailSummary);

// // ── Mail CRUD Routes (/:id LAST) ───────────────────────────────────────────
// router.get("/", getAllMails);
// router.post("/", createMail);
// router.patch("/:id/send", sendMail);
// router.get("/:id", getMailById);
// router.put("/:id", updateMail);
// router.delete("/:id", deleteMail);

// // ── Filter Options Route (inline to avoid import issues) ──
// router.get("/filter-options", async (req, res) => {
//   try {
//     const Mail = require("../models/Mail");
    
//     const [
//       sendEmailId,
//       templateType,
//       templateSubject,
//       emailDate,
//       ipAddress,
//       webTabAndType,
//       emailVerified,
//       emailSentType,
//       status,
//     ] = await Promise.all([
//       Mail.distinct("Email Id"),
//       Mail.distinct("Template"),
//       Mail.distinct("Subject"),
//       Mail.distinct("Date"),
//       Mail.distinct("IP Address"),
//       Mail.distinct("Web"),
//       Mail.distinct("email verified"),
//       Mail.distinct("Email sent"),
//       Mail.distinct("Status"),
//     ]);

//     // If emailDate is empty, use createdAt dates
//     let emailDates = emailDate.filter(d => d);
//     if (!emailDates.length) {
//       const dateDocs = await Mail.aggregate([
//         { $match: { createdAt: { $exists: true } } },
//         { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
//         { $sort: { _id: -1 } }
//       ]);
//       emailDates = dateDocs.map(d => d._id);
//     }

//     res.json({
//       sendEmailId: sendEmailId.filter(v => v),
//       templateType: templateType.filter(v => v),
//       templateSubject: templateSubject.filter(v => v),
//       emailDate: emailDates,
//       ipAddress: ipAddress.filter(v => v),
//       webTabAndType: webTabAndType.filter(v => v),
//       emailVerified: emailVerified.filter(v => v),
//       emailSentType: emailSentType.filter(v => v),
//       status: status.filter(v => v),
//     });
//   } catch (err) {
//     console.error("Filter options error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Mail = require("../models/Mail"); 
const {
  getAllMails,
  getMailById,
  createMail,
  updateMail,
  deleteMail,
  sendMail,
} = require("../controllers/mailController");



const {
  importFromExcel,
  importFromUpload,
} = require("../controllers/mailImportController");

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, "EEPC_MAHARASTRA.xlsx");
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are allowed"));
    }
  },
});

// ── Filter Options Route (MUST come before dynamic routes) ──
router.get("/filter-options", async (req, res) => {
  try {
    const excelDateToJSDate = (serial) => {
      const utcDays = serial - 25569;
      const date = new Date(utcDays * 86400000);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const [
      sendEmailIdRaw,
      templateTypeRaw,
      templateSubjectRaw,
      emailDateRaw,
      ipAddressRaw,
      webTabAndTypeRaw,
      emailVerifiedRaw,
      emailSentTypeRaw,
      statusRaw,
    ] = await Promise.all([
      Mail.distinct("Email Id"),
      Mail.distinct("Template"),
      Mail.distinct("Subject"),
      Mail.distinct("Date"),
      Mail.distinct("IP Address"),
      Mail.distinct("Web"),
      Mail.distinct("email verified"),
      Mail.distinct("Email sent"),
      Mail.distinct("Status"),
    ]);

    const sendEmailId = sendEmailIdRaw.filter(v => v && typeof v === "string");

    const templateType = templateTypeRaw.filter(v => v);

    const templateSubject = templateSubjectRaw
      .map(v => String(v))
      .filter(v => v);

    // DATE
    let emailDates = emailDateRaw
      .filter(v => typeof v === "number")
      .map(v => excelDateToJSDate(v))
      .filter((v, i, a) => a.indexOf(v) === i);

    const ipAddress = ipAddressRaw.filter(v => v);

    const webTabAndType = webTabAndTypeRaw.filter(v => v);

    // ✅ EMAIL VERIFIED FIX
    let emailVerified = emailVerifiedRaw
      .map(v => {
        if (!v) return null;
        const val = String(v).toLowerCase();

        if (val === "yes") return "Yes";
        if (val === "no") return "No";
        if (val === "ok") return "ok";

        return null;
      })
      .filter(v => v)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (!emailVerified.length) {
      emailVerified = ["Yes", "No", "ok"];
    }

    // ✅ EMAIL SENT FIX
    let emailSentType = emailSentTypeRaw
      .map(v => {
        if (!v) return null;
        const val = String(v).toLowerCase();
        if (val === "yes") return "Yes";
        if (val === "no") return "No";
        return null;
      })
      .filter(v => v)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (!emailSentType.length) {
      emailSentType = ["Yes", "No"];
    }

    // ✅ STATUS FIX
    let status = statusRaw
      .map(v => {
        if (!v) return null;
        const val = String(v).toLowerCase();

        if (val === "not contacted") return "Not Contacted";
        if (val === "contacted") return "Contacted";

        if (val === "draft") return "draft";
        if (val === "sent") return "sent";
        if (val === "enquiry") return "enquiry";
        if (val === "reached") return "reached";
        if (val === "bounced") return "bounced";
        if (val === "stop") return "stop";

        return null;
      })
      .filter(v => v)
      .filter((v, i, a) => a.indexOf(v) === i);

    const requiredStatuses = [
      "Not Contacted",
      "Contacted",
      "draft",
      "sent",
      "enquiry",
      "reached",
      "bounced",
      "stop",
    ];

    requiredStatuses.forEach(s => {
      if (!status.includes(s)) status.push(s);
    });

    res.json({
      sendEmailId,
      templateType,
      templateSubject,
      emailDate: emailDates,
      ipAddress,
      webTabAndType,
      emailVerified,
      emailSentType,
      status,
    });

  } catch (err) {
    console.error("Filter options error:", err);
    res.status(500).json({ error: err.message });
  }
});

const { getMailSummary, getDailySummary, getTagSummary } = require('../controllers/mailSummaryController');

// ── Import Routes ───────────────────────────────────────────
router.post("/import-excel", importFromExcel);
router.post("/import-excel/upload", upload.single("file"), importFromUpload);

// ── Summary Routes ──────────────────────────────────────────
router.get('/summary', getMailSummary);
router.get('/summary/daily', getDailySummary);
router.get('/summary/tags', getTagSummary);


// ── Mail CRUD Routes (/:id LAST) ────────────────────────────
router.get("/", getAllMails);
router.post("/", createMail);
router.patch("/:id/send", sendMail);
router.get("/:id", getMailById);
router.put("/:id", updateMail);
router.delete("/:id", deleteMail);

// Add this endpoint (POST /api/mail/bulk-status)
router.post('/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;  // now req.body will be defined
    if (!ids || !status) {
      return res.status(400).json({ success: false, message: "ids and status are required" });
    }
    const result = await Mail.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );
    res.json({ success: true, message: `${result.modifiedCount} mail(s) updated` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;