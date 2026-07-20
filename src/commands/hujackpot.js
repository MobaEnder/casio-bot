const { SlashCommandBuilder } = require("discord.js");
const { COLORS, money, casinoEmbed } = require("../utils/ui");
const { getPool, CONTRIB_RATE, EXPLODE_CHANCE } = require("../utils/jackpotPool");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hu")
        .setDescription("🏺 Xem Hũ Jackpot cộng dồn toàn server"),

    async execute(interaction) {
        const pool = await getPool();

        const lastWin = pool.lastWinnerId
            ? `> 👑 Người nổ hũ gần nhất: <@${pool.lastWinnerId}>\n> 💰 Trúng: \`${money(pool.lastWinAmount)} VND\` — <t:${Math.floor(new Date(pool.lastWinAt).getTime() / 1000)}:R>`
            : "> 🌱 *Chưa ai từng nổ hũ... người đầu tiên sẽ là huyền thoại!*";

        const embed = casinoEmbed({ color: COLORS.gold, title: "🏺 ✦ HŨ JACKPOT TOÀN SERVER ✦ 🏺" })
            .setDescription(
                `\`\`\`\n     🏺✨🏺\n    ╱ 💰💰 ╲\n   ╱  💰💰💰 ╲\n  ╰━━━━━━━━━━╯\n\`\`\`` +
                `# 💰 ${money(pool.pot)} VND\n${"─".repeat(25)}\n` +
                `> 📥 **Cách hũ phồng:** trích **${CONTRIB_RATE * 100}%** tiền thua từ các game (Tài Xỉu, Bầu Cua, Xì Dách, Mèo Nổ...)\n` +
                `> 🎰 **Cách nổ hũ:** mỗi ván chơi bạn có **${EXPLODE_CHANCE * 100}%** cơ hội nổ hũ ăn TRỌN số tiền trên!\n\n${lastWin}`
            )
            .setFooter({ text: "💡 Chơi càng nhiều ván, càng nhiều lượt xổ nổ hũ!" });

        await interaction.reply({ embeds: [embed] });
    },
};