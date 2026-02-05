const express = require("express");
const { createCHA, getCHAs } = require("../controllers/workdeskCha.controller");
const workdeskAuth = require("../middleware/workdeskAuth");

const router = express.Router();

router.post("/chas", workdeskAuth, createCHA);
router.get("/chas", workdeskAuth, getCHAs);

module.exports = router;
