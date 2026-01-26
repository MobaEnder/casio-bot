const mongoose = require("mongoose");

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Railway connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  }
};
