const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { toUser } = require("../models/serialize");

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ message: "Not authorized, no token" });

  let decoded;
  try {
    decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const { rows } = await pool.query("SELECT id, username, email, created_at FROM users WHERE id = $1", [decoded.id]);
    if (!rows[0]) return res.status(401).json({ message: "User not found" });
    req.user = toUser(rows[0]);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { protect };
