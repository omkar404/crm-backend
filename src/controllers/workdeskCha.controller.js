// import CHA from "../models/cha.model.js";
const CHA = require("../models/cha.model.js");

// ADMIN ONLY
const createCHA = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can add CHA" });
  }

  const { chaname, contactPerson, mobile, email, officeAddress, remarks } = req.body;

  const cha = await CHA.create({
    chaname,
    contactPerson,
    mobile,
    email,
    officeAddress,
    remarks,
    createdBy: req.user.id
  });

  res.status(201).json(cha);
};

// ADMIN + STAFF
const getCHAs = async (_req, res) => {
  const chas = await CHA.find().sort({ createdAt: -1 });
  res.json(chas);
};

module.exports = { createCHA, getCHAs };
