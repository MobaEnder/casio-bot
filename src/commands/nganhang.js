const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed } = require("../utils/ui");

const RATE = 0.008; // 0.8%/giờ (giữ nguyên)

// Tính lãi kép tích lũy (giữ nguyên công thức)
function calcInterest(user) {
    if (user.bankMoney > 0 && user.lastDepositAt) {
        const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / 3600000;
        if (hours >= 1) {
            return Math.floor(user.bankMoney * (Math.pow(1 + RATE, Math.floor(hours)) - 1));
        }
    }
    return 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nganhang")
        .setDescription("🏦 Ngân hàng Trung ương - Lãi suất 0.8%/giờ"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        const interest = calcInterest(user);
        const totalBank = user.bankMoney + interest;
        const netWorth = user.money + totalBank;

        // Kỳ tính lãi tiếp theo (mỗi giờ tròn kể từ lúc gửi)
        let nextTickLine = "> 💤 *Chưa có tiền gửi — gửi ngay để tiền đẻ ra tiền!*";
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const depositTime = new Date(user.lastDepositAt).getTime();
            const hoursPassed = Math.floor((Date.now() - depositTime) / 3600000);
            const nextTick = depositTime + (hoursPassed + 1) * 3600000;
            const nextInterest = Math.floor(totalBank * RATE);
            nextTickLine = `> ⏳ Kỳ lãi tiếp theo: **${countdown(nextTick)}** (dự kiến **+${money(nextInterest)}**)`;
        }

        const deleteAt = Date.now() + 60000;
        const embed = casinoEmbed({ color: COLORS.blue, title: "🏦 ✦ NGÂN HÀNG TRUNG ƯƠNG ✦ 🏦" })
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription(
                `Chào quý khách **${interaction.user.username}** 🤵\n\n` +
                `> 📈 Lãi suất: **0.8%/giờ** (lãi kép, cộng dồn mỗi giờ)\n` +
                nextTickLine
            )
            .addFields(
                { name: "💵 Tiền mặt", value: `\`${money(user.money)}\``, inline: true },
                { name: "🏦 Sổ tiết kiệm", value: `\`${money(user.bankMoney)}\``, inline: true },
                { name: "📈 Lãi tích lũy", value: `\`+${money(interest)}\``, inline: true },
                { name: "💎 Tổng tài sản", value: `**\`${money(netWorth)} VND\`**`, inline: false }
            )
            .setFooter({ text: "💡 Tiền trong bank không bị mất khi thua bạc • Bảng tự xóa sau 60s" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("nganhang_deposit").setLabel("Gửi Tiền").setEmoji("📥").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("nganhang_withdraw").setLabel("Rút Tiền").setEmoji("📤").setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: `🗑️ *Bảng tự xóa ${countdown(deleteAt)}*`,
            embeds: [embed],
            components: [row],
        });

        setTimeout(async () => {
            try { await interaction.deleteReply(); } catch (e) {}
        }, 60000);
    },

    // ================= NÚT BẤM =================
    async handleButton(interaction) {
        const action = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setCustomId(`nganhang_modal_${action}`)
            .setTitle(action === "deposit" ? "📥 GỬI TIỀN TIẾT KIỆM" : "📤 RÚT TIỀN VỀ VÍ");

        const input = new TextInputBuilder()
            .setCustomId("amount_input")
            .setLabel("Số tiền hoặc nhập 'all'")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ví dụ: 100000 hoặc all")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    // ================= MODAL =================
    async handleModal(interaction) {
        const action = interaction.customId.split("_")[2];
        let val = interaction.fields.getTextInputValue("amount_input").toLowerCase().replace(/[.,\s]/g, "");
        let user = await User.findOne({ userId: interaction.user.id });

        let amount = 0;
        if (val === "all") {
            amount = action === "deposit" ? user.money : user.bankMoney;
        } else {
            amount = parseInt(val);
        }

        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({ content: "❌ Số tiền không hợp lệ!", flags: 64 });
        }

        // --- GỬI TIỀN (logic giữ nguyên) ---
        if (action === "deposit") {
            if (user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user.money)}!`, flags: 64 });

            // Chốt lãi cũ trước khi nạp thêm
            let lockedInterest = 0;
            if (user.bankMoney > 0 && user.lastDepositAt) {
                const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / 3600000;
                if (hours >= 1) {
                    lockedInterest = Math.floor(user.bankMoney * (Math.pow(1 + RATE, Math.floor(hours)) - 1));
                    user.bankMoney += lockedInterest;
                }
            }

            user.money -= amount;
            user.bankMoney += amount;
            user.lastDepositAt = new Date();
            await user.save();

            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.green, title: "📥 GIAO DỊCH GỬI TIỀN THÀNH CÔNG" })
                    .setDescription(
                        `> 💰 Đã gửi: **+${money(amount)} VND** vào sổ tiết kiệm\n` +
                        (lockedInterest > 0 ? `> 📈 Chốt lãi kỳ trước: **+${money(lockedInterest)} VND**\n` : "") +
                        `> 🏦 Số dư bank: ${vnd(user.bankMoney)}\n` +
                        `> 💵 Tiền mặt còn: ${vnd(user.money)}\n\n` +
                        `⏳ Kỳ lãi đầu tiên: ${countdown(Date.now() + 3600000)}`
                    )],
                flags: 64,
            });
        }

        // --- RÚT TIỀN (logic giữ nguyên) ---
        if (action === "withdraw") {
            if (user.bankMoney < amount) return interaction.reply({ content: `❌ Bank của bạn chỉ có ${vnd(user.bankMoney)}!`, flags: 64 });

            let interest = 0;
            const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / 3600000;
            if (hours >= 1) {
                interest = Math.floor(user.bankMoney * (Math.pow(1 + RATE, Math.floor(hours)) - 1));
            }

            const isAll = amount >= user.bankMoney;

            user.bankMoney -= amount;
            if (isAll) {
                user.money += amount + interest;
                user.lastDepositAt = null;
            } else {
                user.money += amount;
                user.bankMoney += interest;
                user.lastDepositAt = new Date();
            }
            await user.save();

            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.gold, title: "📤 GIAO DỊCH RÚT TIỀN THÀNH CÔNG" })
                    .setDescription(
                        `> 💵 Đã rút: **${money(amount)} VND** về ví\n` +
                        (interest > 0 ? `> 🎁 ${isAll ? "Lãi tích lũy nhận kèm" : "Lãi được chốt vào gốc bank"}: **+${money(interest)} VND**\n` : "") +
                        `> 🏦 Bank còn: ${vnd(user.bankMoney)}\n` +
                        `> 💰 Ví hiện tại: ${vnd(user.money)}`
                    )],
                flags: 64,
            });
        }
    },
};