const express = require("express");
const {
  createClient,
  updateClient,
  getClients,
  getClientSecrets
} = require("../controllers/workdeskClient.controller");
const { validate } = require("../middleware/validate.js");
const { createClientSchema, updateClientSchema } = require("../validations/client.validation.js");
const workdeskAuth = require("../middleware/workdeskAuth");

const router = express.Router();

router.post("/clients", workdeskAuth,validate(createClientSchema), createClient);
router.put("/clients/:id", workdeskAuth,validate(updateClientSchema), updateClient);
router.get("/clients", workdeskAuth, getClients);
router.get("/clients/:id/secrets", workdeskAuth, getClientSecrets);

module.exports = router;
