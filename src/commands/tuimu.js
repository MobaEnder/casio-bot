const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");

const PRICE_PER_BAG = 100000;
const MAX_BAGS = 100;
const WIN_PERCENT = 40; // Tăng lên 40% để dễ thở hơn

const games = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuimu")
        .setDescription("🎁 Mua túi mù may mắn - Cơ hội nhận quà khủng!"),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("tuimu_modal")
            .setTitle("🛍️ MUA TÚI MÙ MAY MẮN");

        const input = new TextInputBuilder()
            .setCustomId("bag_amount")
            .setLabel(`Số lượng túi (Giá: ${PRICE_PER_BAG.toLocaleString()} VND/túi)`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Nhập số lượng (Tối đa 100)")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        if (interaction.customId !== "tuimu_modal") return;

        const amount = parseInt(interaction.fields.getTextInputValue("bag_amount"));
        if (isNaN(amount) || amount <= 0 || amount > MAX_BAGS) {
            return interaction.reply({ content: `❌ Số lượng không hợp lệ (1 - ${MAX_BAGS})!`, flags: 64 });
        }

        const totalCost = amount * PRICE_PER_BAG;
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user || user.money < totalCost) {
            return interaction.reply({ content: `❌ Bạn không đủ tiền! Cần **${totalCost.toLocaleString()} VND**.`, flags: 64 });
        }

        // TRỪ TIỀN NGAY
        user.money -= totalCost;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setTitle("🎁 BẠN ĐÃ MUA TÚI MÙ!")
            .setDescription(
                `📦 Số lượng: **${amount} túi**\n` +
                `💸 Tổng chi: **${totalCost.toLocaleString()} VND**\n\n` +
                `*Nhấn nút bên dưới để khui quà ngay!*`
            )
            .setFooter({ text: "Chúc bạn may mắn lần này!" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("tuimu_open")
                .setLabel("🎁 KHUI TÚI")
                .setStyle(ButtonStyle.Success)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            withResponse: true
        });

        games.set(response.resource.message.id, {
            userId: interaction.user.id,
            amount,
            totalCost
        });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return;

        if (interaction.user.id !== game.userId) {
            return interaction.reply({ content: "❌ Túi này của người khác mà!", flags: 64 });
        }

        if (interaction.customId === "tuimu_open") {
            let totalReward = 0;
            let winCount = 0;
            let luckyDraws = []; // Chỉ lưu các túi trúng to để hiện lên

            for (let i = 1; i <= game.amount; i++) {
                const isWin = Math.random() * 100 < WIN_PERCENT;
                if (isWin) {
                    // Thưởng từ 20k đến 500k (Có cơ hội lời to)
                    const reward = Math.floor(Math.random() * (500000 - 20000 + 1) + 20000);
                    totalReward += reward;
                    winCount++;
                    if (reward > 250000) luckyDraws.push(`🔥 Túi #${i}: **+${reward.toLocaleString()}**`);
                }
            }

            const user = await User.findOne({ userId: interaction.user.id });
            user.money += totalReward;
            await user.save();

            const profit = totalReward - game.totalCost;
            const status = profit >= 0 ? "LÃI 📈" : "LỖ 📉";

            const resultEmbed = new EmbedBuilder()
                .setColor(profit >= 0 ? "Green" : "Red")
                .setTitle("🎊 KẾT QUẢ MỞ TÚI MÙ")
                .addFields(
                    { name: "📦 Tổng túi", value: `${game.amount}`, inline: true },
                    { name: "🎉 Trúng", value: `${winCount} túi`, inline: true },
                    { name: "💰 Tổng nhận", value: `**${totalReward.toLocaleString()} VND**`, inline: true },
                    { name: "📊 Kết quả", value: `**${status} ${Math.abs(profit).toLocaleString()} VND**`, inline: false }
                );

            if (luckyDraws.length > 0) {
                resultEmbed.addFields({ 
                    name: "🌟 Các túi may mắn nhất:", 
                    value: luckyDraws.slice(0, 5).join("\n") + (luckyDraws.length > 5 ? "\n..." : "") 
                });
            }

            await interaction.update({ embeds: [resultEmbed], components: [] });
            games.delete(interaction.message.id);
        }
    }
};
