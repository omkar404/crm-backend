const path = require("path");
const Counter = require("../models/counter.model");

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null && String(item).trim() !== "");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return ensureArray(parsed);
      } catch {
        return trimmed
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value].filter(Boolean);
};

const parseMaybeJson = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeEmail = (value) => {
  if (!value) {
    return "";
  }

  return String(value).trim().toLowerCase();
};

const normalizePhone = (value) => {
  if (!value) {
    return "";
  }

  return String(value).replace(/\D/g, "");
};

const cleanString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const toNullableString = (value) => {
  const normalized = cleanString(value);
  return normalized || undefined;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = cleanString(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePositiveInt = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const buildDateRange = (from, to, exact) => {
  if (exact) {
    const start = new Date(exact);
    if (Number.isNaN(start.getTime())) {
      return undefined;
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
  }

  const range = {};

  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }

  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  return Object.keys(range).length ? range : undefined;
};

const nextSequence = async (name, prefix) => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return `${prefix}-${String(counter.value).padStart(6, "0")}`;
};

const buildAttachmentMeta = (files = []) =>
  files.map((file) => ({
    originalName: file.originalname,
    fileName: file.filename,
    path: file.path,
    mimeType: file.mimetype,
    size: file.size,
    extension: path.extname(file.originalname || "").toLowerCase(),
  }));

module.exports = {
  ensureArray,
  parseMaybeJson,
  normalizeEmail,
  normalizePhone,
  cleanString,
  toNullableString,
  toBoolean,
  escapeRegex,
  parsePositiveInt,
  buildDateRange,
  nextSequence,
  buildAttachmentMeta,
};
