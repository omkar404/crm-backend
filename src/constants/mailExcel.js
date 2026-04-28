const path = require("path");
const {
  AEO_STATUS,
  LEAD_PRIORITY,
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_TYPE,
  STARTUP_CATEGORY,
  TURNOVER_OPTIONS,
} = require("./crmOptions");

const MAIL_EXCEL_HEADERS = [
  "Sr No",
  "name",
  "Email Id",
  "Template",
  "Subject",
  "Date",
  "IP Address",
  "Web",
  "email",
  "email verified",
  "city",
  "Email sent",
  "Status",
  "state",
  "pinCode",
  "contactPerson",
  "designation",
  "employees",
  "turnover",
  "startupCategory",
  "AEOStatus",
  "RCMCPanel",
  "RCMCType",
  "industry",
  "industryBrief",
  "leadType",
  "priorityRating",
  "leadSource",
  "leadStatus",
  "description",
  "notes",
];

const MAIL_REFERENCE_FILTERS = {
  sendEmailId: [
    "jaggdish@eximinq-audit.in",
    "jaggdish@eximinq-connect.in",
    "jaggdish@eximinq-group.in",
  ],
  templateType: ["A", "B", "C", "D", "E", "F", "COO-A", "COO-B", "COO-C", "COO-D"],
  ipAddress: ["Shruti", "Menka", "Raksha", "Ritesh"],
  webTabAndType: ["Edge", "Chrome", "Mozilla"],
  emailVerified: ["ok"],
  emailSentType: ["Yes", "No"],
  status: ["Reached", "Bounced", "Stop", "Enquiry"],
  leadType: LEAD_TYPE,
  priorityRating: LEAD_PRIORITY,
  leadSource: LEAD_SOURCE,
  leadStatus: LEAD_STATUS,
  turnover: TURNOVER_OPTIONS,
  startupCategory: STARTUP_CATEGORY,
  AEOStatus: AEO_STATUS,
};

const MAIL_SAMPLE_PATH = path.join(__dirname, "../static/sample-mails.xlsx");

module.exports = {
  MAIL_EXCEL_HEADERS,
  MAIL_REFERENCE_FILTERS,
  MAIL_SAMPLE_PATH,
};
