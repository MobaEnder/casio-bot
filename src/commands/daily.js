const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, sleep } = require("../utils/ui");

const COOLDOWN = 24 * 60 * 60 * 1000;

// Phân hạng nhân phẩm theo mức thưởng (50k → 200k)
function luckTier(reward) {
    if (reward >= 180000) return { icon: "👑", label: "NHÂN PHẨM BÙNG NỔ", color: COLORS.gold, flavor: "Hôm nay ra đường nhớ mua thêm tờ vé số!" };
    if (reward >= 140000) return { icon: "🔥", label: "SỐ ĐỎ RỰC RỠ", color: COLORS.red, flavor: "Vía này mà đi /taixiu là hốt đậm!" };
    if (reward >= 100000) return { icon: "✨", label: "MAY MẮN ỔN ÁP", color: COLORS.green, flavor: "Đủ ăn phở full topping cả tuần!" };
    if (reward >= 70000) return { icon: "🌤️", label: "BÌNH THƯỜNG", color: COLORS.blue, flavor: "Không giàu nhưng đủ sống qua ngày..." };
    return { icon: "🥲", label: "NHÂN PHẨM CẠN KIỆT", color: COLORS.dark, flavor: "Thôi thì có còn hơn không..." };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("🎁 Nhận tiền thưởng mỗi ngày"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const now = new Date();

        let user = await User.findOne({ userId });
        if (!user) user = await User.create({ userId });

        // 🛡️ Fix lỗi date object cũ (giữ nguyên)
        if (user.lastDaily && !(user.lastDaily instanceof Date)) {
            user.lastDaily = new Date(user.lastDaily);
        }

        // ⏳ CHƯA HỒI CHIÊU — đếm ngược trực tiếp
        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const readyAt = user.lastDaily.getTime() + COOLDOWN;
            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.red, title: "⏳ QUÀ HÔM NAY ĐÃ NHẬN RỒI!" })
                    .setDescription(
                        `> 🎁 Hộp quà tiếp theo mở khóa **${countdown(readyAt)}**\n` +
                        `> 🕐 Chính xác lúc: ${countdown(readyAt, "T")}\n\n` +
                        `💡 *Trong lúc chờ, đi /work kiếm thêm nhé!*`
                    )
                    .setFooter({ text: "BOT • Daily Reward" })],
                flags: 64,
            });
        }

        // 🎰 VÒNG QUAY NHÂN PHẨM
        const reward = Math.floor(Math.random() * 150001) + 50000; // 50k → 200k (giữ nguyên)
        const tier = luckTier(reward);

        user.money += reward;
        user.lastDaily = now;
        await user.save();

        // 🎬 Hiệu ứng mở quà
        await interaction.reply({
            embeds: [casinoEmbed({ color: COLORS.purple, title: "🎁 ĐANG MỞ HỘP QUÀ..." })
                .setDescription("# 🎁\n> *Lắc lắc... nghe có tiếng xột xoạt bên trong...*")],
        });
        await sleep(1500);

        const nextAt = now.getTime() + COOLDOWN;
        const embed = casinoEmbed({ color: tier.color, title: `${tier.icon} ${tier.label}! ${tier.icon}` })
            .setThumbnail("https://cdn-icons-png.flaticon.com/512/10384/10384161.png")
            .setDescription(
                `# 💸 +${money(reward)} VND\n` +
                `> *${tier.flavor}*\n\n` +
                `💼 Số dư mới: ${vnd(user.money)}\n` +
                `🔄 Quà tiếp theo: ${countdown(nextAt)}`
            )
            .setFooter({ text: "BOT • Daily System • Tin nhắn tự xóa sau 30 giây" });

        await interaction.editReply({ embeds: [embed] });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
    },
};