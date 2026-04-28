const validate = (schema) => (req, res, next) => {
  if (!schema) return next();

  const result = schema.safeParse(req.body);

  if (!result.success) {
    const formatted = result.error.issues.map((err) => ({
      field: err.path[0],
      message: err.message
    }));

    return res.status(400).json({
      message: "Validation failed",
      errors: formatted
    });
  }

  req.body = result.data;
  next();
};

module.exports = { validate };
