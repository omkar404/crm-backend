const WorkdeskUser = require("../models/workdeskUser.model");
const { getServiceTypesConfig, setServiceTypesConfig } = require("../utils/workdeskSettings");

const getWorkdeskMeta = async (req, res) => {
  const staff = await WorkdeskUser.find({ role: "STAFF" })
    .sort({ name: 1 })
    .select("_id name email role");
  const serviceTypes = await getServiceTypesConfig();
  const workflowStatuses = [
    "Request Initiated",
    "Quote to be Sent",
    "Quote Approval Pending",
    "Quote Approved",
    "Application Drafting in Progress",
    "Draft Sent for Approval",
    "Draft Approved",
    "Submission",
    "Official Fees Paid",
    "In Process",
    "Deficiency Raised",
    "Deficiency Query Reply Awaited from Client",
    "Deficiency Replied",
    "Approved",
    "Pending for Invoicing",
    "Invoice Raised",
    "Invoice Paid",
  ];
  const adminWorkflowStatuses = [...workflowStatuses, "Strike Off"];

  res.json({
    serviceTypes,
    workflowStatuses: req.user.role === "ADMIN" ? adminWorkflowStatuses : workflowStatuses,
    staff,
  });
};

const updateServiceTypes = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can update service request master" });
  }

  const serviceTypes = req.body?.serviceTypes;
  if (!serviceTypes || typeof serviceTypes !== "object" || Array.isArray(serviceTypes)) {
    return res.status(400).json({ message: "serviceTypes object is required" });
  }

  const normalized = {};
  for (const [mainType, subTypes] of Object.entries(serviceTypes)) {
    const key = String(mainType || "").trim();
    if (!key) continue;

    const normalizedSubs = Array.isArray(subTypes)
      ? [...new Set(subTypes.map((item) => String(item || "").trim()).filter(Boolean))]
      : [];

    if (normalizedSubs.length === 0) continue;
    normalized[key] = normalizedSubs;
  }

  if (Object.keys(normalized).length === 0) {
    return res.status(400).json({ message: "At least one service type with sub-types is required" });
  }

  const updated = await setServiceTypesConfig(normalized);
  res.json({ serviceTypes: updated });
};

module.exports = {
  getWorkdeskMeta,
  updateServiceTypes,
};
