// ================================================================
// 🎨 UI KIT DÙNG CHUNG - Nâng cấp giao diện cho toàn bộ bot
// ================================================================
const { EmbedBuilder } = require("discord.js");

const COLORS = {
    gold: 0xf5c518,
    red: 0xed4245,
    green: 0x57f287,
    blue: 0x3b82f6,
    purple: 0x9b59b6,
    dark: 0x2b2d31,
    orange: 0xf97316,
    cyan: 0x22d3ee,
};

// Format tiền: 1.234.567 VND
const money = (n) => `${Math.floor(n || 0).toLocaleString("vi-VN")}`;
const vnd = (n) => `\`${money(n)} VND\``;

// ⏳ Đếm ngược TRỰC TIẾP: Discord tự cập nhật trên màn hình client, không cần edit!
// style R = "trong 15 giây", style T = "22:15:04"
const countdown = (endsAtMs, style = "R") => `<t:${Math.floor(endsAtMs / 1000)}:${style}>`;

// Thanh tiến trình: ratio 0-1 -> ██████░░░░
function bar(ratio, size = 10, fill = "█", empty = "░") {
    const f = Math.round(Math.max(0, Math.min(1, ratio)) * size);
    return fill.repeat(f) + empty.repeat(size - f);
}

// Thanh so kèo 2 phe (VD Tài vs Xỉu) 🔥🔥🔥🔥🔥🔥❄️❄️❄️❄️
function versusBar(a, b, size = 12, iconA = "🟥", iconB = "🟦") {
    if (a === 0 && b === 0) return "⬜".repeat(size);
    const fa = Math.round((a / (a + b)) * size);
    return iconA.repeat(fa) + iconB.repeat(size - fa);
}

// Xúc xắc emoji thật
const DICE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const dice = (n) => DICE[n] || "🎲";

// Số đẹp có dấu +/-
const delta = (n) => (n >= 0 ? `+${money(n)}` : `-${money(Math.abs(n))}`);

// Embed khung chuẩn của sòng
function casinoEmbed({ color = COLORS.gold, title, description }) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description || null)
        .setTimestamp();
}

// Edit tin nhắn AN TOÀN, không bao giờ làm sập bot
async function safeEdit(interaction, payload, messageId = null) {
    try {
        return await interaction.editReply(payload);
    } catch (e1) {
        try {
            const channel = await interaction.client.channels.fetch(interaction.channelId);
            const msg = await channel.messages.fetch(messageId || (await interaction.fetchReply()).id);
            return await msg.edit(payload);
        } catch (e2) {
            console.error(`❌ [safeEdit] ${e2.message}`);
            return null;
        }
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { COLORS, money, vnd, countdown, bar, versusBar, dice, delta, casinoEmbed, safeEdit, sleep };