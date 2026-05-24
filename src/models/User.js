const mongoose = require("mongoose");

const Userschema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: String,
    password: String,
    role: {
      type: String,
      enum: ["ADMIN", "USER"],
      default: "USER",
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("User", Userschema);
