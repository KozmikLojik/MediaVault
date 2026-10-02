const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required. Set it in the backend environment.");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  console.log("MongoDB connected");
};

module.exports = connectDB;
