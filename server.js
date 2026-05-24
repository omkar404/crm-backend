require("dotenv").config();
const connectDB = require("./src/config/db");
const app = require("./src/app");
const { validateEnvironment } = require("./src/config/env");
const { backfillLeadDataToMail } = require("./src/utils/leadMailSync");

validateEnvironment();

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
const shouldRunStartupBackfill = process.env.ENABLE_STARTUP_BACKFILL === "true";
let server;

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(() => {
      process.exit(0);
    });
    return;
  }

  process.exit(0);
};

const runStartupBackfill = () => {
  if (!shouldRunStartupBackfill) {
    console.log("Startup lead-mail backfill skipped");
    return;
  }

  setTimeout(() => {
    backfillLeadDataToMail()
      .then(() => {
        console.log("Lead to Mail sync completed");
      })
      .catch((error) => {
        console.error("Lead to Mail sync failed", error);
      });
  }, 0);
};

connectDB()
  .then(() => {
    server = app.listen(port, host, () => {
      console.log(`Server running on ${host}:${port}`);
      runStartupBackfill();
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection", error);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
});

module.exports = app;
