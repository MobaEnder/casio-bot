const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed } = require("../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tratien")
        .setDescription("💸 Thanh toán khoản vay và lãi suất để giải trừ phong tỏa"),

    async execute(interaction) {
        const borrowerId = interaction.user.id;
        const borrower = await User.findOne({ userId: borrowerId });

        // 🐛 FIX: dùng optional chaining — bản cũ crash nếu user chưa từng vay (loan = undefined)
        if (!borrower || !borrower.loan?.active) {
            return interaction.reply({
                content: "✨ Bạn có nợ nần gì ai đâu? Cứ ăn ngon ngủ kỹ đi nhé!",
                flags: 64,
            });
        }

        const lenderId = borrower.loan.from;
        const baseAmount = borrower.loan.amount;
        const interest = Math.floor(baseAmount * 0.1); // 10% (giữ nguyên)
        const totalAmount = baseAmount + interest;

        if (borrower.money < totalAmount) {
            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.red, title: "❌ KHÔNG ĐỦ TIỀN TRẢ NỢ!" })
                    .setDescription(
                        `> 💸 Cần thanh toán: **\`${money(totalAmount)} VND\`**\n` +
                        `> *(gốc ${money(baseAmount)} + lãi 10% = ${money(interest)})*\n` +
                        `> 💼 Ví bạn chỉ còn: ${vnd(borrower.money)}\n` +
                        `> 🕳️ Còn thiếu: **\`${money(totalAmount - borrower.money)} VND\`**\n\n` +
                        `💡 *Mẹo: rút tiền từ /nganhang hoặc cày /work gấp trước khi quá hạn!*`
                    )],
                flags: 64,
            });
        }

        // Chuyển tiền cho chủ nợ (giữ nguyên)
        await User.findOneAndUpdate(
            { userId: lenderId },
            { $inc: { money: totalAmount } },
            { upsert: true, new: true }
        );

        borrower.money -= totalAmount;
        borrower.loan = { active: false, from: null, amount: 0, dueAt: null };
        borrower.banned = false;
        await borrower.save();

        const embed = casinoEmbed({ color: COLORS.green, title: "📜 ✦ QUYẾT TOÁN HỢP ĐỒNG THÀNH CÔNG ✦ 📜" })
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `\`\`\`\n  🧾 BIÊN LAI THANH TOÁN\n  ✅ TRẠNG THÁI: SẠCH NỢ\n\`\`\`` +
                `🎉 Chúc mừng <@${borrowerId}> đã thoát kiếp con nợ!`
            )
            .addFields(
                { name: "💰 Tiền gốc", value: `\`${money(baseAmount)}\``, inline: true },
                { name: "📈 Lãi (10%)", value: `\`+${money(interest)}\``, inline: true },
                { name: "💸 Tổng đã trả", value: `**\`${money(totalAmount)}\`**`, inline: true },
                { name: "👤 Chủ nợ", value: `<@${lenderId}>`, inline: true },
                { name: "💼 Ví còn lại", value: vnd(borrower.money), inline: true },
                { name: "🕊️ Uy tín", value: "Đã khôi phục", inline: true }
            )
            .setFooter({ text: "Hẹn gặp lại bạn ở những phi vụ vay sau! 💎" });

        // Báo chủ nợ qua DM (giữ nguyên)
        try {
            const discordLender = await interaction.client.users.fetch(lenderId);
            if (discordLender) {
                await discordLender.send(`💰 <@${borrowerId}> đã hoàn trả nợ cho bạn số tiền **${money(totalAmount)} VND** (đã bao gồm lãi 10%). Kiểm tra ví ngay!`);
            }
        } catch (err) {
            console.log("Không thể gửi DM cho chủ nợ.");
        }

        await interaction.reply({ embeds: [embed] });
    },
};