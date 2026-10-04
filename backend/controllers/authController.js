const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { toUser } = require("../models/serialize");
const generateToken = require("../utils/generateToken");

const registerUser = async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !email || !password) return res.status(400).json({ message: "Please fill all fields" });
  if (username.length < 2 || username.length > 40) return res.status(400).json({ message: "Username must be 2–40 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ message: "Password must be at least 8 characters and no more than 72 bytes." });

  const id = randomUUID();
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (id, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id, username, email, created_at",
      [id, username, email, hashedPassword]
    );
    const user = toUser(rows[0]);
    return res.status(201).json({ ...user, token: generateToken(id) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: "An account with this email already exists." });
    throw error;
  }
};

const loginUser = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ message: "Please fill all fields" });

  const { rows } = await pool.query("SELECT id, username, email, password, created_at FROM users WHERE email = $1", [email]);
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password))) return res.status(401).json({ message: "Invalid credentials" });
  const user = toUser(row);
  return res.json({ ...user, token: generateToken(row.id) });
};

const getMe = async (req, res) => res.json(req.user);

module.exports = { registerUser, loginUser, getMe };
