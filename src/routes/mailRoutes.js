const express = require("express");
const {
  bulkDeleteMails,
  bulkUpdateMailStatus,
  createMail,
  deleteMail,
  downloadMailSample,
  getAllMails,
  getFilterOptions,
  getMailById,
  importMails,
  sendMail,
  updateMail,
  updateMailStatus,
} = require("../controllers/mailController");
const { getDailySummary, getMailSummary, getTagSummary } = require("../controllers/mailSummaryController");
const auth = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { attachmentUpload, importUpload } = require("../utils/fileUpload");
const {
  bulkDeleteSchema,
  bulkStatusSchema,
} = require("../validations/mail.validation");

const router = express.Router();

router.get("/filter-options", auth, getFilterOptions);
router.get("/summary", auth, getMailSummary);
router.get("/summary/daily", auth, getDailySummary);
router.get("/summary/tags", auth, getTagSummary);
router.get("/sample", auth, downloadMailSample);

router.post("/import", auth, importUpload.single("file"), importMails);
router.post("/import-excel", auth, importUpload.single("file"), importMails);
router.post("/import-excel/upload", auth, importUpload.single("file"), importMails);

router.get("/", auth, getAllMails);
router.post("/", auth, attachmentUpload.array("attachments", 10), createMail);
router.post("/bulk-status", auth, validate(bulkStatusSchema), bulkUpdateMailStatus);
router.post("/bulk-delete", auth, validate(bulkDeleteSchema), bulkDeleteMails);
router.get("/:id", auth, getMailById);
router.put("/:id", auth, attachmentUpload.array("attachments", 10), updateMail);
router.patch("/:id/status", auth, validate(bulkStatusSchema.pick({ status: true })), updateMailStatus);
router.patch("/:id/send", auth, sendMail);
router.delete("/:id", auth, deleteMail);

module.exports = router;
