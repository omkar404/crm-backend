const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const baseClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),

  source: z.enum(["Direct", "CHA"]).optional(),

  chaId: z
    .string()
    .regex(objectIdRegex, "Invalid CHA ID")
    .optional()
    .nullable(),

  contactPerson: z.string().optional(),

  contactEmail: z
  .string()
  .optional()
  .transform(v => v === "" ? undefined : v)
  .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),

contactMobile: z
  .string()
  .optional()
  .transform(v => v === "" ? undefined : v)
  .refine(v => !v || /^[0-9]{10}$/.test(v), "Mobile must be 10 digits"),
  dgftLogin: z.string().optional(),
  dgftPassword: z.string().optional(),

  icegateLogin: z.string().optional(),
  icegatePassword: z.string().optional(),

  dscHolder: z.string().optional(),
  dscExpiry: z.string().optional(),

  dscStatus: z.enum(["Inward", "Outward"]).optional(),
  note: z.string().optional(),

  authSignatoryName: z.string().optional(),

  authSignatoryMobile: z
    .string()
    .regex(/^[0-9]{10}$/, "Auth mobile must be 10 digits")
    .optional(),

authSignatoryAadhaar: z
  .string()
  .optional()
  .transform(v => v === "" ? undefined : v)
  .refine(v => !v || /^[0-9]{12}$/.test(v), "Aadhaar must be 12 digits")
  
}).strict(); // 🔥 Prevent unknown fields

// CREATE — name required
const createClientSchema = baseClientSchema.superRefine((data, ctx) => {
  if (data.source === "CHA" && !data.chaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "CHA ID is required when source is CHA",
      path: ["chaId"]
    });
  }
});

// UPDATE — all optional
const updateClientSchema = baseClientSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.source === "CHA" && !data.chaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CHA ID is required when source is CHA",
        path: ["chaId"]
      });
    }
  });

module.exports = {
  createClientSchema,
  updateClientSchema
};
