const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  // 💰 Tiền
  money: { type: Number, default: 1000 },

  // ⏳ Cooldown
  lastDaily: { type: Date, default: null },
  lastWork: { type: Date, default: null },

  // 📊 Stats
  stats: {
    win: { type: Number, default: 0 },
    lose: { type: Number, default: 0 },
    gamblePlayed: { type: Number, default: 0 },
  },

  // 🏦 Vay tiền
  loan: {
    active: { type: Boolean, default: false },
    from: { type: String, default: null },
    amount: { type: Number, default: 0 },
    dueAt: { type: Date, default: null },
  },

  banned: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
