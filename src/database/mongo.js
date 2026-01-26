const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("❌ MONGO_URL chưa được set trong .env");

  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
}

module.exports = connectDB;
