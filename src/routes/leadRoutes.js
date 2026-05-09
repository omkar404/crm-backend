const express = require("express");
const { login, register } = require("../controllers/authController");
const {
  bulkDeleteLeads,
  bulkUpdateStatus,
  createLead,
  deleteLead,
  downloadSample,
  getDashboardStats,
  getLeadById,
  getLeadFilterOptions,
  importLeads,
  listLeads,
  updateLead,
  updateStatus,
} = require("../controllers/leadController");
const { getLeadSummary } = require("../controllers/leadSummaryController.");
const auth = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createRateLimiter } = require("../middleware/rateLimit");
const { attachmentUpload, importUpload } = require("../utils/fileUpload");
const {
  leadBulkDeleteSchema,
  leadBulkStatusSchema,
} = require("../validations/lead.validation");

const router = express.Router();
const authRateLimit = createRateLimiter({
  keyPrefix: "crm-auth",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
});

router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);

router.get("/sample", auth, downloadSample);
router.post("/import", auth, importUpload.single("file"), importLeads);
router.get("/dashboard-stats", auth, getDashboardStats);
router.get("/lead-summary", auth, getLeadSummary);
router.get("/filter-options", auth, getLeadFilterOptions);

router.get("/", auth, listLeads);
router.post("/", auth, attachmentUpload.array("attachments", 10), createLead);
router.post("/create", auth, attachmentUpload.array("attachments", 10), createLead);
router.get("/list", auth, listLeads);
router.post("/bulk-delete", auth, validate(leadBulkDeleteSchema), bulkDeleteLeads);
router.put("/bulk-update-status", auth, validate(leadBulkStatusSchema), bulkUpdateStatus);
router.get("/:id", auth, getLeadById);
router.put("/:id", auth, attachmentUpload.array("attachments", 10), updateLead);
router.put("/update/:id", auth, attachmentUpload.array("attachments", 10), updateLead);
router.patch("/:id/status", auth, updateStatus);
router.patch("/status/:id", auth, updateStatus);
router.delete("/:id", auth, deleteLead);
router.delete("/delete/:id", auth, deleteLead);

module.exports = router;
