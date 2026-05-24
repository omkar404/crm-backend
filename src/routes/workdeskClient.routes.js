const express = require("express");
const {
  createClient,
  updateClient,
  getClients,
  getClientSecrets
} = require("../controllers/workdeskClient.controller");
const workdeskAuth = require("../middleware/workdeskAuth");

const router = express.Router();

router.post("/clients", workdeskAuth, createClient);
router.put("/clients/:id", workdeskAuth, updateClient);
router.get("/clients", workdeskAuth, getClients);
router.get("/clients/:id/secrets", workdeskAuth, getClientSecrets);

module.exports = router;
