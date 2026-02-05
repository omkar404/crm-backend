import Client from "../models/client.model.js";
import CHA from "../models/cha.model.js";
import { formatISTDate }  from "../utils/dateFormatter.js";

// helper for clientId
const generateClientId = async () => {
  const count = await Client.countDocuments();
  return `CDCR-${501 + count}`;
};

// ADMIN ONLY
export const createClient = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can add client" });
  }

  const data = req.body;

  let chaName = "";
  if (data.source === "CHA" && data.chaId) {
    const cha = await CHA.findById(data.chaId);
    if (!cha) return res.status(400).json({ message: "Invalid CHA" });
    chaName = cha.name;
  }

  const client = await Client.create({
    ...data,
    clientId: await generateClientId(),
    chaName,
    dscStatus: "Inward",
    dscLog: [
      {
        status: "Inward",
        note: "Initial Entry",
        user: "Admin",
        date: new Date()
      }
    ],
    createdBy: req.user.id
  });

  res.status(201).json(client);
};

// ADMIN ONLY
export const updateClient = async (req, res) => {
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
    chaName = cha.name;
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

  Object.assign(client, {
    ...data,
    chaName,
    updatedBy: req.user.id
  });

  res.json(client);
};

// ADMIN + STAFF
export const getClients = async (_req, res) => {
  const clients = await Client.find().sort({ createdAt: -1 });
  res.json(clients);

  const formattedClients = clients.map(client => ({
    ...client,
    dscLog: client.dscLog.map(log => ({
      ...log,
      formattedDate: formatISTDate(log.date)
    }))
  }));

  res.json(formattedClients);
};
