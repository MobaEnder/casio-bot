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
  lastThief: { type: Number, default: 0 }, // 🐛 FIX: antrom ghi vào field này nhưng schema thiếu -> mongoose vứt bỏ -> cooldown 2h không bao giờ hoạt động

  // 📊 Thống kê
  stats: {
    win: { type: Number, default: 0 },
    lose: { type: Number, default: 0 },
    gamblePlayed: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 }, 
    totalSpent: { type: Number, default: 0 }, 
  },

  // ⭐ Hệ thống Level (1 tin nhắn trong kênh casino = 1 EXP)
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },

  // 📜 Nhiệm vụ hằng ngày: { date, baseline: {gamble, win, msg}, claimed: [] }
  quests: { type: Object, default: {} },

  // 🏦 Cướp ngân hàng tổ đội (cooldown 2h lưu DB)
  lastHeist: { type: Number, default: 0 },

  // 🎡 Vòng quay may mắn (1 lượt free/ngày)
  lastSpin: { type: Number, default: 0 },

  // 🔥 Chuỗi điểm danh liên tục
  streak: { type: Number, default: 0 },

  // 🥤 Đoán cốc miễn phí (cooldown 1h lưu DB)
  lastCup: { type: Number, default: 0 },

  // 🏅 Thành tựu: { claimed: [id], displayed: id }
  achievements: { type: Object, default: {} },

  // 🐾 Hệ thống Pet: mảng pet + kho thức ăn
  pets: { type: Array, default: [] },
  petFood: { type: Object, default: {} },

  // 🎒 Hệ thống Túi đồ (Item thường)
  inventory: [
    {
      itemId: { type: String },
      quantity: { type: Number, default: 1 },
      acquiredAt: { type: Date, default: Date.now },
    }
  ],

  // 🃏 Hệ thống Thẻ bài (Gacha)
  cards: {
    type: Array,
    default: []
    /* Cấu trúc mỗi thẻ được lưu:
    {
        name: String,
        hp: Number, atk: Number, spd: Number, def: Number, mdef: Number, 
        atkSpd: Number, critRate: Number, critDmg: Number, price: Number
    }
    */
  },

  towerFloor: { type: Number, default: 1 },

  towerAttempts: { type: Number, default: 3 },

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

module.exports = mongoose.model("User", userSchema);