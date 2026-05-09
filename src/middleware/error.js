const errorHandler = (err, req, res, next) => {
  console.error(err);
  const isProduction = process.env.NODE_ENV === "production";

  const statusCode = res.statusCode && res.statusCode !== 200
    ? res.statusCode
    : 500;

  const message =
    statusCode >= 500 && isProduction
      ? "Internal server error"
      : err.message || "Server Error";

  res.status(statusCode).json({
    message,
    ...(isProduction ? {} : { stack: err.stack })
  });
};

module.exports = {errorHandler};
