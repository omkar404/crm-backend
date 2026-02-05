const jwt = require("jsonwebtoken");
const WorkdeskUser = require("../models/workdeskUser.model");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
    if (err) return res.sendStatus(401);

    const user = await WorkdeskUser.findById(decoded.userId).select("-password");
    if (!user) return res.sendStatus(401);

    req.user = user;
    next();
  });
};
