const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bank")
        .setDescription("🏦 Chuyển tiền (bắn Bank) cho người khác")
        .addUserOption(opt =>
            opt.setName("user").setDescription("Người nhận").setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName("amount").setDescription("Số tiền muốn chuyển").setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const senderId = interaction.user.id;

        // 1. Kiểm tra cơ bản
        if (amount <= 0) {
            return interaction.reply({ content: "❌ Số tiền phải lớn hơn 0 nhé đại gia!", flags: 64 });
        }

        if (target.id === senderId) {
            return interaction.reply({ content: "❌ Tự bắn tiền cho mình thì ví vẫn thế thôi, đừng làm vậy!", flags: 64 });
        }

        if (target.bot) {
            return interaction.reply({ content: "❌ Bot không dùng tiền đâu, đừng chuyển cho tụi mình làm gì!", flags: 64 });
        }

        let sender = await User.findOne({ userId: senderId });
        if (!sender) sender = await User.create({ userId: senderId });

        // 2. Chặn chuyển tiền nếu đang nợ (Tùy chọn - để tránh tẩu tán tài sản)
        if (sender.loan && sender.loan.active) {
            return interaction.reply({ 
                content: "⚠️ Bạn đang có khoản nợ chưa trả! Hãy dùng `/tratien` để thanh toán trước khi định chuyển tiền cho người khác.", 
                flags: 64 
            });
        }

        // 3. Tính phí giao dịch (Ví dụ: 5%)
        const taxRate = 0.05; 
        const tax = Math.floor(amount * taxRate);
        const totalDeduction = amount + tax;

        if (sender.money < totalDeduction) {
            return interaction.reply({
                content: `❌ Bạn không đủ tiền! Để chuyển **${amount.toLocaleString()}**, bạn cần thêm **${tax.toLocaleString()}** (5% phí giao dịch). Tổng cộng: **${totalDeduction.toLocaleString()} VND**.`,
                flags: 64,
            });
        }

        let receiver = await User.findOne({ userId: target.id });
        if (!receiver) receiver = await User.create({ userId: target.id });

        // 4. Thực hiện giao dịch
        sender.money -= totalDeduction;
        receiver.money += amount;

        await sender.save();
        await receiver.save();

        const embed = new EmbedBuilder()
            .setColor(0x00ff99)
            .setTitle("💸 GIAO DỊCH CHUYỂN KHOẢN")
            .setThumbnail("https://cdn-icons-png.flaticon.com/512/2489/2489756.png")
            .addFields(
                { name: "👤 Người gửi", value: `<@${senderId}>`, inline: true },
                { name: "👤 Người nhận", value: `<@${target.id}>`, inline: true },
                { name: "💰 Số tiền chuyển", value: `\`${amount.toLocaleString()} VND\`` },
                { name: "🧾 Phí giao dịch (5%)", value: `\`${tax.toLocaleString()} VND\``, inline: true },
                { name: "🏦 Số dư còn lại", value: `\`${sender.money.toLocaleString()} VND\``, inline: true }
            )
            .setFooter({ text: "Cảm ơn bạn đã sử dụng dịch vụ của Casino Bank! 💖" })
            .setTimestamp();

        await interaction.reply({
            content: `✅ <@${target.id}> ơi, bạn vừa nhận được lúa từ <@${senderId}> kìa!`,
            embeds: [embed],
        });
    },
};