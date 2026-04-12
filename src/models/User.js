const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  // 💰 Tiền tệ
  money: { type: Number, default: 1000 },
  bankMoney: { type: Number, default: 0 },         // Tiền trong ngân hàng
  lastDepositAt: { type: Date, default: null },    // Mốc thời gian gửi tiền để tính lãi
  // ---------------------------

  // ⏳ Cooldown
  lastDaily: { type: Date, default: null },
  lastWork: { type: Date, default: null },
  lastSteal: { type: Date, default: null }, // Riêng cho lệnh ăn trộm

  // 📊 Thống kê
  stats: {
    win: { type: Number, default: 0 },
    lose: { type: Number, default: 0 },
    gamblePlayed: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 }, 
    totalSpent: { type: Number, default: 0 }, 
  },

  // 🎒 Hệ thống Túi đồ
  inventory: [
    {
      itemId: { type: String },
      quantity: { type: Number, default: 1 },
      acquiredAt: { type: Date, default: Date.now },
    }
  ],

  // 🛡️ Hệ thống Bảo vệ (Ăn trộm sẽ check cái này)
  // 0: Không bảo vệ, 1: Cấp thấp, 2: Cấp cao
  securityLevel: { type: Number, default: 0 },

  // 👑 Hệ thống Danh hiệu
  titles: {
    owned: { type: [String], default: ["Tân Thủ"] },
    active: { type: String, default: "Tân Thủ" },
  },

  // ✨ Hệ thống Buff & Bùa
  buffs: {
    winRateBoost: { type: Number, default: 0 }, // Bùa Luck (vd: 0.1 = +10%)
    shield: { type: Number, default: 0 },       // Bùa Khiên (vd: 0.5 = giảm 50% tiền mất)
    expiry: { type: Date, default: null },
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

// ================= HÀM XỬ LÝ TẬP TRUNG (METHODS) =================

// 1. Lấy tỉ lệ thắng thực tế (đã cộng bùa Luck)
userSchema.methods.getWinRate = function(baseRate) {
    return baseRate + (this.buffs.winRateBoost || 0);
};

// 2. Xử lý kết quả Minigame (Tiền, Stats, Reset Bùa)
// isWin: true/false, betAmount: số tiền cược, multiplier: tỉ lệ ăn (vd: 2, 0.5)
userSchema.methods.processGamble = async function(isWin, betAmount, multiplier = 2) {
    if (isWin) {
        const winAmount = Math.floor(betAmount * multiplier);
        this.money += winAmount;
        this.stats.win += 1;
        this.stats.totalEarned += winAmount;
        
        // Dùng bùa Luck xong là mất (1 lần duy nhất)
        this.buffs.winRateBoost = 0;
        
        await this.save();
        return { success: true, change: winAmount };
    } else {
        let lossAmount = betAmount;
        
        // Nếu có khiên bảo vệ (Shield)
        if (this.buffs.shield > 0) {
            lossAmount = Math.floor(betAmount * (1 - this.buffs.shield));
            this.buffs.shield = 0; // Dùng xong là mất
        }

        this.money -= lossAmount;
        this.stats.lose += 1;
        this.stats.totalSpent += lossAmount; // Coi như tiền thua cược là một dạng xả tiền
        
        // Thua cũng mất bùa Luck
        this.buffs.winRateBoost = 0;

        this.stats.gamblePlayed += 1;
        await this.save();
        return { success: false, change: lossAmount };
    }
};

// Index tìm kiếm nhanh
userSchema.index({ userId: 1 });

module.exports = mongoose.model("User", userSchema);