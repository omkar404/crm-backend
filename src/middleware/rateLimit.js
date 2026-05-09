const store = new Map();

const cleanupExpiredEntries = (now) => {
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
};

const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 30,
  keyPrefix = "global",
  message = "Too many requests. Please try again later.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const ip =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    cleanupExpiredEntries(now);

    const key = `${keyPrefix}:${ip}`;
    const existing = store.get(key);

    if (!existing || existing.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.ceil((existing.expiresAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({ message });
    }

    existing.count += 1;
    store.set(key, existing);
    return next();
  };
};

module.exports = { createRateLimiter };
