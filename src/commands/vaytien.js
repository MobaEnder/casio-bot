const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vaytien")
        .setDescription("🏦 Lập hợp đồng vay vốn từ người chơi khác")
        .addUserOption(opt =>
            opt.setName("nguoi").setDescription("Chủ nợ tương lai").setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName("sotien").setDescription("Số tiền muốn vay").setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("thoihan")
                .setDescription("Thời hạn trả (Ví dụ: 30m, 2h, 24h)")
                .setRequired(true)
        ),

    async execute(interaction) {
        const borrower = interaction.user;
        const lender = interaction.options.getUser("nguoi");
        const amount = interaction.options.getInteger("sotien");
        const timeInput = interaction.options.getString("thoihan").toLowerCase();

        // --- LOGIC XỬ LÝ THỜI GIAN ---
        const timeRegex = /^(\d+)(m|h)$/;
        const match = timeInput.match(timeRegex);

        if (!match) {
            return interaction.reply({ 
                content: "❌ Định dạng thời gian sai! Sử dụng `1m-60m` (phút) hoặc `1h-24h` (giờ). Ví dụ: `30m` hoặc `2h`.", 
                flags: 64 
            });
        }

        const value = parseInt(match[1]);
        const unit = match[2];
        let durationMs = 0;
        let displayTime = "";

        if (unit === "m") {
            if (value < 1 || value > 60) return interaction.reply({ content: "❌ Thời hạn phút phải từ `1m` đến `60m`.", flags: 64 });
            durationMs = value * 60 * 1000;
            displayTime = `${value} phút`;
        } else if (unit === "h") {
            if (value < 1 || value > 24) return interaction.reply({ content: "❌ Thời hạn giờ phải từ `1h` đến `24h`.", flags: 64 });
            durationMs = value * 60 * 60 * 1000;
            displayTime = `${value} giờ`;
        }
        // -----------------------------

        if (lender.id === borrower.id)
            return interaction.reply({ content: "❌ Bạn định lấy tiền túi trái bỏ vào túi phải à? Không vay chính mình nhé!", flags: 64 });

        if (amount < 1000)
            return interaction.reply({ content: "❌ Số tiền quá nhỏ, không đáng để lập hợp đồng (Tối thiểu 1,000 VND).", flags: 64 });

        const borrowerData = await User.findOneAndUpdate(
            { userId: borrower.id },
            {},
            { upsert: true, new: true }
        );

        if (borrowerData.loan && borrowerData.loan.active) {
            return interaction.reply({
                content: "❌ Bạn đang có một khoản nợ chưa quyết toán! Trả hết rồi mới được vay tiếp.",
                flags: 64,
            });
        }

        const lenderData = await User.findOneAndUpdate(
            { userId: lender.id },
            {},
            { upsert: true, new: true }
        );

        if (lenderData.money < amount) {
            return interaction.reply({
                content: `❌ <@${lender.id}> không đủ tiền cho bạn vay đâu (Họ chỉ có ${lenderData.money.toLocaleString()} VND).`,
                flags: 64,
            });
        }

        const dueAt = new Date(Date.now() + durationMs);

        const embed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("📝 HỢP ĐỒNG VAY VỐN ĐEN")
            .setThumbnail("https://www.pvcombank.com.vn/static/SEO/vay-von-dau-tu-1.jpg")
            .setDescription(
                `👤 **Bên vay:** ${borrower}\n` +
                `🏦 **Bên cho vay:** ${lender}\n` +
                `💰 **Số tiền vay:** \`${amount.toLocaleString()} VND\`\n` +
                `⏳ **Thời hạn trả:** \`${displayTime}\`\n\n` +
                `⚠️ **ĐIỀU KHOẢN:**\n` +
                `*Nếu không trả trước <t:${Math.floor(dueAt.getTime() / 1000)}:f>, hệ thống sẽ tự động quét ngân hàng/ví để trừ nợ. Nếu cháy túi, bạn sẽ bị **BAN VĨNH VIỄN**.*`
            )
            .setFooter({ text: "Nhấn nút dưới đây để ký tên xác nhận" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`vaytien_accept_${borrower.id}_${lender.id}_${amount}_${dueAt.getTime()}`)
                .setLabel("Ký Hợp Đồng")
                .setStyle(ButtonStyle.Success)
                .setEmoji("✍️"),
            new ButtonBuilder()
                .setCustomId(`vaytien_decline_${borrower.id}_${lender.id}`)
                .setLabel("Từ Chối")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `📣 <@${lender.id}>! Có một lời đề nghị vay tiền từ <@${borrower.id}>.`,
            embeds: [embed],
            components: [row],
        });
    },

    async handleButton(interaction) {
        const [cmd, action, borrowerId, lenderId, amount, dueAt] = interaction.customId.split("_");
        if (cmd !== "vaytien") return;

        if (interaction.user.id !== lenderId) {
            return interaction.reply({ content: "❌ Bạn không phải chủ nợ, đừng ký thay!", flags: 64 });
        }

        const borrower = await User.findOne({ userId: borrowerId });
        const lender = await User.findOne({ userId: lenderId });

        if (action === "decline") {
            return interaction.update({ content: "📉 **Hợp đồng đã bị hủy bỏ.** Người cho vay đã từ chối.", embeds: [], components: [] });
        }

        if (action === "accept") {
            const amt = Number(amount);
            if (!lender || lender.money < amt) return interaction.reply({ content: "❌ Tiền trong ví bạn vừa bốc hơi rồi, không đủ cho vay nữa!", flags: 64 });

            lender.money -= amt;
            await lender.save();

            borrower.money += amt;
            borrower.loan = {
                active: true,
                from: lenderId,
                amount: amt,
                dueAt: new Date(Number(dueAt)),
            };
            await borrower.save();

            const successEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ GIAO DỊCH HOÀN TẤT")
                .setDescription(
                    `💸 <@${lenderId}> đã chuyển **${amt.toLocaleString()} VND** cho <@${borrowerId}>.\n\n` +
                    `⏰ Hạn cuối thanh toán: <t:${Math.floor(Number(dueAt) / 1000)}:R>\n` +
                    `📌 Hãy dùng lệnh \`/trano\` để thanh toán trước khi quá hạn!`
                )
                .setTimestamp();

            return interaction.update({ content: null, embeds: [successEmbed], components: [] });
        }
    }
};