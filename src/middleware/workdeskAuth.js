const jwt = require("jsonwebtoken");
const WorkdeskUser = require("../models/workdeskUser.model");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [scheme, tokenValue] = authHeader.split(" ");
    const token = /^Bearer$/i.test(scheme) ? tokenValue : authHeader;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await WorkdeskUser.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("User not found");
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();

  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    next(error);
  }
};
