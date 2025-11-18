const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    w: "majority",
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("DB Error:", err));
