const MAIL_STATUS = [
  "draft",
  "queued",
  "processing",
  "sent",
  "failed",
  "scheduled",
  "replied",
  "bounced",
  "stopped",
  "archived",
  "not_contacted",
  "contacted",
  "enquiry",
  "reached",
];

const MAIL_PRIORITY = ["low", "normal", "high", "urgent"];

const LEAD_TYPE = [
  "CHA",
  "Logistics",
  "Freight Forwarder",
  "Manufacturer",
  "Importer",
  "Exporter",
];

const LEAD_PRIORITY = ["Low", "Medium", "High", "Premium"];

const LEAD_SOURCE = [
  "RCMC Panel",
  "CHA Panel",
  "MCA Panel",
  "Website",
  "In Person",
  "In Reference",
  "Print Media",
  "FSSAI Panel",
  "EPR Panel",
  "Web Media",
  "AEO Panel",
  "Others",
];

const LEAD_STATUS = [
  "Not Contacted",
  "Email Sent",
  "Visit Scheduled",
  "Email id incorrect",
  "Contact on phone",
  "In Contact",
  "Interested",
  "In Process",
  "Login Created",
  "Login Rejected",
  "Not Interested",
  "Not Contactable",
  "Do Not Touch",
  "Spam / Fake Lead",
];

const TURNOVER_OPTIONS = [
  "NA",
  "Less than 10 Cr",
  "10 Cr - 50 Cr",
  "50 Cr - 100 Cr",
  "100 Cr - 500 Cr",
  "Above 500 Cr",
];

const STARTUP_CATEGORY = ["Yes", "No"];

const AEO_STATUS = ["NA", "AEO - T1", "AEO - T2", "AEO - T3", "AEO - LEO"];

module.exports = {
  MAIL_STATUS,
  MAIL_PRIORITY,
  LEAD_TYPE,
  LEAD_PRIORITY,
  LEAD_SOURCE,
  LEAD_STATUS,
  TURNOVER_OPTIONS,
  STARTUP_CATEGORY,
  AEO_STATUS,
};
