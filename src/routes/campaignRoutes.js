const express = require("express");
const auth = require("../middleware/auth");
const {
  createCampaign,
  generateCampaignAudience,
  getCampaignAnalytics,
  listCampaignAudience,
  listCampaignLeads,
  listCampaignHistory,
  listCampaigns,
  listSenderAccounts,
  sendCampaign,
} = require("../controllers/campaignController");

const router = express.Router();

router.get("/", auth, listCampaigns);
router.post("/", auth, createCampaign);
router.get("/leads", auth, listCampaignLeads);
router.get("/audience", auth, listCampaignAudience);
router.post("/audience/generate", auth, generateCampaignAudience);
router.get("/senders", auth, listSenderAccounts);
router.get("/history", auth, listCampaignHistory);
router.get("/analytics", auth, getCampaignAnalytics);
router.post("/send", auth, sendCampaign);

module.exports = router;
