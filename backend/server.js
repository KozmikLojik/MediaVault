const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

console.log(process.env.MONGO_URI);

const app = express();

/*
========================================
MIDDLEWARE
========================================
*/

app.use(cors());

app.use(express.json());

/*
========================================
DATABASE
========================================
*/

mongoose.connect(process.env.MONGO_URI)

.then(() => {

  console.log("MongoDB Connected");

})

.catch((err) => {

  console.log("MONGO ERROR");

  console.log(err);

});

/*
========================================
ROUTES
========================================
*/

app.use(
  "/api/progress",
  require("./routes/progressRoutes")
);

/*
========================================
SERVER
========================================
*/

app.listen(5000, () => {

  console.log("Server Running On Port 5000");

});