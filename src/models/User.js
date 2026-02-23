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

  // 🐲 Pet System
  pet: {
    type: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      element: { type: String, default: null },
      race: { type: String, default: "dragon" },

      level: { type: Number, default: 1 },
      exp: { type: Number, default: 0 },
      expNeeded: { type: Number, default: 120 },

      evolution: { type: Number, default: 0 },

      stats: {
        hp: { type: Number, default: 0 },
        atk: { type: Number, default: 0 },
        def: { type: Number, default: 0 },
        spd: { type: Number, default: 0 },
      },

      createdAt: { type: Date, default: null },
    },
    default: null,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
