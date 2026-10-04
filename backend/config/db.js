const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required. Set it in the backend environment.");

  let hostname = "the configured database host";
  try { hostname = new URL(uri).hostname || hostname; } catch { /* Mongoose will report malformed URI details. */ }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } catch (error) {
    const errorText = `${error.code || ""} ${error.message || ""}`;
    if (/ENOTFOUND|querySrv/i.test(errorText)) {
      throw new Error(`MongoDB could not resolve ${hostname}. Copy a fresh connection string from the active Atlas cluster into MONGO_URI.`);
    }
    if (/ECONNREFUSED|ETIMEDOUT/i.test(errorText)) {
      throw new Error(`MongoDB at ${hostname} did not accept the connection. Check Atlas Network Access and the database user.`);
    }
    throw error;
  }
  console.log("MongoDB connected");
};

module.exports = connectDB;
