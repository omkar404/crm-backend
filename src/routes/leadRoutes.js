const multer = require("multer");
const Lead = require("../models/Lead");
const express = require("express");
const {
  createLead,
  listLeads,
  updateStatus,
  updateLead,
  deleteLead,
  importLeads,
  downloadSample,
  getDashboardStats,
} = require("../controllers/leadController");
const { login, register } = require("../controllers/authController");
const auth = require("../middleware/auth");
const { getLeadSummary } = require("../controllers/leadSummaryController.");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/import", upload.single("file"), importLeads);
router.get("/sample", downloadSample);


router.get("/dashboard-stats", auth, getDashboardStats);
router.post("/create", auth, createLead);
router.get("/list", auth, listLeads);
router.patch("/status/:id", auth, updateStatus);
router.put("/update/:id", auth, updateLead);
router.delete("/delete/:id", deleteLead);

router.get("/lead-summary", getLeadSummary);

router.post("/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  await Lead.updateMany({ _id: { $in: ids } }, { isDeleted: true });
  res.json({ success: true });
});

router.put("/bulk-update-status", async (req, res) => {
  const { ids, status } = req.body;
  await Lead.updateMany({ _id: { $in: ids } }, { leadStatus: status });
  res.json({ success: true });
});

router.post("/register", register);
router.post("/login", login);

module.exports = router;
