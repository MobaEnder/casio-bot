const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed } = require("../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bank")
        .setDescription("🏦 Chuyển tiền (bắn Bank) cho người khác")
        .addUserOption((opt) => opt.setName("user").setDescription("Người nhận").setRequired(true))
        .addIntegerOption((opt) => opt.setName("amount").setDescription("Số tiền muốn chuyển").setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const senderId = interaction.user.id;

        // 1. Kiểm tra cơ bản (giữ nguyên)
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

        // 2. Chặn tẩu tán tài sản khi đang nợ (giữ nguyên)
        if (sender.loan && sender.loan.active) {
            return interaction.reply({
                content: "⚠️ Bạn đang có khoản nợ chưa trả! Hãy dùng `/tratien` để thanh toán trước khi định chuyển tiền cho người khác.",
                flags: 64,
            });
        }

        // 3. Phí giao dịch 5% (giữ nguyên)
        const taxRate = 0.05;
        const tax = Math.floor(amount * taxRate);
        const totalDeduction = amount + tax;

        if (sender.money < totalDeduction) {
            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.red, title: "❌ GIAO DỊCH BỊ TỪ CHỐI — KHÔNG ĐỦ SỐ DƯ" })
                    .setDescription(
                        `> 💸 Muốn chuyển: \`${money(amount)}\`\n` +
                        `> 🧾 Phí 5%: \`+${money(tax)}\`\n` +
                        `> 💰 Tổng cần: **\`${money(totalDeduction)} VND\`**\n` +
                        `> 💼 Ví bạn chỉ có: ${vnd(sender.money)} *(thiếu ${money(totalDeduction - sender.money)})*`
                    )],
                flags: 64,
            });
        }

        let receiver = await User.findOne({ userId: target.id });
        if (!receiver) receiver = await User.create({ userId: target.id });

        // 4. Thực hiện giao dịch (giữ nguyên)
        sender.money -= totalDeduction;
        receiver.money += amount;
        await sender.save();
        await receiver.save();

        // Mã giao dịch cho giống app ngân hàng thật
        const txId = `CSN${Date.now().toString().slice(-8)}`;
        const now = new Date();
        const timeStr = `<t:${Math.floor(now.getTime() / 1000)}:f>`;

        const embed = casinoEmbed({ color: COLORS.green, title: "✅ CHUYỂN KHOẢN THÀNH CÔNG" })
            .setThumbnail("https://cdn-icons-png.flaticon.com/512/2489/2489756.png")
            .setDescription(
                `\`\`\`\n╔══════ CASINO BANK ══════╗\n║  BIÊN LAI GIAO DỊCH      ║\n║  Mã GD: ${txId}      ║\n╚══════════════════════════╝\n\`\`\`` +
                `> 👤 **Từ:** <@${senderId}>\n` +
                `> 👥 **Đến:** <@${target.id}>\n` +
                `> 🕐 **Thời gian:** ${timeStr}\n${"─".repeat(25)}\n` +
                `# 💸 ${money(amount)} VND`
            )
            .addFields(
                { name: "🧾 Phí GD (5%)", value: `\`-${money(tax)}\``, inline: true },
                { name: "💳 Tổng trừ ví", value: `\`-${money(totalDeduction)}\``, inline: true },
                { name: "💼 Số dư còn", value: vnd(sender.money), inline: true }
            )
            .setFooter({ text: "Cảm ơn bạn đã sử dụng dịch vụ Casino Bank! 💖" });

        await interaction.reply({
            content: `💌 <@${target.id}> ơi, bạn vừa nhận được lúa từ <@${senderId}> kìa!`,
            embeds: [embed],
        });

        // 5. Báo người nhận qua DM cho giống biến động số dư thật
        try {
            await target.send(
                `🔔 **BIẾN ĐỘNG SỐ DƯ — CASINO BANK**\n` +
                `💰 Tài khoản vừa nhận **+${money(amount)} VND** từ **${interaction.user.username}**\n` +
                `💼 Số dư hiện tại: **${money(receiver.money)} VND** (Mã GD: ${txId})`
            );
        } catch (e) {
            // Người nhận khóa DM thì thôi, không sao
        }
    },
};