const express = require("express");

const { getWorkdeskMeta, updateServiceTypes } = require("../controllers/workdeskMeta.controller");
const workdeskAuth = require("../middleware/workdeskAuth");

const router = express.Router();

router.get("/meta", workdeskAuth, getWorkdeskMeta);
router.put("/meta/service-types", workdeskAuth, updateServiceTypes);

module.exports = router;
