const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");

const apiRouter = require("./routes");
const { errorHandler } = require("./middleware/error");
const { parseAllowedOrigins } = require("./config/env");

const allowedOrigins = parseAllowedOrigins();
const isProduction = process.env.NODE_ENV === "production";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(compression());
app.use(morgan(isProduction ? "combined" : "dev"));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;

  res.status(isDbReady ? 200 : 503).json({
    success: isDbReady,
    service: "crm-backend",
    database: isDbReady ? "connected" : "disconnected",
  });
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    apps: ["crm-backend"],
    modules: ["crm", "workdesk"],
  });
});

app.use(apiRouter);

app.use(errorHandler);

module.exports = app;
