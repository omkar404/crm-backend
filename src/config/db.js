// const mongoose = require("mongoose");

// mongoose
//   .connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     w: "majority",
//   })
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.log("DB Error:", err));

// const mongoose = require("mongoose");

// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("MongoDB connected (LOCAL)"))
//   .catch((err) => console.error("DB Error:", err));

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("DB Error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;