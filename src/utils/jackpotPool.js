// src/utils/jackpotPool.js — HŨ JACKPOT CỘNG DỒN TOÀN SERVER
const mongoose = require("mongoose");
const User = require("../models/User");

// Model hũ (1 document duy nhất)
const poolSchema = new mongoose.Schema({
    key: { type: String, default: "global", unique: true },
    pot: { type: Number, default: 1000000 }, // Hũ khởi điểm 1 triệu
    lastWinnerId: { type: String, default: null },
    lastWinAmount: { type: Number, default: 0 },
    lastWinAt: { type: Date, default: null },
});
const Pool = mongoose.models.JackpotPool || mongoose.model("JackpotPool", poolSchema);

const SEED = 1000000;       // Hũ hồi về 1 triệu sau khi nổ
const CONTRIB_RATE = 0.02;  // Trích 2% tiền thua vào hũ
const EXPLODE_CHANCE = 0.002; // 0.2% nổ hũ mỗi ván chơi

async function getPool() {
    let pool = await Pool.findOne({ key: "global" });
    if (!pool) pool = await Pool.create({ key: "global" });
    return pool;
}

// 💰 Góp 2% tiền thua vào hũ (gọi trong các game khi người chơi thua)
async function contribute(lossAmount) {
    try {
        if (!lossAmount || lossAmount <= 0) return;
        await Pool.findOneAndUpdate(
            { key: "global" },
            { $inc: { pot: Math.floor(lossAmount * CONTRIB_RATE) } },
            { upsert: true }
        );
    } catch (e) { /* im lặng, không làm hỏng game */ }
}

// 🎰 Quay xổ nổ hũ (0.2% mỗi ván) — gọi 1 lần/người/ván sau khi game kết thúc
async function tryExplode(client, channelId, userId) {
    try {
        if (Math.random() >= EXPLODE_CHANCE) return false;

        const pool = await getPool();
        const winAmount = pool.pot;
        if (winAmount < 100000) return false; // Hũ quá bé thì thôi

        const user = await User.findOne({ userId });
        if (!user) return false;
        user.money += winAmount;
        await user.save();

        pool.pot = SEED;
        pool.lastWinnerId = userId;
        pool.lastWinAmount = winAmount;
        pool.lastWinAt = new Date();
        await pool.save();

        // 📣 Thông báo hoành tráng ra kênh
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
            channel.send(
                `# 💥🎰 NỔ HŨŨŨŨŨ!!! 🎰💥\n` +
                `## 👑 <@${userId}> vừa NỔ HŨ JACKPOT toàn server!\n` +
                `# 💰 +${winAmount.toLocaleString("vi-VN")} VND\n` +
                `> 🍀 Xác suất chỉ 0.2%/ván mà trúng — nhân phẩm vô cực!\n` +
                `> 🏺 Hũ mới đã được gieo lại **${SEED.toLocaleString("vi-VN")} VND** — gõ \`/hu\` xem hũ phồng!`
            ).catch(() => {});
        }
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { getPool, contribute, tryExplode, SEED, CONTRIB_RATE, EXPLODE_CHANCE };