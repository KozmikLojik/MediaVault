const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const { pool, initializeDatabase } = require("./config/db");

const app = express();
const server = http.createServer(app);
app.disable("x-powered-by");
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Stable public Vercel production URL. Keep FRONTEND_ORIGIN configurable for future domains.
  "https://media-vault-iota-topaz.vercel.app",
  ...(process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
];

const isAllowedOrigin = (origin) =>
  !origin ||
  allowedOrigins.includes(origin) ||
  /^chrome-extension:\/\/[a-p]{32}$/i.test(origin);

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
};

const io = new Server(server, { cors: corsOptions });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || !process.env.JWT_SECRET) {
    return next(new Error("Not authorized"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error("Not authorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
});

app.set("io", io);
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok", database: "connected" });
  } catch {
    return res.status(503).json({ status: "database unavailable", database: "disconnected" });
  }
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/progress", require("./routes/progressRoutes"));
app.use("/api/recommendations", require("./routes/recommendationRoutes"));

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error.code === "23505") {
    return res.status(409).json({ message: "A title with that name is already in your library." });
  }
  if (error.name === "ValidationError" || error.name === "CastError" || error.code === "22P02" || error.code === "23514") {
    return res.status(400).json({ message: "Some of the provided details are invalid." });
  }
  if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01"].includes(error.code)) {
    return res.status(503).json({ message: "The database is temporarily unavailable. Try again shortly." });
  }
  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ message: "This website is not allowed to access the API." });
  }
  console.error("Request failed:", error.message);
  return res.status(500).json({ message: "The server could not complete the request." });
});

const start = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  await initializeDatabase();
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`MediaVault API listening on port ${port}`);
  });
};

const shutdown = (signal) => {
  console.log(`${signal} received; closing MediaVault API`);
  io.close(() => {
    pool.end().finally(() => process.exit(0));
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  if (error.code === "ENOTFOUND") console.error("Check the PostgreSQL hostname in DATABASE_URL.");
  if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") console.error("Check that the PostgreSQL service is running and reachable.");
  process.exitCode = 1;
  server.close();
});
