// src/utils/cooldowns.js — PHIÊN BẢN 2.0
const cooldowns = new Map();

// ⏱️ Thời gian cooldown từng lệnh (GIÂY) — chỉnh số ở đây là xong
const cooldownConfig = {
    ping: 5,
    tuimu: 3600,      // 1 giờ
    daoham: 180,      // 3 phút
    baucua: 60,
    antrom: 5,        // Cooldown thật 2h nằm trong DB (lastThief), đây chỉ chống spam nút
    duangua: 5,
    daga: 10,
    cauca: 180,
    taixiu: 15,
    chungkhoan: 180,
    // ✨ Bổ sung các game trước đây bị bỏ sót (chỉnh tùy ý):
    jackpot: 5,
    oantuxi: 5,
    baicao: 10,
    doboom: 15,
    coquaynga: 15,
    bomhengio: 20,
    cadobongda: 30,
    leothap: 5,
    veso: 5,
};

// 🛡️ Admin có bị cooldown không? Đặt ADMIN_COOLDOWN_BYPASS=true trong env nếu muốn admin miễn cooldown
// Mặc định: false — admin CŨNG bị cooldown như người thường (đây là lý do bạn tưởng cooldown hỏng!)
const ADMIN_BYPASS = process.env.ADMIN_COOLDOWN_BYPASS === "true";

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(" ");
}

/**
 * Kiểm tra cooldown.
 * @returns 0 nếu được phép chạy, hoặc { expiresAt, timeLeftText } nếu đang cooldown
 */
function checkCooldown(userId, commandName) {
    const cooldownTime = cooldownConfig[commandName];
    if (!cooldownTime) return 0; // Lệnh không có cooldown

    if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());

    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const cooldownAmount = cooldownTime * 1000;

    if (timestamps.has(userId)) {
        const expiresAt = timestamps.get(userId) + cooldownAmount;
        if (now < expiresAt) {
            return {
                expiresAt, // dùng cho đếm ngược trực tiếp <t:xx:R>
                timeLeftText: formatTime((expiresAt - now) / 1000),
            };
        }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount); // Dọn RAM khi hết hạn
    return 0;
}

// Xóa cooldown của 1 người cho 1 lệnh (dùng khi lệnh thất bại giữa chừng, không muốn phạt oan)
function clearCooldown(userId, commandName) {
    cooldowns.get(commandName)?.delete(userId);
}

module.exports = { checkCooldown, clearCooldown, cooldownConfig, ADMIN_BYPASS };