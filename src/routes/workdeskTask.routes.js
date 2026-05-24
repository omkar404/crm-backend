const express = require("express");
const {
  createTask,
  getTasks,
  getTaskById,
  updateTaskStatus,
  updateTaskJobWork,
  addComment
} = require("../controllers/workdeskTask.controller");
const workdeskAuth = require( "../middleware/workdeskAuth");

const router = express.Router();

router.post("/tasks", workdeskAuth, createTask);
router.get("/tasks", workdeskAuth, getTasks);
router.get("/tasks/:id", workdeskAuth, getTaskById);
router.put("/tasks/:id/status", workdeskAuth, updateTaskStatus);
router.put("/tasks/:id/job-work", workdeskAuth, updateTaskJobWork);
router.post("/tasks/:id/comments", workdeskAuth, addComment);

module.exports = router;
