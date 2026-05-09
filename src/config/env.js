const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "SECRET_KEY",
];

const parseAllowedOrigins = () => {
  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [
    "https://eximinq.co.in",
    "https://www.eximinq.co.in",
    "http://localhost:5173",
  ];
};

const validateEnvironment = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

module.exports = {
  parseAllowedOrigins,
  validateEnvironment,
};
