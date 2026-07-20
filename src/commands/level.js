const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, bar, casinoEmbed } = require("../utils/ui");

const expNeeded = (level) => level * 100;

// Danh hiệu theo cấp độ
function levelTitle(level) {
    if (level >= 100) return { icon: "🌌", name: "Thánh Chat Bất Tử" };
    if (level >= 50) return { icon: "👑", name: "Vua Tán Gẫu" };
    if (level >= 30) return { icon: "💎", name: "Máy Chat Kim Cương" };
    if (level >= 20) return { icon: "🔥", name: "Mõm Vàng" };
    if (level >= 10) return { icon: "⚡", name: "Dân Chat Chuyên Nghiệp" };
    if (level >= 5) return { icon: "🌟", name: "Người Quen Mặt" };
    return { icon: "🌱", name: "Lính Mới Tò Te" };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("level")
        .setDescription("⭐ Xem cấp độ và kinh nghiệm chat của bạn (1 tin nhắn = 1 EXP)")
        .addUserOption((opt) =>
            opt.setName("user").setDescription("Xem level của người khác (để trống = xem mình)")
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const user = await User.findOne({ userId: target.id });

        if (!user) {
            return interaction.reply({ content: "❌ Người này chưa có dữ liệu! Chat vài câu trong kênh casino để bắt đầu nhận EXP nhé.", flags: 64 });
        }

        const level = user.level || 1;
        const exp = user.exp || 0;
        const needed = expNeeded(level);
        const title = levelTitle(level);

        // Xếp hạng level trong toàn hệ thống
        const higherCount = await User.countDocuments({
            $or: [{ level: { $gt: level } }, { level: level, exp: { $gt: exp } }],
        });
        const rank = higherCount + 1;

        const embed = casinoEmbed({ color: COLORS.cyan, title: `${title.icon} CẤP ĐỘ CỦA ${target.username.toUpperCase()}` })
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `> ${title.icon} Danh xưng: **${title.name}**\n> 🏆 Xếp hạng chat: **#${rank}** toàn hệ thống\n\n` +
                `# ⭐ CẤP ${level}\n` +
                `💠 **EXP:** \`${exp}/${needed}\`\n${bar(exp / needed, 14, "🟦", "⬛")} **${Math.floor((exp / needed) * 100)}%**\n\n` +
                `💬 Tổng tin nhắn đã chat: **${(user.totalMessages || 0).toLocaleString("vi-VN")}**\n` +
                `🎁 Thưởng cấp tiếp theo (Lv.${level + 1}): **${money((level + 1) * 10000)} VND**`
            )
            .setFooter({ text: "💡 Chat trong kênh casino để nhận 1 EXP/tin nhắn!" });

        await interaction.reply({ embeds: [embed] });
    },
};