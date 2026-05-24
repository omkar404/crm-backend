const Client = require("../models/client.model.js");
const CHA = require("../models/cha.model.js");
const Counter = require("../models/counter.model.js");
const { formatISTDate } = require("../utils/dateFormatter.js");
const { encrypt, decrypt } = require("../utils/encryption.js");
const { asyncHandler } = require("../utils/asyncHandler.js");

const sanitizeClient = (client) => {
  const safeClient = client.toObject ? client.toObject() : { ...client };

  delete safeClient.dgftPassword;
  delete safeClient.icegatePassword;
  delete safeClient.authSignatoryAadhaar;
  if (Array.isArray(safeClient.additionalPortalCredentials)) {
    safeClient.additionalPortalCredentials = safeClient.additionalPortalCredentials.map(
      ({ password, ...credential }) => credential
    );
  }

  if (Array.isArray(safeClient.dscLog)) {
    safeClient.dscLog = safeClient.dscLog.map((log) => ({
      ...log,
      formattedDate: formatISTDate(log.date)
    }));
  }

  return safeClient;
};

const withDecryptedSecrets = (client) => {
  const safeClient = sanitizeClient(client);

  return {
    ...safeClient,
    dgftPassword: client.dgftPassword ? decrypt(client.dgftPassword) : "",
    icegatePassword: client.icegatePassword ? decrypt(client.icegatePassword) : "",
    authSignatoryAadhaar: client.authSignatoryAadhaar
      ? decrypt(client.authSignatoryAadhaar)
      : "",
    additionalPortalCredentials: Array.isArray(client.additionalPortalCredentials)
      ? client.additionalPortalCredentials.map((credential) => ({
          portalName: credential.portalName || "",
          userId: credential.userId || "",
          password: credential.password ? decrypt(credential.password) : "",
        }))
      : [],
  };
};

const normalizeAdditionalPortalCredentials = (credentials = []) =>
  (Array.isArray(credentials) ? credentials : [])
    .map((credential = {}) => ({
      portalName: String(credential.portalName || "").trim(),
      userId: String(credential.userId || "").trim(),
      password: credential.password ? encrypt(String(credential.password)) : "",
    }))
    .filter((credential) => credential.portalName || credential.userId || credential.password);

const nextCdcrSeriesNumber = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "clientId" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );

  return counter.value;
};

const parseCdcrParts = (clientId = "") => {
  const match = String(clientId).trim().match(/^CDCR-(\d+)(?:-(\d+))?$/i);
  if (!match) return null;

  return {
    series: Number(match[1]),
    suffix: match[2] ? Number(match[2]) : null,
  };
};

const buildDirectClientId = async () => {
  const series = await nextCdcrSeriesNumber();
  return `CDCR-${series}`;
};

const buildChaClientId = async (cha) => {
  let cdcrBase = cha.cdcrBase || "";

  if (!cdcrBase) {
    const existingChaClients = await Client.find({ chaId: cha._id })
      .select("clientId")
      .lean();

    const firstParsed = existingChaClients
      .map((item) => parseCdcrParts(item.clientId))
      .find(Boolean);

    if (firstParsed) {
      cdcrBase = `CDCR-${firstParsed.series}`;
    } else {
      const nextSeries = await nextCdcrSeriesNumber();
      cdcrBase = `CDCR-${nextSeries}`;
    }

    cha.cdcrBase = cdcrBase;
    await cha.save();
  }

  const existingChaClients = await Client.find({ chaId: cha._id })
    .select("clientId")
    .lean();

  const maxSuffix = existingChaClients.reduce((max, item) => {
    const parsed = parseCdcrParts(item.clientId);
    if (!parsed) return max;
    if (`CDCR-${parsed.series}` !== cdcrBase) return max;
    return Math.max(max, parsed.suffix || 0);
  }, 0);

  return `${cdcrBase}-${maxSuffix + 1}`;
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
      additionalPortalCredentials,
      dscHolder,
      dscExpiry,
      authSignatoryName,
      authSignatoryMobile,
      authSignatoryAadhaar
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Client name is required" });
    }

    if (source === "CHA" && !chaId) {
      return res.status(400).json({ message: "CHA is required for CHA clients" });
    }

    let chaName = "";
    let generatedClientId = "";
    if (source === "CHA" && chaId) {
      const cha = await CHA.findById(chaId);
      if (!cha) {
        return res.status(400).json({ message: "Invalid CHA" });
      }
      chaName = cha.chaname;
      generatedClientId = await buildChaClientId(cha);
    } else {
      generatedClientId = await buildDirectClientId();
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
      additionalPortalCredentials: normalizeAdditionalPortalCredentials(additionalPortalCredentials),
      dscHolder,
      dscExpiry,
      authSignatoryName,
      authSignatoryMobile,
      authSignatoryAadhaar: encrypt(authSignatoryAadhaar),
      clientId: generatedClientId,
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

  if (Object.prototype.hasOwnProperty.call(data, "additionalPortalCredentials")) {
    data.additionalPortalCredentials = normalizeAdditionalPortalCredentials(
      data.additionalPortalCredentials
    );
  }

  delete data.clientId;

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

  const filter = {};

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

const getClientSecrets = asyncHandler(async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can view client secrets" });
  }

  const client = await Client.findById(req.params.id)
    .select("+dgftPassword +icegatePassword +authSignatoryAadhaar +additionalPortalCredentials.password");

  if (!client) {
    return res.status(404).json({ message: "Client not found" });
  }

  res.set("Cache-Control", "no-store");
  res.json(withDecryptedSecrets(client));
});

module.exports = {
  createClient,
  updateClient,
  getClients,
  getClientSecrets
};
