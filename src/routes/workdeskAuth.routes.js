const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/workdeskAuth");
const requireWorkdeskAdmin = require("../middleware/requireWorkdeskAdmin");
const { createRateLimiter } = require("../middleware/rateLimit");
const controller = require("../controllers/workdeskAuth.controller");

const authRateLimit = createRateLimiter({
  keyPrefix: "workdesk-auth",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
});
const refreshRateLimit = createRateLimiter({
  keyPrefix: "workdesk-refresh",
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "Too many refresh attempts. Please sign in again.",
});

router.post("/register", authMiddleware, requireWorkdeskAdmin, controller.register);
router.post("/login", authRateLimit, controller.login);
router.post("/refresh-token", refreshRateLimit, controller.refreshToken);
router.get("/me", authMiddleware, controller.me);
router.post("/logout", controller.logout);

module.exports = router;
