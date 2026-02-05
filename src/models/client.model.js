import mongoose from "mongoose";

const dscLogSchema = new mongoose.Schema({
  status: String,
  note: String,
  user: String,
  date: Date
});

const clientSchema = new mongoose.Schema(
  {
    clientId: { type: String, unique: true },
    name: { type: String, required: true },

    source: { type: String, enum: ["Direct", "CHA"], default: "Direct" },
    chaId: { type: mongoose.Schema.Types.ObjectId, ref: "CHA" },
    chaName: String,

    contactPerson: String,
    contactEmail: String,
    contactMobile: String,

    dgftLogin: String,
    dgftPassword: String,
    icegateLogin: String,
    icegatePassword: String,
    
    dscHolder: String,
    dscExpiry: Date,
    dscLocation: { type: String, default: "Office Safe" },
    dscStatus: { type: String, default: "Outward" },
    dscLog: [dscLogSchema],

    authSignatoryName: String,
    authSignatoryMobile: String,
    authSignatoryAadhaar: String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);
