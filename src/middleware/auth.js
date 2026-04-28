const jwt = require("jsonwebtoken");

const getTokenFromRequest = (req) => {
  const authorization = req.headers.authorization;

  if (authorization) {
    const [scheme, value] = authorization.split(" ");

    if (value && /^Bearer$/i.test(scheme)) {
      return value.trim();
    }

    return authorization.trim();
  }

  if (req.headers["x-access-token"]) {
    return String(req.headers["x-access-token"]).trim();
  }

  if (req.cookies?.token) {
    return String(req.cookies.token).trim();
  }

  if (req.query?.token) {
    return String(req.query.token).trim();
  }

  return "";
};

module.exports = function (req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
