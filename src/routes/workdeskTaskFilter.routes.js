const express = require("express");
const { filterWorkdeskFilterTasks } = require("../controllers/workdeskTaskFilter.controller");
const protect = require( "../middleware/workdeskAuth"); 

const router = express.Router();

router.post("/tasks/filter", protect, filterWorkdeskFilterTasks);

module.exports = router;
