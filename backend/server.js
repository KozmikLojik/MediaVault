const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
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

connectDB();

/*
========================================
MIDDLEWARE
========================================
*/

app.use(cors());

app.use(express.json());

/*
========================================
ROUTES
========================================
*/

app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

app.use(
  "/api/progress",
  require("./routes/progressRoutes")
);

/*
========================================
SERVER
========================================
*/

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(
    `Server Running On Port ${PORT}`
  );

});
