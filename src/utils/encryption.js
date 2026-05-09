const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const secretKey = process.env.SECRET_KEY;

if (!secretKey) {
  throw new Error("SECRET_KEY environment variable is required for encryption");
}

// Create 32-byte key from SECRET_KEY
const key = crypto
  .createHash("sha256")
  .update(secretKey)
  .digest();

const ivLength = 16;

// Encrypt function
const encrypt = (text) => {
  if (!text) return text;

  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
};

// Decrypt function (use only when necessary)
const decrypt = (text) => {
  if (!text) return text;

  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = parts.join(":");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

module.exports = { encrypt, decrypt };
