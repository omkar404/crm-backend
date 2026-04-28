require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./src/config/db");
const leadRoutes = require("./src/routes/leadRoutes");
const workdeskAuthRoutes = require("./src/routes/workdeskAuth.routes");
const workdeskChaRoutes = require("./src/routes/workdeskCha.routes");
const workdeskClientRoutes = require("./src/routes/workdeskClient.routes");
const workdeskTaskRoutes = require("./src/routes/workdeskTask.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");
const workdeskTaskFilterRoutes = require("./src/routes/workdeskTaskFilter.routes");
const workdeskDashboardRoutes = require("./src/routes/workdeskDashboard.routes");
const { errorHandler } = require("./src/middleware/error");

const app = express();
const allowedOrigins = [
  "https://eximinq.co.in",
  "https://www.eximinq.co.in",
  "http://localhost:5173"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", leadRoutes);
app.use("/workdesk/auth", workdeskAuthRoutes);
app.use("/workdesk", workdeskChaRoutes);
app.use("/workdesk", workdeskClientRoutes);
app.use("/workdesk", workdeskTaskRoutes);
app.use("/workdesk", invoiceRoutes);
app.use("/workdesk", workdeskTaskFilterRoutes);
app.use("/workdesk", workdeskDashboardRoutes);

app.get("/", (req, res) => {
  res.json({ success: true });
});

app.use(errorHandler);

connectDB().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
});
