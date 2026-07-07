const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
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
