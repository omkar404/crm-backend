const Task = require("../models/task.model");

const markSlaBreachedTasks = async () => {
  const now = new Date();

  await Task.updateMany(
    {
      deadline: { $lt: now },
      status: { $nin: ["Invoice Paid", "Invoice Write-Off"] },
      slaBreached: false
    },
    {
      $set: { slaBreached: true }
    }
  );
};

module.exports = { markSlaBreachedTasks };
