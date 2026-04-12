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
        .addIntegerOption(opt =>
            opt.setName("thoihan")
                .setDescription("Thời hạn trả (1 - 24 giờ)")
                .setMinValue(1)
                .setMaxValue(24)
                .setRequired(true)
        ),

    async execute(interaction) {
        const borrower = interaction.user;
        const lender = interaction.options.getUser("nguoi");
        const amount = interaction.options.getInteger("sotien");
        const hours = interaction.options.getInteger("thoihan");

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

        const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000);

        const embed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("📝 HỢP ĐỒNG VAY VỐN ĐEN")
            .setThumbnail("https://www.pvcombank.com.vn/static/SEO/vay-von-dau-tu-1.jpg")
            .setDescription(
                `👤 **Bên vay:** ${borrower}\n` +
                `🏦 **Bên cho vay:** ${lender}\n` +
                `💰 **Số tiền vay:** \`${amount.toLocaleString()} VND\`\n` +
                `⏳ **Thời hạn trả:** \`${hours} giờ\`\n\n` +
                `⚠️ **ĐIỀU KHOẢN:**\n` +
                `*Nếu không trả trước <t:${Math.floor(dueAt.getTime() / 1000)}:f>, bên vay sẽ bị **CẤM VĨNH VIỄN** khỏi Casino và tất cả tài sản sẽ bị phong tỏa.*`
            )
            .setFooter({ text: "Nhấn nút dưới đây để ký tên xác nhận" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`vaytien:accept:${borrower.id}:${lender.id}:${amount}:${dueAt.getTime()}`)
                .setLabel("Ký Hợp Đồng")
                .setStyle(ButtonStyle.Success)
                .setEmoji("✍️"),
            new ButtonBuilder()
                .setCustomId(`vaytien:decline:${borrower.id}:${lender.id}`)
                .setLabel("Từ Chối")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `📣 <@${lender.id}>! Có một lời đề nghị vay tiền từ <@${borrower.id}>.`,
            embeds: [embed],
            components: [row],
        });
    },

    // Xử lý nút bấm (Giữ nguyên cấu trúc của bạn nhưng sửa lại UI)
    async handleButton(interaction) {
        const [cmd, action, borrowerId, lenderId, amount, dueAt] = interaction.customId.split(":");
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
            if (lender.money < amt) return interaction.reply({ content: "❌ Tiền trong ví bạn vừa bốc hơi rồi, không đủ cho vay nữa!", flags: 64 });

            // Trừ tiền người cho vay
            lender.money -= amt;
            await lender.save();

            // Cộng tiền người vay + khởi tạo nợ
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