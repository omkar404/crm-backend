require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./src/config/db");

const leadRoutes = require("./src/routes/leadRoutes");

const app = express();
app.use(cors());
app.use(express.json());

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
});
