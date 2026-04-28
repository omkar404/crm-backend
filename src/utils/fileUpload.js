const fs = require("fs");
const path = require("path");
const multer = require("multer");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const target = path.join(process.cwd(), "uploads", folder);
      ensureDir(target);
      cb(null, target);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || "");
      const baseName = path
        .basename(file.originalname || "file", extension)
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${extension}`);
    },
  });

const createUploader = ({ folder, allowedMimeTypes, fileSize, maxFiles = 10 }) =>
  multer({
    storage: createStorage(folder),
    limits: {
      fileSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  });

const attachmentUpload = createUploader({
  folder: "attachments",
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ],
  fileSize: 10 * 1024 * 1024,
  maxFiles: 10,
});

const importUpload = createUploader({
  folder: "imports",
  allowedMimeTypes: [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
  fileSize: 25 * 1024 * 1024,
  maxFiles: 1,
});

module.exports = {
  attachmentUpload,
  importUpload,
};
