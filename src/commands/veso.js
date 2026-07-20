const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed } = require("../utils/ui");

// --- CẤU HÌNH HỆ THỐNG (GIỮ NGUYÊN) ---
const TICKET_PRICE = 100000;
const PRIZES = {
    db: { name: "Đặc Biệt", reward: 1000000000, digits: 6 },
    g1: { name: "Giải Nhất", reward: 200000000, digits: 5 },
    g2: { name: "Giải Nhì", reward: 100000000, digits: 5 },
    g3: { name: "Giải Ba", reward: 50000000, digits: 5 },
    g4: { name: "Giải Tư", reward: 20000000, digits: 5 },
    g5: { name: "Giải Năm", reward: 10000000, digits: 4 },
    g6: { name: "Giải Sáu", reward: 1000000, digits: 4 },
    g7: { name: "Giải Bảy", reward: 500000, digits: 3 },
    g8: { name: "Giải Tám", reward: 500000, digits: 2 },
};

const activeSessions = new Map();
let globalClient = null;
let timerStarted = false;

// --- HÀM TRỢ GIÚP (GIỮ NGUYÊN LOGIC) ---
function randomStr(length) {
    let res = "";
    for (let i = 0; i < length; i++) res += Math.floor(Math.random() * 10).toString();
    return res;
}

function generateResults() {
    return {
        g8: [randomStr(2)], g7: [randomStr(3)],
        g6: [randomStr(4), randomStr(4), randomStr(4)], g5: [randomStr(4)],
        g4: [randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5)],
        g3: [randomStr(5), randomStr(5)], g2: [randomStr(5)], g1: [randomStr(5)],
        db: [randomStr(6)],
    };
}

function checkTicket(ticket, results) {
    let wonPrizes = [];
    let totalPrize = 0;
    for (const [key, info] of Object.entries(PRIZES)) {
        if (results[key].some((r) => ticket.endsWith(r))) {
            wonPrizes.push(info.name);
            totalPrize += info.reward;
        }
    }
    return { wonPrizes, totalPrize };
}

