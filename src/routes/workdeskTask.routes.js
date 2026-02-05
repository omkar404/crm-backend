const express = require("express");
const {
  createTask,
  getTasks,
  updateTaskStatus,
  addComment
} = require("../controllers/workdeskTask.controller");
const workdeskAuth = require( "../middleware/workdeskAuth");

const router = express.Router();

router.post("/tasks", workdeskAuth, createTask);
router.get("/tasks", workdeskAuth, getTasks);
router.put("/tasks/:id/status", workdeskAuth, updateTaskStatus);
router.post("/tasks/:id/comments", workdeskAuth, addComment);

module.exports = router;
