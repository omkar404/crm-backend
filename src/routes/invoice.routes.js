const express = require("express");
const {
  raiseInvoice,
  markInvoicePaid,
  updateInvoice,
  getInvoices,
} = require("../controllers/invoice.controller");
const workdeskAuth = require("../middleware/workdeskAuth");

const router = express.Router();

router.post("/invoices", workdeskAuth, raiseInvoice);
router.put("/invoices/:id", workdeskAuth, updateInvoice);
router.put("/invoices/:id/pay", workdeskAuth, markInvoicePaid);
router.get("/invoices", workdeskAuth, getInvoices);

module.exports = router;
