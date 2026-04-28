const { z } = require("zod");
const {
  AEO_STATUS,
  LEAD_PRIORITY,
  LEAD_SOURCE,
  LEAD_STATUS,
  LEAD_TYPE,
  STARTUP_CATEGORY,
  TURNOVER_OPTIONS,
} = require("../constants/crmOptions");

const emailSchema = z.string().trim().email("Invalid email address");

const leadBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160).optional(),
  iecChaNo: z.string().trim().max(80).optional(),
  landlineNo: z.string().trim().max(30).optional(),
  mobileNo: z.string().trim().max(30).optional(),
  email: emailSchema.optional(),
  website: z.string().trim().max(250).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pinCode: z.string().trim().max(20).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  designation: z.string().trim().max(120).optional(),
  employees: z.number().int().nonnegative().optional(),
  turnover: z.enum(TURNOVER_OPTIONS).optional(),
  startupCategory: z.enum(STARTUP_CATEGORY).optional(),
  AEOStatus: z.enum(AEO_STATUS).optional(),
  RCMCPanel: z.string().trim().max(150).optional(),
  RCMCType: z.string().trim().max(150).optional(),
  industry: z.string().trim().max(150).optional(),
  industryBrief: z.string().trim().max(500).optional(),
  leadType: z.enum(LEAD_TYPE).optional(),
  priorityRating: z.enum(LEAD_PRIORITY).optional(),
  leadSource: z.enum(LEAD_SOURCE).optional(),
  leadStatus: z.enum(LEAD_STATUS).optional(),
  description: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
}).strict();

const leadCreateSchema = leadBodySchema.refine(
  (value) => Boolean(value.name),
  "Name is required"
);

const leadUpdateSchema = leadBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

const leadBulkStatusSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "ids are required"),
  status: z.enum(LEAD_STATUS),
}).strict();

const leadBulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "ids are required"),
}).strict();

module.exports = {
  leadCreateSchema,
  leadUpdateSchema,
  leadBulkStatusSchema,
  leadBulkDeleteSchema,
};
