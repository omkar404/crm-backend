const express = require("express");

const leadRoutes = require("../../routes/leadRoutes");
const mailRoutes = require("../../routes/mailRoutes");

const router = express.Router();

router.use("/api/auth", leadRoutes);
router.use("/api/mail", mailRoutes);

module.exports = router;
