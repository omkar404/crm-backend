const { z } = require("zod");
const { MAIL_PRIORITY, MAIL_STATUS } = require("../constants/crmOptions");

const emailSchema = z.string().trim().email("Invalid email address");

const mailBodySchema = z.object({
  from: emailSchema.optional(),
  to: z.array(emailSchema).min(1, "At least one recipient is required").optional(),
  cc: z.array(emailSchema).optional(),
  bcc: z.array(emailSchema).optional(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().trim().optional(),
  status: z.enum(MAIL_STATUS).optional(),
  priority: z.enum(MAIL_PRIORITY).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  templateName: z.string().trim().max(150).optional(),
  templateSubject: z.string().trim().max(300).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: emailSchema.optional(),
  companyName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
  website: z.string().trim().max(250).optional(),
  ipAddress: z.string().trim().max(80).optional(),
  webSource: z.string().trim().max(150).optional(),
  emailVerified: z.boolean().optional(),
  emailSent: z.boolean().optional(),
  sourceDate: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().trim().max(5000).optional(),
}).strict();

const mailCreateSchema = mailBodySchema.extend({
  to: z.array(emailSchema).min(1, "At least one recipient is required"),
});

const mailUpdateSchema = mailBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

const bulkStatusSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "ids are required"),
  status: z.enum(MAIL_STATUS),
}).strict();

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "ids are required"),
}).strict();

module.exports = {
  mailCreateSchema,
  mailUpdateSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
};
