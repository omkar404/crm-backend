const mongoose = require("mongoose");

const dscLogSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["Inward", "Outward"]
  },
  note: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    source: {
      type: String,
      enum: ["Direct", "CHA"],
      default: "Direct"
    },

    chaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CHA"
    },

    chaName: String,

    contactPerson: String,

    contactEmail: {
      type: String,
      lowercase: true
    },

    contactMobile: String,

    dgftLogin: String,
    dgftPassword: {
      type: String,
      select: false
    },

    icegateLogin: String,
    icegatePassword: {
      type: String,
      select: false
    },

    dscHolder: String,
    dscExpiry: Date,

    dscLocation: {
      type: String,
      default: "Office Safe"
    },

    dscStatus: {
      type: String,
      enum: ["Inward", "Outward"],
      default: "Outward"
    },

dscLog: {
  type: [dscLogSchema],
  default: []
},

    authSignatoryName: String,

    authSignatoryMobile: String,

    authSignatoryAadhaar: {
      type: String,
      select: false
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);
module.exports = mongoose.model("Client", clientSchema);
