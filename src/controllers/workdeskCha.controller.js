import CHA from "../models/cha.model.js";

// ADMIN ONLY
export const createCHA = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can add CHA" });
  }

  const { name, contactPerson, mobile, email } = req.body;

  const cha = await CHA.create({
    name,
    contactPerson,
    mobile,
    email,
    createdBy: req.user.id
  });

  res.status(201).json(cha);
};

// ADMIN + STAFF
export const getCHAs = async (_req, res) => {
  const chas = await CHA.find().sort({ createdAt: -1 });
  res.json(chas);
};
