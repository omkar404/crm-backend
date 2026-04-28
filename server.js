// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// require("./src/config/db");


// // Sheshnath
// const leadRoutes = require("./src/routes/leadRoutes");
// const mailRoutes = require("./src/routes/mailRoutes");
// const app = express();
// app.use(cors());
// app.use(express.json());

// app.use("/api/auth", leadRoutes);
// app.use('/api/mail', mailRoutes);

// app.get("/", (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: "CRM Backend is running 🚀",
//   });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
//   console.log("CRM Backend is running 🚀");
// });

// app.get("/debug-uploads", (req, res) => {
//   const fs = require("fs");
//   const path = require("path");
//   const dir = path.join(__dirname, "uploads");
//   const files = fs.readdirSync(dir);
//   res.json({ dir, files });
// });

// module.exports = app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./src/config/db");
const leadRoutes = require("./src/routes/leadRoutes");
<<<<<<< HEAD
const workdeskAuthRoutes = require("./src/routes/workdeskAuth.routes");
const workdeskChaRoutes = require("./src/routes/workdeskCha.routes");
const workdeskClientRoutes = require("./src/routes/workdeskClient.routes");
const workdeskTaskRoutes = require("./src/routes/workdeskTask.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");
const workdeskTaskFilterRoutes = require("./src/routes/workdeskTaskFilter.routes");
const workdeskDashboardRoutes = require("./src/routes/workdeskDashboard.routes");
const { errorHandler } = require("./src/middleware/error");
=======
const mailRoutes = require("./src/routes/mailRoutes");
>>>>>>> 4fca68705111ae1952d9b604ea5216633d0f6a68

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
<<<<<<< HEAD
app.use(cookieParser());
=======
app.use(express.urlencoded({ extended: true })); // optional, for form data
>>>>>>> 4fca68705111ae1952d9b604ea5216633d0f6a68

// ✅ Mail routes PEHLE register karo - koi auth nahi
app.use('/api/mail', mailRoutes);

// ✅ Lead/auth routes baad mein
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

<<<<<<< HEAD
app.use(errorHandler);

connectDB().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
=======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log("CRM Backend is running 🚀");
>>>>>>> 4fca68705111ae1952d9b604ea5216633d0f6a68
});

module.exports = app;