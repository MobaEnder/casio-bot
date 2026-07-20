const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed } = require("../utils/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vaytien")
        .setDescription("🏦 Lập hợp đồng vay vốn từ người chơi khác")
        .addUserOption((opt) => opt.setName("nguoi").setDescription("Chủ nợ tương lai").setRequired(true))
        .addIntegerOption((opt) => opt.setName("sotien").setDescription("Số tiền muốn vay").setRequired(true))
        .addStringOption((opt) =>
            opt.setName("thoihan").setDescription("Thời hạn trả (Ví dụ: 30m, 2h, 24h)").setRequired(true)
        ),

    async execute(interaction) {
        const borrower = interaction.user;
        const lender = interaction.options.getUser("nguoi");
        const amount = interaction.options.getInteger("sotien");
        const timeInput = interaction.options.getString("thoihan").toLowerCase();

        // --- XỬ LÝ THỜI GIAN (giữ nguyên) ---
        const match = timeInput.match(/^(\d+)(m|h)$/);
        if (!match) {
            return interaction.reply({
                content: "❌ Định dạng thời gian sai! Sử dụng `1m-60m` (phút) hoặc `1h-24h` (giờ). Ví dụ: `30m` hoặc `2h`.",
                flags: 64,
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
        } else {
            if (value < 1 || value > 24) return interaction.reply({ content: "❌ Thời hạn giờ phải từ `1h` đến `24h`.", flags: 64 });
            durationMs = value * 60 * 60 * 1000;
            displayTime = `${value} giờ`;
        }

        if (lender.id === borrower.id)
            return interaction.reply({ content: "❌ Bạn định lấy tiền túi trái bỏ vào túi phải à? Không vay chính mình nhé!", flags: 64 });
        if (lender.bot)
            return interaction.reply({ content: "🤖 Bot không có tiền cho vay đâu, tìm người thật đi!", flags: 64 });
        if (amount < 1000)
            return interaction.reply({ content: "❌ Số tiền quá nhỏ, không đáng để lập hợp đồng (Tối thiểu 1,000 VND).", flags: 64 });

        const borrowerData = await User.findOneAndUpdate({ userId: borrower.id }, {}, { upsert: true, new: true });

        if (borrowerData.loan && borrowerData.loan.active) {
            return interaction.reply({
                content: `❌ Bạn đang nợ <@${borrowerData.loan.from}> **${money(borrowerData.loan.amount)} VND** chưa quyết toán! Dùng \`/tratien\` trả hết rồi mới được vay tiếp.`,
                flags: 64,
            });
        }
        if (borrowerData.banned) {
            return interaction.reply({ content: "🚫 Bạn đang bị phong tỏa vì trốn nợ, không thể vay tiếp!", flags: 64 });
        }

        const lenderData = await User.findOneAndUpdate({ userId: lender.id }, {}, { upsert: true, new: true });

        if (lenderData.money < amount) {
            return interaction.reply({
                content: `❌ <@${lender.id}> không đủ tiền cho bạn vay đâu (Họ chỉ có ${vnd(lenderData.money)}).`,
                flags: 64,
            });
        }

        const dueAt = new Date(Date.now() + durationMs);
        const interest = Math.floor(amount * 0.1);
        const totalRepay = amount + interest;

        const embed = casinoEmbed({ color: COLORS.gold, title: "📝 ✦ HỢP ĐỒNG VAY VỐN ĐEN ✦ 📝" })
            .setThumbnail("https://www.pvcombank.com.vn/static/SEO/vay-von-dau-tu-1.jpg")
            .setDescription(
                `\`\`\`\n═══════ ĐIỀU KHOẢN ═══════\n\`\`\`` +
                `> 👤 **Bên vay (A):** ${borrower}\n` +
                `> 🏦 **Bên cho vay (B):** ${lender}\n${"─".repeat(25)}\n` +
                `> 💰 **Tiền gốc:** \`${money(amount)} VND\`\n` +
                `> 📈 **Lãi suất:** 10% → \`+${money(interest)} VND\`\n` +
                `> 💸 **Tổng phải trả:** **\`${money(totalRepay)} VND\`**\n` +
                `> ⏳ **Thời hạn:** ${displayTime} — đáo hạn ${countdown(dueAt.getTime())}\n\n` +
                `⚠️ **ĐIỀU KHOẢN PHẠT:** Quá hạn <t:${Math.floor(dueAt.getTime() / 1000)}:f>, hệ thống tự động quét ví/ngân hàng bên A để siết nợ. Nếu cháy túi → **BAN VĨNH VIỄN** khỏi casino.`
            )
            .setFooter({ text: "✍️ Chủ nợ bấm nút bên dưới để ký tên xác nhận" });

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
                .setEmoji("🚫")
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
            return interaction.update({
                content: null,
                embeds: [casinoEmbed({ color: COLORS.dark, title: "📉 HỢP ĐỒNG BỊ HỦY BỎ", description: `> 🚫 <@${lenderId}> đã từ chối cho vay.\n> *"Tiền bạc phân minh, ái tình sòng phẳng!"*` })],
                components: [],
            });
        }

        if (action === "accept") {
            const amt = Number(amount);
            if (!lender || lender.money < amt) return interaction.reply({ content: "❌ Tiền trong ví bạn vừa bốc hơi rồi, không đủ cho vay nữa!", flags: 64 });
            if (!borrower) return interaction.reply({ content: "❌ Không tìm thấy dữ liệu bên vay!", flags: 64 });
            if (borrower.loan && borrower.loan.active) return interaction.reply({ content: "❌ Bên vay vừa gánh một khoản nợ khác rồi!", flags: 64 });

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

            const totalRepay = amt + Math.floor(amt * 0.1);
            return interaction.update({
                content: null,
                embeds: [casinoEmbed({ color: COLORS.green, title: "✅ HỢP ĐỒNG ĐÃ KÝ — TIỀN ĐÃ GIẢI NGÂN" })
                    .setDescription(
                        `> 💸 <@${lenderId}> đã chuyển **${money(amt)} VND** cho <@${borrowerId}>\n${"─".repeat(25)}\n` +
                        `> ⏰ Đáo hạn: **${countdown(Number(dueAt))}** (<t:${Math.floor(Number(dueAt) / 1000)}:f>)\n` +
                        `> 💸 Tổng phải trả (gốc + lãi 10%): **\`${money(totalRepay)} VND\`**\n\n` +
                        `📌 Bên vay dùng lệnh \`/tratien\` để thanh toán trước khi quá hạn!`
                    )
                    .setFooter({ text: "🏦 Casino Bank — Uy tín tạo nên thương hiệu 😈" })],
                components: [],
            });
        }
    },
};