const express = require("express");
const {getWorkdeskDashboardAnalytics} = require("../controllers/workdeskDashboard.controller");
const workdeskAuth = require("../middleware/workdeskAuth");


const router = express.Router();

router.get("/dashboard/analytics", workdeskAuth, getWorkdeskDashboardAnalytics);

module.exports = router;
