const Client = require("../models/client.model.js");
const CHA = require("../models/cha.model.js");
const Counter = require("../models/counter.model.js");
const { formatISTDate } = require("../utils/dateFormatter.js");
const { encrypt } = require("../utils/encryption.js");
const { asyncHandler } = require("../utils/asyncHandler.js");

const sanitizeClient = (client) => {
  const safeClient = client.toObject ? client.toObject() : { ...client };

  delete safeClient.dgftPassword;
  delete safeClient.icegatePassword;
  delete safeClient.authSignatoryAadhaar;

  if (Array.isArray(safeClient.dscLog)) {
    safeClient.dscLog = safeClient.dscLog.map((log) => ({
      ...log,
      formattedDate: formatISTDate(log.date)
    }));
  }

  return safeClient;
};

// helper for clientId
const generateClientId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "clientId" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );

  return `CDCR-${counter.value}`;
};

// ADMIN ONLY
const createClient = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admin can add client" });
    }

    const {
      name,
      source,
      chaId,
      contactPerson,
      contactEmail,
      contactMobile,
      dgftLogin,
      dgftPassword,
      icegateLogin,
      icegatePassword,
      dscHolder,
      dscExpiry,
      authSignatoryName,
      authSignatoryMobile,
      authSignatoryAadhaar
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Client name is required" });
    }

    let chaName = "";
    if (source === "CHA" && chaId) {
      const cha = await CHA.findById(chaId);
      if (!cha) {
        return res.status(400).json({ message: "Invalid CHA" });
      }
      chaName = cha.chaname;
    }

    const client = await Client.create({
      name,
      source,
      chaId: source === "CHA" ? chaId : null,
      chaName,
      contactPerson,
      contactEmail,
      contactMobile,
      dgftLogin,
      dgftPassword: encrypt(dgftPassword),
      icegateLogin,
      icegatePassword: encrypt(icegatePassword),
      dscHolder,
      dscExpiry,
      authSignatoryName,
      authSignatoryMobile,
      authSignatoryAadhaar: encrypt(authSignatoryAadhaar),
      clientId: await generateClientId(),
      dscStatus: "Inward",
      dscLog: [
        {
          status: "Inward",
          note: "Initial Entry",
          user: req.user.id,
          date: new Date()
        }
      ],
      createdBy: req.user.id
    });

    return res.status(201).json(sanitizeClient(client));

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN ONLY
const updateClient = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can update client" });
  }

  const data = req.body;
  const client = await Client.findById(req.params.id);
  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }

  let chaName = client.chaName;

  if (data.source === "CHA" && data.chaId) {
    const cha = await CHA.findById(data.chaId);
    if (!cha) return res.status(400).json({ message: "Invalid CHA" });
    chaName = cha.chaname;
  }

  if (data.dscStatus && data.dscStatus !== client.dscStatus) {
    client.dscLog.push({
      status: data.dscStatus,
      note: data.note || "DSC status updated",
      user: req.user.id,
      date: new Date()
    });

    client.dscStatus = data.dscStatus;
  }

  if (data.dgftPassword) {
    data.dgftPassword = encrypt(data.dgftPassword);
  }

  if (data.icegatePassword) {
    data.icegatePassword = encrypt(data.icegatePassword);
  }

  if (data.authSignatoryAadhaar) {
    data.authSignatoryAadhaar = encrypt(data.authSignatoryAadhaar);
  }

  Object.assign(client, {
    ...data,
    chaName,
    updatedBy: req.user.id
  });
  await client.save();

  res.json(sanitizeClient(client));
};

// ADMIN + STAFF
const getClients = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";

  const skip = (page - 1) * limit;

  let filter = {};

  if (req.user.role !== "ADMIN") {
    filter.createdBy = req.user.id;
  }

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  const total = await Client.countDocuments(filter);

  const clients = await Client.find(filter)
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  const formattedClients = clients.map(sanitizeClient);

  res.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    data: formattedClients
  });
});

module.exports = {
  createClient,
  updateClient,
  getClients
};
