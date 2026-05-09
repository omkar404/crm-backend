const express = require("express");

const workdeskAuthRoutes = require("../../routes/workdeskAuth.routes");
const workdeskChaRoutes = require("../../routes/workdeskCha.routes");
const workdeskClientRoutes = require("../../routes/workdeskClient.routes");
const workdeskTaskRoutes = require("../../routes/workdeskTask.routes");
const invoiceRoutes = require("../../routes/invoice.routes");
const workdeskTaskFilterRoutes = require("../../routes/workdeskTaskFilter.routes");
const workdeskDashboardRoutes = require("../../routes/workdeskDashboard.routes");
const workdeskMetaRoutes = require("../../routes/workdeskMeta.routes");

const router = express.Router();

router.use("/workdesk/auth", workdeskAuthRoutes);
router.use("/workdesk", workdeskChaRoutes);
router.use("/workdesk", workdeskClientRoutes);
router.use("/workdesk", workdeskTaskRoutes);
router.use("/workdesk", invoiceRoutes);
router.use("/workdesk", workdeskTaskFilterRoutes);
router.use("/workdesk", workdeskDashboardRoutes);
router.use("/workdesk", workdeskMetaRoutes);

module.exports = router;
