const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/workdeskAuth");
const requireWorkdeskAdmin = require("../middleware/requireWorkdeskAdmin");
const controller = require("../controllers/workdeskAuth.controller");

router.post("/register", authMiddleware, requireWorkdeskAdmin, controller.register);
router.post("/login", controller.login);
router.post("/refresh-token", controller.refreshToken);
router.get("/me", authMiddleware, controller.me);
router.post("/logout", controller.logout);

module.exports = router;
