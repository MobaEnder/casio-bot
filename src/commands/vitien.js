const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, countdown, casinoEmbed } = require("../utils/ui");

// Đẳng cấp theo tổng tài sản (đồng bộ với /hoso)
function wealthTier(total) {
    if (total >= 1_000_000_000) return { icon: "👑", name: "Huyền Thoại Sòng Bài" };
    if (total >= 500_000_000) return { icon: "💎", name: "Đại Gia Kim Cương" };
    if (total >= 100_000_000) return { icon: "🏆", name: "Trùm Bạch Kim" };
    if (total >= 20_000_000) return { icon: "🥇", name: "Tay Chơi Vàng" };
    if (total >= 5_000_000) return { icon: "🥈", name: "Dân Chơi Bạc" };
    if (total >= 1_000_000) return { icon: "🥉", name: "Tập Sự Đồng" };
    return { icon: "🌱", name: "Tân Thủ Chân Ướt" };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vitien")
        .setDescription("💰 Xem số tiền hiện tại của bạn"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });

        if (!user) {
            user = await User.create({ userId: interaction.user.id, money: 1000 });
        }
        if (typeof user.money !== "number") {
            user.money = 1000;
            await user.save();
        }

        // Tính lãi bank tạm tính (0.8%/h — đồng bộ /nganhang)
        let interest = 0;
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / 3600000;
            if (hours >= 1) interest = Math.floor(user.bankMoney * (Math.pow(1.008, Math.floor(hours)) - 1));
        }
        const totalBank = (user.bankMoney || 0) + interest;
        const netWorth = user.money + totalBank;
        const tier = wealthTier(netWorth);

        // Gợi ý thông minh theo tình trạng ví
        let tip;
        if (user.money < 10000) tip = "🥲 *Cháy túi rồi... đi /work hoặc /daily gấp!*";
        else if (user.money > 5000000 && totalBank === 0) tip = "💡 *Tiền mặt nhiều thế, gửi /nganhang lấy lãi 0.8%/h đi!*";
        else tip = "😎 *Ví ổn áp đấy, làm ván /taixiu không?*";

        const deleteAt = Date.now() + 20000;
        const embed = casinoEmbed({ color: COLORS.green, title: `${tier.icon} VÍ TIỀN CỦA BẠN` })
            .setDescription(
                `> ${tier.icon} Đẳng cấp: **${tier.name}**\n\n` +
                `💵 Tiền mặt: **\`${money(user.money)} VND\`**\n` +
                `🏦 Ngân hàng: \`${money(totalBank)}\`${interest > 0 ? ` *(+${money(interest)} lãi)*` : ""}\n` +
                `💎 Tổng tài sản: **\`${money(netWorth)} VND\`**\n\n` +
                tip
            )
            .setFooter({ text: `BOT 💖 Tin nhắn tự xóa` });

        await interaction.reply({
            content: `🗑️ *Tự xóa ${countdown(deleteAt)}*`,
            embeds: [embed],
            flags: 64,
        });

        setTimeout(() => interaction.deleteReply().catch(() => {}), 20000);
    },
};