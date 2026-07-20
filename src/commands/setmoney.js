const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, delta, casinoEmbed } = require("../utils/ui");

// Lấy danh sách ID admin từ file .env
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setmoney")
        .setDescription("💰 CHỈNH TIỀN NGƯỜI DÙNG (Chỉ Admin)")
        .addUserOption((option) =>
            option.setName("user").setDescription("Người cần chỉnh tiền").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("amount").setDescription("Số tiền muốn set (VND)").setRequired(true)
        ),

    async execute(interaction) {
        // 1. Kiểm tra quyền Admin (giữ nguyên)
        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({ content: "⛔ Bạn không có quyền sử dụng lệnh này!", flags: 64 });
        }

        const target = interaction.options.getUser("user");
        const amountStr = interaction.options.getString("amount").replace(/[.,\s]/g, "");
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount < 0) {
            return interaction.reply({ content: "❌ Số tiền không hợp lệ (Phải là số dương)!", flags: 64 });
        }

        try {
            let user = await User.findOne({ userId: target.id });
            if (!user) user = await User.create({ userId: target.id });

            const oldMoney = user.money || 0;
            user.money = amount;
            await user.save();

            const diff = amount - oldMoney;

            const embed = casinoEmbed({ color: COLORS.gold, title: "🛠️ ✦ BẢNG ĐIỀU KHIỂN ADMIN — SET TIỀN ✦" })
                .setThumbnail(target.displayAvatarURL())
                .setDescription(
                    `\`\`\`\n  ⚙️ THAO TÁC: ĐIỀU CHỈNH SỐ DƯ\n  ✅ TRẠNG THÁI: THÀNH CÔNG\n\`\`\`` +
                    `> 👤 **Đối tượng:** <@${target.id}>\n${"─".repeat(25)}\n` +
                    `> 📤 Số dư cũ: \`${money(oldMoney)} VND\`\n` +
                    `> 📥 Số dư mới: **\`${money(amount)} VND\`**\n` +
                    `> 📊 Chênh lệch: **\`${delta(diff)} VND\`** ${diff >= 0 ? "📈" : "📉"}`
                )
                .setFooter({ text: `⚙️ Thực hiện bởi Admin: ${interaction.user.tag}` });

            // Ghi log ra console để tra soát sau này
            console.log(`🛠️ [setmoney] Admin ${interaction.user.tag} set tiền ${target.tag}: ${oldMoney} → ${amount}`);

            await interaction.reply({ embeds: [embed], flags: 64 });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Đã có lỗi xảy ra khi cập nhật Database!", flags: 64 });
        }
    },
};