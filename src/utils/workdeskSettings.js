const WorkdeskSetting = require("../models/workdeskSetting.model");
const { DEFAULT_SERVICE_TYPES } = require("../constants/serviceTypes");

const SERVICE_TYPES_KEY = "service_types";

async function getServiceTypesConfig() {
  const doc = await WorkdeskSetting.findOne({ key: SERVICE_TYPES_KEY }).lean();
  return doc?.value && Object.keys(doc.value).length ? doc.value : DEFAULT_SERVICE_TYPES;
}

async function setServiceTypesConfig(serviceTypes) {
  const updated = await WorkdeskSetting.findOneAndUpdate(
    { key: SERVICE_TYPES_KEY },
    { $set: { value: serviceTypes } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return updated.value;
}

module.exports = {
  getServiceTypesConfig,
  setServiceTypesConfig,
};
