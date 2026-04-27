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
require("./src/config/db");

const leadRoutes = require("./src/routes/leadRoutes");
const mailRoutes = require("./src/routes/mailRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // optional, for form data

// ✅ Mail routes PEHLE register karo - koi auth nahi
app.use('/api/mail', mailRoutes);

// ✅ Lead/auth routes baad mein
app.use("/api/auth", leadRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CRM Backend is running 🚀",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log("CRM Backend is running 🚀");
});

module.exports = app;