// Kỳ quay tiếp theo: mốc :00 hoặc :30
function nextDrawTime() {
    const now = new Date();
    const msToNext = (30 - (now.getMinutes() % 30)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
    return Date.now() + (msToNext || 1800000);
}

// --- HỆ THỐNG TỰ ĐỘNG QUAY SỐ (GIỮ NGUYÊN + try/catch) ---
function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    const scheduleNext = () => {
        const now = new Date();
        const msToNext = (30 - (now.getMinutes() % 30)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
        setTimeout(async () => {
            try { await runLottery(); } catch (e) { console.error("[veso] Lỗi quay số:", e); }
            scheduleNext();
        }, msToNext || 1800000);
    };
    scheduleNext();
}

async function runLottery() {
    if (!globalClient || activeSessions.size === 0) return;

    const results = generateResults();

    // 📋 BẢNG KẾT QUẢ KIỂU XỔ SỐ KIẾN THIẾT THẬT
    const resultEmbed = casinoEmbed({ color: COLORS.gold, title: "🎰 ✦ KẾT QUẢ XỔ SỐ KIẾN THIẾT ✦ 🎰" })
        .setDescription(
            "```\n" +
            `┌──────────┬─────────────────────┐\n` +
            `│ ĐẶC BIỆT │ ${results.db[0].padStart(8)}            │\n` +
            `│ Giải 1   │ ${results.g1[0].padStart(8)}            │\n` +
            `│ Giải 2   │ ${results.g2[0].padStart(8)}            │\n` +
            `│ Giải 3   │ ${results.g3.join("  ")}      │\n` +
            `│ Giải 4   │ ${results.g4.slice(0, 4).join(" ")} │\n` +
            `│          │ ${results.g4.slice(4).join(" ")}       │\n` +
            `│ Giải 5   │ ${results.g5[0].padStart(8)}            │\n` +
            `│ Giải 6   │ ${results.g6.join("   ")}    │\n` +
            `│ Giải 7   │ ${results.g7[0].padStart(8)}            │\n` +
            `│ Giải 8   │ ${results.g8[0].padStart(8)}            │\n` +
            `└──────────┴─────────────────────┘\n` +
            "```" +
            `> 💎 Trúng Đặc Biệt (6 số cuối): **${money(PRIZES.db.reward)} VND**\n` +
            `> 🎯 So số từ **đuôi vé** — trùng đuôi giải nào ăn giải đó!`
        )
        .setFooter({ text: `🎟️ Kỳ quay tiếp theo lúc ${new Date(nextDrawTime()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} • Chúc các nhà đầu tư may mắn! 🍀` });

    for (const [channelId, playersMap] of activeSessions.entries()) {
        try {
            const channel = globalClient.channels.cache.get(channelId);
            if (!channel) continue;

            await channel.send({ embeds: [resultEmbed] });

            // 🧾 GỘP KẾT QUẢ NGƯỜI CHƠI VÀO 1 EMBED (tránh spam kênh)
            const lines = [];
            let totalPaid = 0;
            let luckyCount = 0;

            for (const [userId, ticket] of playersMap.entries()) {
                const { wonPrizes, totalPrize } = checkTicket(ticket, results);
                const userDB = await User.findOne({ userId });

                if (totalPrize > 0 && userDB) {
                    userDB.money += totalPrize;
                    if (userDB.stats) { userDB.stats.win++; userDB.stats.gamblePlayed++; }
                    await userDB.save();
                    totalPaid += totalPrize;
                    luckyCount++;
                    lines.push(`> 🎉 <@${userId}> — vé \`${ticket}\` → **TRÚNG ${wonPrizes.join(" + ")}** 💰 **+${money(totalPrize)}**`);
                } else {
                    if (userDB?.stats) { userDB.stats.lose++; userDB.stats.gamblePlayed++; await userDB.save(); }
                    lines.push(`> ☁️ <@${userId}> — vé \`${ticket}\` → *trượt, giữ vé làm kỷ niệm...*`);
                }
            }

            const summaryEmbed = casinoEmbed({
                color: luckyCount > 0 ? COLORS.green : COLORS.dark,
                title: luckyCount > 0 ? `🎊 CÓ ${luckyCount} NGƯỜI TRÚNG SỐ ĐỔI ĐỜI!` : "☁️ KỲ NÀY KHÔNG AI TRÚNG...",
            })
                .setDescription(lines.join("\n"))
                .setFooter({ text: luckyCount > 0 ? `💰 Tổng trả thưởng: ${money(totalPaid)} VND` : "Đài an ủi: 'Lần sau sẽ trúng mà!' 🥲" });

            await channel.send({ embeds: [summaryEmbed] });
        } catch (e) {
            console.error(`[veso] Lỗi trả kết quả kênh ${channelId}:`, e.message);
        }
    }
    activeSessions.clear();
}

// --- COMMAND CHÍNH ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName("veso")
        .setDescription("🎟️ Mua vé số kiến thiết - 30 phút xổ một lần")
        .addStringOption((opt) =>
            opt.setName("so").setDescription("Nhập 6 số bất kỳ (VD: 081299)").setRequired(true).setMaxLength(6).setMinLength(6)
        ),

    async execute(interaction) {
        if (!globalClient) globalClient = interaction.client;
        startTimer();

        const ticket = interaction.options.getString("so");
        if (!/^\d{6}$/.test(ticket)) return interaction.reply({ content: "❌ Vui lòng nhập đúng 6 chữ số!", flags: 64 });

        await interaction.deferReply();
        const userDB = await User.findOne({ userId: interaction.user.id });

        if (!userDB || userDB.money < TICKET_PRICE) {
            return interaction.editReply(`❌ Cần ${vnd(TICKET_PRICE)} để mua vé! Ví bạn còn ${vnd(userDB?.money || 0)}.`);
        }
        if (userDB.banned) return interaction.editReply("🚫 Bạn bị cấm tham gia!");

        const channelId = interaction.channelId;
        if (!activeSessions.has(channelId)) activeSessions.set(channelId, new Map());
        const channelPlayers = activeSessions.get(channelId);

        if (channelPlayers.has(interaction.user.id)) {
            return interaction.editReply(`⏳ Bạn đã mua vé \`${channelPlayers.get(interaction.user.id)}\` cho kỳ này rồi!\n🎰 Quay số ${countdown(nextDrawTime())}`);
        }

        userDB.money -= TICKET_PRICE;
        await userDB.save();
        channelPlayers.set(interaction.user.id, ticket);

        const drawAt = nextDrawTime();
        const buyEmbed = casinoEmbed({ color: COLORS.blue, title: "🎟️ ✦ VÉ SỐ KIẾN THIẾT ✦ 🎟️" })
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription(
                "```\n" +
                `╔═══════════════════════╗\n` +
                `║   VÉ SỐ KIẾN THIẾT    ║\n` +
                `║                       ║\n` +
                `║   ➤  ${ticket.split("").join(" ")}    ║\n` +
                `║                       ║\n` +
                `║  Giải ĐB: 1 TỶ VND 💎 ║\n` +
                `╚═══════════════════════╝\n` +
                "```" +
                `> 💵 Giá vé: **-${money(TICKET_PRICE)} VND** • Ví còn: ${vnd(userDB.money)}\n` +
                `> 🎰 **Quay số ${countdown(drawAt)}** — lúc ${countdown(drawAt, "t")}\n` +
                `> 🎫 Kênh này đã bán: **${channelPlayers.size}** vé kỳ này`
            )
            .setFooter({ text: "🍀 So từ đuôi vé — trùng đuôi giải nào ăn giải đó! Chúc may mắn!" });

        await interaction.editReply({ embeds: [buyEmbed] });
    },
};