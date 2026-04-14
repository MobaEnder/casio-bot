// src/utils/cooldowns.js
const cooldowns = new Map();

// thời gian cooldown từng lệnh (giây)
const cooldownConfig = {
    ping: 5,
    tuimu: 3600,
    daoham: 180,
    baucua: 60,
    antrom: 7200,
    duangua: 5,
    daga: 10,
};

// 🛠️ Đã sửa: Hỗ trợ hiển thị cả Giờ, Phút, Giây
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`); // Luôn hiện giây kể cả khi nó là 0s

    return parts.join(" ");
}

function checkCooldown(userId, commandName) {
    const cooldownTime = cooldownConfig[commandName];

    // nếu lệnh không có cooldown thì bỏ qua
    if (!cooldownTime) return 0;

    if (!cooldowns.has(commandName)) {
        cooldowns.set(commandName, new Map());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const cooldownAmount = cooldownTime * 1000;

    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return formatTime(timeLeft);
        }
    }

    // Cập nhật thời gian mới
    timestamps.set(userId, now);

    // Xóa khỏi RAM khi hết hạn
    setTimeout(() => {
        timestamps.delete(userId);
    }, cooldownAmount);

    return 0;
}

module.exports = {
    checkCooldown,
    cooldownConfig
};
