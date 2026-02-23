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

const PRICE_PER_BAG = 10000;
const games = new Map(); // messageId -> game data

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tuimu")
    .setDescription("🎁 Mua túi mù may mắn"),

  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id },
      {},
      { upsert: true, new: true }
    );

    if (user.banned) {
      return interaction.reply({
        content: "⛔ Bạn đã bị cấm khỏi hệ thống!",
        flags: 64,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("tuimu_modal")
      .setTitle("🛍️ Mua Túi Mù");

    const input = new TextInputBuilder()
      .setCustomId("bag_amount")
      .setLabel("Số túi muốn mua (10k/túi)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 5");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (interaction.customId !== "tuimu_modal") return;

    const amount = parseInt(
      interaction.fields.getTextInputValue("bag_amount")
    );

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Số lượng không hợp lệ!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    const totalCost = amount * PRICE_PER_BAG;

    if (user.money < totalCost) {
      return interaction.reply({
        content: `❌ Bạn không đủ tiền! Cần ${totalCost.toLocaleString(
          "vi-VN"
        )} VND`,
        flags: 64,
      });
    }

    // Trừ tiền trước
    user.money -= totalCost;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("🎁 TÚI MÙ MAY MẮN")
      .setDescription(
        `🛍️ Bạn đã mua **${amount} túi mù**\n` +
          `💸 Tổng tiền: **${totalCost.toLocaleString("vi-VN")} VND**\n\n` +
          `👉 Nhấn nút bên dưới để mở túi!`
      )
      .setFooter({ text: "HOP-BOT Casino 💎" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tuimu_open")
        .setLabel("🎁 MỞ TÚI")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      userId: interaction.user.id,
      amount,
      totalCost,
    });
  },

  async handleButton(interaction) {
    if (interaction.customId !== "tuimu_open") return;

    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Phiên này đã hết hạn!",
        flags: 64,
      });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        content: "❌ Đây không phải túi của bạn!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) return;

    let resultText = "";
    let totalReward = 0;

    for (let i = 1; i <= game.amount; i++) {
      const win = Math.random() < 0.4; // 50/50

      const reward = Math.floor(
        Math.random() * (100000 - 5000 + 1) + 5000
      );

      if (win) {
        totalReward += reward;
        resultText += `🎉 Túi ${i}: +${reward.toLocaleString("vi-VN")} VND\n`;
      } else {
        resultText += `💀 Túi ${i}: 0 VND\n`;
      }
    }

    user.money += totalReward;
    await user.save();

    const profit = totalReward - game.totalCost;

    const embed = new EmbedBuilder()
      .setColor(profit >= 0 ? 0x00ff00 : 0xff0000)
      .setTitle("🎊 KẾT QUẢ MỞ TÚI")
      .setDescription(
        `${resultText}\n` +
          `💰 Tổng nhận: **${totalReward.toLocaleString("vi-VN")} VND**\n` +
          `📊 Lãi/Lỗ: **${profit >= 0 ? "+" : ""}${profit.toLocaleString(
            "vi-VN"
          )} VND**`
      )
      .setFooter({ text: "HOP-BOT Casino 💎" })
      .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [],
    });

    games.delete(interaction.message.id);
  },
};
