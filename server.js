require("dotenv").config();
const connectDB = require("./src/config/db");
const app = require("./src/app");
const { validateEnvironment } = require("./src/config/env");

validateEnvironment();

const port = process.env.PORT || 5000;
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

connectDB()
  .then(() => {
    server = app.listen(port, () => {
      console.log(`Server running on ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
