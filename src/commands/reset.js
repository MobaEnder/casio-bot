const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, casinoEmbed } = require("../utils/ui");

// 🐛 FIX BẢO MẬT: bản cũ hardcode 1 ID lạ — giờ đọc từ ADMIN_IDS trong env như các lệnh khác
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("reset")
        .setDescription("🔥 XÓA TOÀN BỘ DATABASE (Admin only)"),

    async execute(interaction) {
        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({ content: "❌ Bạn không có quyền dùng lệnh này!", flags: 64 });
        }

        // Thống kê trước khi xóa để admin biết mình sắp mất gì
        const totalUsers = await User.countDocuments({});
        const richest = await User.findOne({}).sort({ money: -1 });

        const embed = casinoEmbed({ color: COLORS.red, title: "☢️ ✦ CẢNH BÁO CẤP ĐỘ TẬN THẾ ✦ ☢️" })
            .setDescription(
                `\`\`\`\n  ⚠️ THAO TÁC: XÓA TOÀN BỘ DATABASE\n  🔴 MỨC ĐỘ: KHÔNG THỂ HOÀN TÁC\n\`\`\`` +
                `Bạn sắp **XÓA VĨNH VIỄN** toàn bộ dữ liệu:\n` +
                `> 👥 **${totalUsers}** tài khoản người chơi\n` +
                `> 💰 Toàn bộ tiền, ngân hàng, khoản vay\n` +
                `> 🃏 Toàn bộ thẻ bài, tầng tháp, danh hiệu, thống kê\n` +
                (richest ? `> 👑 Kể cả đại gia giàu nhất: <@${richest.userId}> (\`${money(richest.money)} VND\`)\n` : "") +
                `${"─".repeat(25)}\n` +
                `💀 **SAU KHI XÓA, KHÔNG CÓ CÁCH NÀO KHÔI PHỤC!**\n` +
                `*(Muốn an toàn: backup database trên MongoDB Atlas trước)*`
            )
            .setFooter({ text: "⏰ Nút xác nhận tự vô hiệu sau 30 giây" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("reset_confirm").setLabel(`XÓA SẠCH ${totalUsers} TÀI KHOẢN`).setEmoji("🔥").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("reset_cancel").setLabel("Hủy — giữ nguyên dữ liệu").setEmoji("↩️").setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });

        // Tự vô hiệu nút sau 30s để tránh bấm nhầm về sau
        setTimeout(async () => {
            try {
                await interaction.editReply({ components: [] });
            } catch (e) {}
        }, 30000);
    },

    // ===== BUTTON HANDLER =====
    async handleButton(interaction) {
        if (!interaction.customId.startsWith("reset_")) return;

        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({ content: "❌ Bạn không có quyền bấm nút này!", flags: 64 });
        }

        if (interaction.customId === "reset_cancel") {
            return interaction.update({
                embeds: [casinoEmbed({ color: COLORS.green, title: "↩️ ĐÃ HỦY RESET", description: "> ✅ Dữ liệu người chơi được giữ nguyên. Cả server thở phào! 😮‍💨" })],
                components: [],
            });
        }

        if (interaction.customId === "reset_confirm") {
            const result = await User.deleteMany({});
            console.log(`☢️ [reset] Admin ${interaction.user.tag} đã XÓA TOÀN BỘ database (${result.deletedCount} tài khoản)`);

            return interaction.update({
                embeds: [casinoEmbed({ color: COLORS.dark, title: "💥 DATABASE ĐÃ BỊ XÓA SẠCH" })
                    .setDescription(
                        `\`\`\`\n  ☢️💥☢️\n  (một vụ nổ dữ liệu vừa xảy ra)\n\`\`\`` +
                        `> 🗑️ Đã xóa: **${result.deletedCount}** tài khoản\n` +
                        `> 🌱 Hệ thống trở về trạng thái sơ khai — mọi người bắt đầu lại từ /daily!`
                    )
                    .setFooter({ text: `☢️ Thực hiện bởi: ${interaction.user.tag}` })],
                components: [],
            });
        }
    },
};