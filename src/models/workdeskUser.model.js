const mongoose = require("mongoose");

const workdeskUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["ADMIN", "STAFF"],
      default: "STAFF"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkdeskUser", workdeskUserSchema);
