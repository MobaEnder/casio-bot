const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, casinoEmbed } = require("../utils/ui");
require("dotenv").config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("anxa")
        .setDescription("🕊️ Ân xá cho người chơi bị Ban do nợ nần")
        .addUserOption((opt) =>
            opt.setName("nguoi").setDescription("Người chơi cần được ân xá").setRequired(true)
        ),

    async execute(interaction) {
        const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];

        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({
                content: "❌ Bạn không có quyền hạn của 'Thẩm phán' để thực thi lệnh ân xá này!",
                flags: 64,
            });
        }

        const target = interaction.options.getUser("nguoi");
        const userDB = await User.findOne({ userId: target.id });

        if (!userDB) {
            return interaction.reply({ content: `❌ Người chơi <@${target.id}> chưa từng tham gia hệ thống Casino.`, flags: 64 });
        }
        if (!userDB.banned) {
            return interaction.reply({ content: `🤔 <@${target.id}> hiện đang là công dân lương thiện, không có lệnh Ban nào cả.`, flags: 64 });
        }

        // Ghi lại khoản nợ cũ để hiển thị trước khi xóa
        const oldDebt = userDB.loan?.active ? userDB.loan.amount : 0;
        const oldLender = userDB.loan?.from || null;

        // Thực hiện ân xá (logic giữ nguyên)
        userDB.banned = false;
        if (userDB.loan) {
            userDB.loan.active = false;
            userDB.loan.amount = 0;
            userDB.loan.dueAt = null;
        }
        await userDB.save();

        const embed = casinoEmbed({ color: COLORS.gold, title: "🕊️ ✦ LỆNH ÂN XÁ TỐI CAO ✦ 🕊️" })
            .setThumbnail(target.displayAvatarURL())
            .setDescription(
                `\`\`\`\n  ⚖️ TÒA ÁN CASINO TỐI CAO\n  📜 QUYẾT ĐỊNH: ÂN XÁ TOÀN PHẦN\n\`\`\`` +
                `> 🏛️ **Thẩm phán:** <@${interaction.user.id}>\n` +
                `> 👤 **Người được ân xá:** <@${target.id}>\n` +
                (oldDebt > 0 ? `> 🧾 **Khoản nợ được xóa:** \`${money(oldDebt)} VND\`${oldLender ? ` (chủ nợ: <@${oldLender}>)` : ""}\n` : "") +
                `${"─".repeat(25)}\n` +
                `✨ Tài khoản đã được **mở khóa hoàn toàn**, mọi lệnh phong tỏa và nợ nần được xóa bỏ.\n` +
                `🌅 Hãy làm lại cuộc đời — và lần này đừng trốn nợ nữa nhé!`
            )
            .setFooter({ text: "⚖️ Công lý luôn khoan hồng với kẻ biết quay đầu" });

        return interaction.reply({ embeds: [embed] });
    },
};