const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("🏆 Bảng xếp hạng 10 đại gia giàu nhất Casino"),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // 1. Lấy Top 10 người giàu nhất
            const topUsers = await User.find({ money: { $gt: 0 } }) // Chỉ lấy người có tiền > 0
                .sort({ money: -1 })
                .limit(10);

            // 2. Tìm thứ hạng của người gọi lệnh
            const allUsers = await User.find().sort({ money: -1 });
            const userRank = allUsers.findIndex(u => u.userId === interaction.user.id) + 1;
            const userMoney = allUsers.find(u => u.userId === interaction.user.id)?.money || 0;

            // 3. Xây dựng danh sách với huy hiệu
            const medals = ["🥇", "🥈", "🥉", "🏅", "🏅", "🏅", "🏅", "🏅", "🏅", "🏅"];
            
            const desc = topUsers.length > 0 
                ? topUsers.map((u, i) => {
                    const medal = medals[i] || `**#${i + 1}**`;
                    return `${medal} <@${u.userId}> — 💰 \`${u.money.toLocaleString("vi-VN")} VND\``;
                }).join("\n")
                : "Chưa có đại gia nào xuất hiện 😢";

            const embed = new EmbedBuilder()
                .setColor("Gold")
                .setTitle("🏆 BẢNG XẾP HẠNG ĐẠI GIA")
                .setThumbnail("https://cdn-icons-png.flaticon.com/512/10384/10384161.png")
                .setDescription(desc)
                .addFields({ 
                    name: "✨ Thứ hạng của bạn", 
                    value: `Bạn đang đứng thứ **#${userRank}** với \`${userMoney.toLocaleString("vi-VN")} VND\`` 
                })
                .setFooter({ text: "Bảng xếp hạng cập nhật thời gian thực" })
                .setTimestamp();

            const msg = await interaction.editReply({
                embeds: [embed],
            });

            // Tự xoá sau 30s để tránh trôi kênh
            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 30000);

        } catch (err) {
            console.error("❌ /top error:", err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply("❌ Có lỗi xảy ra khi lấy danh sách đại gia!");
            }
        }
    },
};