// import CHA from "../models/cha.model.js";
const CHA = require("../models/cha.model.js");
const Counter = require("../models/counter.model.js");
const Client = require("../models/client.model.js");

const parseCdcrParts = (clientId = "") => {
  const match = String(clientId).trim().match(/^CDCR-(\d+)(?:-(\d+))?$/i);
  if (!match) return null;

  return {
    series: Number(match[1]),
    suffix: match[2] ? Number(match[2]) : null,
  };
};

const nextCdcrSeriesNumber = async () => {
  const existingClients = await Client.find({}, { clientId: 1 }).lean();
  const existingChas = await CHA.find({}, { cdcrBase: 1 }).lean();

  const maxClientSeries = existingClients.reduce((max, item) => {
    const parsed = parseCdcrParts(item.clientId);
    return parsed ? Math.max(max, parsed.series) : max;
  }, 500);

  const maxChaSeries = existingChas.reduce((max, item) => {
    const parsed = parseCdcrParts(item.cdcrBase);
    return parsed ? Math.max(max, parsed.series) : max;
  }, 500);

  const maxExistingSeries = Math.max(maxClientSeries, maxChaSeries);

  let counter = await Counter.findOne({ name: "clientId" });
  if (!counter) {
    counter = await Counter.create({
      name: "clientId",
      value: maxExistingSeries
    });
  } else if (counter.value < maxExistingSeries) {
    counter.value = maxExistingSeries;
    await counter.save();
  }

  counter.value += 1;
  await counter.save();

  return counter.value;
};

// ADMIN ONLY
const createCHA = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can add CHA" });
  }

  const { chaname, contactPerson, mobile, email, officeAddress, remarks } = req.body;
  const nextSeries = await nextCdcrSeriesNumber();

  const cha = await CHA.create({
    chaname,
    cdcrBase: `CDCR-${nextSeries}`,
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
