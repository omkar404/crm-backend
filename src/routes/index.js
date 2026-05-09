const express = require("express");

const { crmRouter } = require("../modules/crm");
const { workdeskRouter } = require("../modules/workdesk");

const router = express.Router();

router.use(crmRouter);
router.use(workdeskRouter);

module.exports = router;
