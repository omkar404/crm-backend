const express = require("express");

const leadRoutes = require("../../routes/leadRoutes");
const mailRoutes = require("../../routes/mailRoutes");
const campaignRoutes = require("../../routes/campaignRoutes");

const router = express.Router();

router.use("/api/auth", leadRoutes);
router.use("/api/mail", mailRoutes);
router.use("/api/campaigns", campaignRoutes);

module.exports = router;
