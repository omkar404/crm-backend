const multer = require("multer");

const express = require("express");
const { createLead, listLeads, updateStatus, updateLead, deleteLead, importLeads, downloadSample } = require("../controllers/leadController");
const { login, register } = require("../controllers/authController");
const auth = require("../middleware/auth");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/import", upload.single("file"), importLeads);
router.get("/sample", downloadSample);

router.post("/create", auth, createLead);
router.get("/list", auth, listLeads);
router.patch("/status/:id", auth, updateStatus);
router.put("/update/:id", auth, updateLead);
router.delete("/delete/:id", deleteLead);


router.post("/register", register);
router.post("/login", login);

module.exports = router;