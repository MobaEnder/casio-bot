const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tratien")
        .setDescription("💸 Thanh toán khoản vay và lãi suất để giải trừ phong tỏa"),

    async execute(interaction) {
        const borrowerId = interaction.user.id;
        const borrower = await User.findOne({ userId: borrowerId });

        // 1. Kiểm tra xem có nợ không
        if (!borrower || !borrower.loan.active) {
            return interaction.reply({
                content: "❌ Bạn có nợ nần gì ai đâu? Cứ ăn ngon ngủ kỹ đi nhé!",
                flags: 64,
            });
        }

        const lenderId = borrower.loan.from;
        const baseAmount = borrower.loan.amount;
        
        // 2. Tính lãi suất (Ví dụ 10% phí dịch vụ)
        const interest = Math.floor(baseAmount * 0.1); 
        const totalAmount = baseAmount + interest;

        // 3. Kiểm tra số dư tài khoản
        if (borrower.money < totalAmount) {
            return interaction.reply({
                content: `❌ Không đủ tiền trả nợ! Bạn cần tổng cộng **${totalAmount.toLocaleString()} VND** (bao gồm gốc ${baseAmount.toLocaleString()} + lãi ${interest.toLocaleString()}).`,
                flags: 64,
            });
        }

        // 4. Cập nhật tiền cho người cho vay (Chủ nợ)
        const lender = await User.findOneAndUpdate(
            { userId: lenderId },
            { $inc: { money: totalAmount } },
            { upsert: true, new: true }
        );

        // 5. Cập nhật dữ liệu người vay
        borrower.money -= totalAmount;
        borrower.loan = {
            active: false,
            from: null,
            amount: 0,
            dueAt: null,
        };
        borrower.banned = false; // Mở khóa nếu lỡ bị ban do quá hạn (tùy chính sách của bạn)

        await borrower.save();

        // 6. Giao diện Embed đẹp mắt
        const embed = new EmbedBuilder()
            .setColor(0x00ff99)
            .setTitle("📜 QUYẾT TOÁN HỢP ĐỒNG")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Chúc mừng <@${borrowerId}> đã thanh toán nợ nần thành công!`)
            .addFields(
                { name: "💰 Tiền gốc", value: `\`${baseAmount.toLocaleString()} VND\``, inline: true },
                { name: "📈 Lãi (10%)", value: `\`${interest.toLocaleString()} VND\``, inline: true },
                { name: "🏦 Tổng thanh toán", value: `\`${totalAmount.toLocaleString()} VND\`` },
                { name: "👤 Chủ nợ", value: `<@${lenderId}>`, inline: true }
            )
            .setFooter({ text: "Hẹn gặp lại bạn ở những phi vụ vay sau! 💎" })
            .setTimestamp();

        // 7. Thông báo cho chủ nợ qua DM (nếu muốn)
        try {
            const discordLender = await interaction.client.users.fetch(lenderId);
            if (discordLender) {
                await discordLender.send(`💰 <@${borrowerId}> đã hoàn trả nợ cho bạn số tiền **${totalAmount.toLocaleString()} VND** (đã bao gồm lãi).`);
            }
        } catch (err) {
            console.log("Không thể gửi DM cho chủ nợ.");
        }

        await interaction.reply({ embeds: [embed] });
    },
};