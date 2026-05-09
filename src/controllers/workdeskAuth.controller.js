const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const WorkdeskUser = require("../models/workdeskUser.model");

const isProduction = process.env.NODE_ENV === "production";

const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await WorkdeskUser.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await WorkdeskUser.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "STAFF",
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("WORKDESK REGISTER ERROR", err);
    res.status(500).json({ message: "Register failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await WorkdeskUser.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("workdeskRefreshToken", refreshToken, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.set("Cache-Control", "no-store");
    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("WORKDESK LOGIN ERROR", err);
    res.status(500).json({ message: "Login failed" });
  }
};

exports.refreshToken = async (req, res) => {
  const token = req.cookies.workdeskRefreshToken;
  if (!token) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const user = await WorkdeskUser.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const newAccessToken = generateAccessToken(user);
    res.set("Cache-Control", "no-store");
    res.json({ accessToken: newAccessToken });
  });
};

exports.me = async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ user: req.user });
};

exports.logout = async (req, res) => {
  res.clearCookie("workdeskRefreshToken", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
  res.json({ message: "Logged out successfully" });
};
