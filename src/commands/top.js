const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, casinoEmbed, countdown } = require("../utils/ui");

const TIER_ICONS = [
    { min: 1_000_000_000, icon: "👑" },
    { min: 500_000_000, icon: "💎" },
    { min: 100_000_000, icon: "🏆" },
    { min: 20_000_000, icon: "🥇" },
    { min: 5_000_000, icon: "🥈" },
    { min: 1_000_000, icon: "🥉" },
    { min: 0, icon: "🌱" },
];
const tierIcon = (m) => TIER_ICONS.find((t) => m >= t.min).icon;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("🏆 Bảng xếp hạng 10 đại gia giàu nhất Casino"),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const topUsers = await User.find({ money: { $gt: 0 } }).sort({ money: -1 }).limit(10);
            const allUsers = await User.find().sort({ money: -1 });
            const userRank = allUsers.findIndex((u) => u.userId === interaction.user.id) + 1;
            const userMoney = allUsers.find((u) => u.userId === interaction.user.id)?.money || 0;
            const totalWealth = allUsers.reduce((s, u) => s + (u.money > 0 ? u.money : 0), 0);

            let desc;
            if (topUsers.length === 0) {
                desc = "> *Chưa có đại gia nào xuất hiện...* 😢";
            } else {
                // 🏆 BỤC VINH DANH TOP 3
                const podium = [];
                if (topUsers[0]) podium.push(`# 🥇 <@${topUsers[0].userId}>\n> 💰 \`${money(topUsers[0].money)} VND\` ${tierIcon(topUsers[0].money)}`);
                if (topUsers[1]) podium.push(`## 🥈 <@${topUsers[1].userId}>\n> 💰 \`${money(topUsers[1].money)} VND\` ${tierIcon(topUsers[1].money)}`);
                if (topUsers[2]) podium.push(`### 🥉 <@${topUsers[2].userId}>\n> 💰 \`${money(topUsers[2].money)} VND\` ${tierIcon(topUsers[2].money)}`);

                // Hạng 4-10
                const rest = topUsers.slice(3).map((u, i) =>
                    `\`#${String(i + 4).padStart(2)}\` ${tierIcon(u.money)} <@${u.userId}> — \`${money(u.money)}\``
                );

                desc = podium.join("\n") + (rest.length ? `\n${"─".repeat(25)}\n${rest.join("\n")}` : "");
            }

            const deleteAt = Date.now() + 60000;
            const embed = casinoEmbed({ color: COLORS.gold, title: "🏆 ✦ BẢNG VÀNG ĐẠI GIA CASINO ✦ 🏆" })
                .setThumbnail("https://cdn-icons-png.flaticon.com/512/10384/10384161.png")
                .setDescription(desc)
                .addFields(
                    {
                        name: "✨ Vị trí của bạn",
                        value: userRank > 0
                            ? `Hạng **#${userRank}**/${allUsers.length} — \`${money(userMoney)} VND\` ${tierIcon(userMoney)}${userRank <= 10 ? " 🔥 *Bạn đang trên bảng vàng!*" : ""}`
                            : "*Bạn chưa có tài khoản — gõ /daily để bắt đầu!*",
                        inline: true,
                    },
                    {
                        name: "🌍 Tổng tài sản server",
                        value: `💰 \`${money(totalWealth)} VND\``,
                        inline: true,
                    }
                )
                .setFooter({ text: "💡 Cày /work, /daily hoặc all-in /taixiu để leo hạng!" });

            const msg = await interaction.editReply({
                content: `🗑️ *Bảng xếp hạng tự xóa ${countdown(deleteAt)}*`,
                embeds: [embed],
            });

            // Tự xoá sau 60s để tránh trôi kênh
            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 60000);
        } catch (err) {
            console.error("❌ /top error:", err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply("❌ Có lỗi xảy ra khi lấy danh sách đại gia!");
            }
        }
    },
};