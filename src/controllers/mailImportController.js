const xlsx = require("xlsx");
const path = require("path");

const importFromExcel = async (req, res) => {
  try {
    const Mail = require("../models/Mail");

    const filePath = path.join(__dirname, "../../uploads/EEPC MAHARASTRA.xlsx");
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length)
      return res.status(400).json({ success: false, message: "Excel file is empty" });

    // Delete old records
    await Mail.deleteMany({});

    // Drop all extra indexes to avoid duplicate key errors
    try {
      await Mail.collection.dropIndexes();
    } catch (e) {
      // ignore if no indexes
    }

    const docs = rows.map((row) => ({
      from: row["Email Id"] || row["email"] || "",
      to: row["email"] ? [row["email"]] : [],
      subject: row["Subject"] ? String(row["Subject"]) : "",
      body: row["notes"] || "",
      status: row["Email sent"] === "Yes" ? "sent" : "draft",
      sentAt: row["Email sent"] === "Yes" ? new Date() : null,
      isRead: false,
      ...row,
    }));

    // Batch insert 500 at a time
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const result = await Mail.insertMany(batch, { ordered: false, rawResult: true });
      totalInserted += result.insertedCount;
    }

    res.json({
      success: true,
      message: `${totalInserted} records imported successfully`,
      total: totalInserted,
      sheet: sheetName,
    });
  } catch (err) {
    if (err.result && err.result.nInserted) {
      return res.json({
        success: true,
        message: `${err.result.nInserted} records imported (some skipped)`,
        total: err.result.nInserted,
        skipped: err.result.writeErrors?.length || 0,
        firstError: err.result.writeErrors?.[0]?.errmsg || null,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const importFromUpload = async (req, res) => {
  try {
    const Mail = require("../models/Mail");

    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length)
      return res.status(400).json({ success: false, message: "Uploaded file is empty" });

    await Mail.deleteMany({});

    try {
      await Mail.collection.dropIndexes();
    } catch (e) {
      // ignore
    }

    const docs = rows.map((row) => ({
      from: row["Email Id"] || row["email"] || "",
      to: row["email"] ? [row["email"]] : [],
      subject: row["Subject"] ? String(row["Subject"]) : "",
      body: row["notes"] || "",
      status: row["Email sent"] === "Yes" ? "sent" : "draft",
      sentAt: row["Email sent"] === "Yes" ? new Date() : null,
      isRead: false,
      ...row,
    }));

    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const result = await Mail.insertMany(batch, { ordered: false, rawResult: true });
      totalInserted += result.insertedCount;
    }

    res.json({
      success: true,
      message: `${totalInserted} records imported successfully`,
      total: totalInserted,
      sheet: sheetName,
    });
  } catch (err) {
    if (err.result && err.result.nInserted) {
      return res.json({
        success: true,
        message: `${err.result.nInserted} records imported (some skipped)`,
        total: err.result.nInserted,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { importFromExcel, importFromUpload };