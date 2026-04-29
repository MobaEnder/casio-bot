const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// --- CẤU HÌNH HỆ THỐNG ---
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

// --- HÀM TRỢ GIÚP ---
function randomStr(length) {
    let res = '';
    for (let i = 0; i < length; i++) res += Math.floor(Math.random() * 10).toString();
    return res;
}

function generateResults() {
    return {
        g8: [randomStr(2)], g7: [randomStr(3)],
        g6: [randomStr(4), randomStr(4), randomStr(4)], g5: [randomStr(4)],
        g4: [randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5)],
        g3: [randomStr(5), randomStr(5)], g2: [randomStr(5)], g1: [randomStr(5)],
        db: [randomStr(6)]
    };
}

function checkTicket(ticket, results) {
    let wonPrizes = [];
    let totalPrize = 0;
    for (const [key, info] of Object.entries(PRIZES)) {
        if (results[key].some(r => ticket.endsWith(r))) {
            wonPrizes.push(info.name);
            totalPrize += info.reward;
        }
    }
    return { wonPrizes, totalPrize };
}

// --- HỆ THỐNG TỰ ĐỘNG QUAY SỐ ---
function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    const scheduleNext = () => {
        const now = new Date();
        const msToNext = (30 - (now.getMinutes() % 30)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
        setTimeout(async () => { await runLottery(); scheduleNext(); }, msToNext || 1800000);
    };
    scheduleNext();
}

async function runLottery() {
    if (!globalClient || activeSessions.size === 0) return;

    const results = generateResults();
    const resultEmbed = new EmbedBuilder()
        .setTitle("🎰 NHẬT KÝ QUAY THƯỞNG KỲ NÀY")
        .setColor(0xf1c40f)
        .setThumbnail("https://baocantho.com.vn/image/fckeditor/upload/2025/20250901/images/t9-IMG_5393.webp") // Thay icon nếu muốn
        .addFields(
            { name: "💎 Giải Đặc Biệt", value: `\`${results.db[0]}\``, inline: false },
            { name: "🥇 Giải Nhất & Nhì", value: `G1: \`${results.g1[0]}\`\nG2: \`${results.g2[0]}\``, inline: true },
            { name: "🥉 Giải Ba & Tư", value: `G3: \`${results.g3.join(" ")}\`\nG4: \`${results.g4[0]}...\``, inline: true },
            { name: "🎫 Các giải khác", value: `G8 (2 số): \`${results.g8[0]}\` | G7: \`${results.g7[0]}\``, inline: false }
        )
        .setFooter({ text: "Chúc mừng các nhà đầu tư may mắn! 🍀" });

    for (const [channelId, playersMap] of activeSessions.entries()) {
        const channel = globalClient.channels.cache.get(channelId);
        if (!channel) continue;

        await channel.send({ embeds: [resultEmbed] });

        for (const [userId, ticket] of playersMap.entries()) {
            const { wonPrizes, totalPrize } = checkTicket(ticket, results);
            const userDB = await User.findOne({ userId });

            const winEmbed = new EmbedBuilder()
                .setTitle(totalPrize > 0 ? "🎉 KẾT QUẢ TRÚNG THƯỞNG" : "☁️ KẾT QUẢ VÉ SỐ")
                .setColor(totalPrize > 0 ? 0x2ecc71 : 0x95a5a6)
                .addFields(
                    { name: "👤 Người chơi", value: `<@${userId}>`, inline: true },
                    { name: "🔢 Vé đã mua", value: `\`${ticket}\``, inline: true },
                    { name: "💰 Thu nhập", value: `\`+${totalPrize.toLocaleString()} VND\``, inline: true },
                    { name: "✨ Trạng thái", value: totalPrize > 0 ? `🧐 Bạn đã trúng: **${wonPrizes.join(", ")}**` : "🧐 Đồng nghiệp an ủi: 'Lần sau sẽ trúng mà!'" }
                )
                .setFooter({ text: `Ví hiện tại: ${((userDB?.money || 0) + totalPrize).toLocaleString()} VND | Chăm chỉ thì mới có ăn!` });

            if (totalPrize > 0 && userDB) {
                userDB.money += totalPrize;
                await userDB.save();
            }
            await channel.send({ embeds: [winEmbed] });
        }
    }
    activeSessions.clear();
}

// --- COMMAND CHÍNH ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName("veso")
        .setDescription("🎟️ Mua vé số kiến thiết - 30 phút xổ một lần")
        .addStringOption(opt => opt.setName("so").setDescription("Nhập 6 số bất kỳ (VD: 081299)").setRequired(true).setMaxLength(6).setMinLength(6)),

    async execute(interaction) {
        if (!globalClient) globalClient = interaction.client;
        startTimer();

        const ticket = interaction.options.getString("so");
        if (!/^\d{6}$/.test(ticket)) return interaction.reply({ content: "❌ Vui lòng nhập đúng 6 chữ số!", ephemeral: true });

        await interaction.deferReply();
        const userDB = await User.findOne({ userId: interaction.user.id });

        if (!userDB || userDB.money < TICKET_PRICE) {
            return interaction.editReply("❌ Bạn không đủ 100,000 VND để mua vé!");
        }

        const channelId = interaction.channelId;
        if (!activeSessions.has(channelId)) activeSessions.set(channelId, new Map());
        const channelPlayers = activeSessions.get(channelId);

        if (channelPlayers.has(interaction.user.id)) {
            return interaction.editReply("⏳ Bạn đã mua vé cho kỳ này rồi, hãy đợi kết quả nhé!");
        }

        userDB.money -= TICKET_PRICE;
        await userDB.save();
        channelPlayers.set(interaction.user.id, ticket);

        const buyEmbed = new EmbedBuilder()
            .setTitle("🎟️ NHẬT KÝ MUA VÉ")
            .setColor(0x3498db)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: "🔢 Số đã chọn", value: `\`${ticket}\``, inline: true },
                { name: "💰 Chi phí", value: `\`-${TICKET_PRICE.toLocaleString()} VND\``, inline: true },
                { name: "✨ Trạng thái", value: "🧐 Hệ thống đã ghi nhận số của bạn. Đợi 30p nhé!" }
            )
            .setFooter({ text: `Ví hiện tại: ${userDB.money.toLocaleString()} VND | Chúc bạn may mắn lần sau!` });

        await interaction.editReply({ embeds: [buyEmbed] });
    }
};