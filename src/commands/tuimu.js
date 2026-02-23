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
const MAX_BAGS = 100;
const WIN_PERCENT = 40; // 40% trúng = 60% xịt

const games = new Map();

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
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("tuimu_modal")
      .setTitle("🛍️ Mua Túi Mù");

    const input = new TextInputBuilder()
      .setCustomId("bag_amount")
      .setLabel("Nhập số túi (10k/túi)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Tối đa 100");

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
        ephemeral: true,
      });
    }

    if (amount > MAX_BAGS) {
      return interaction.reply({
        content: "❌ Bạn chỉ được mua tối đa 100 túi!",
        ephemeral: true,
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
        ephemeral: true,
      });
    }

    user.money -= totalCost;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("🎁 TÚI MÙ MAY MẮN")
      .setDescription(
        `🛍️ Bạn đã mua **${amount} túi**\n` +
          `💸 Tổng tiền: **${totalCost.toLocaleString("vi-VN")} VND**\n\n` +
          `👉 Nhấn nút bên dưới để mở túi!`
      )
      .setFooter({ text: "BOT Casino 💎" })
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
      fetchReply: true,
    });

    games.set(msg.id, {
      userId: interaction.user.id,
      amount,
      totalCost,
    });
  },

  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) return;

    // 🎁 MỞ TÚI
    if (interaction.customId === "tuimu_open") {
      if (interaction.user.id !== game.userId) {
        return interaction.reply({
          content: "❌ Đây không phải túi của bạn!",
          ephemeral: true,
        });
      }

      let user = await User.findOne({ userId: interaction.user.id });
      if (!user) return;

      const results = [];
      let totalReward = 0;

      for (let i = 1; i <= game.amount; i++) {
        const win =
          Math.floor(Math.random() * 100) < WIN_PERCENT;

        if (win) {
          const reward = Math.floor(
            Math.random() * (100000 - 5000 + 1) + 5000
          );
          totalReward += reward;
          results.push(`🎉 Túi ${i}: +${reward.toLocaleString("vi-VN")} VND`);
        } else {
          results.push(`💀 Túi ${i}: XỊT`);
        }
      }

      user.money += totalReward;
      await user.save();

      const profit = totalReward - game.totalCost;

      game.results = results;
      game.totalReward = totalReward;
      game.profit = profit;

      const page1 = results.slice(0, 50).join("\n");
      const page2 = results.slice(50, 100).join("\n");

      const embed = new EmbedBuilder()
        .setColor(profit >= 0 ? 0x00ff00 : 0xff0000)
        .setTitle(
          `🎊 KẾT QUẢ MỞ TÚI (${game.amount > 50 ? "Trang 1/2" : "Trang 1/1"})`
        )
        .setDescription(
          `${page1}\n\n` +
            `💰 Tổng nhận: **${totalReward.toLocaleString("vi-VN")} VND**\n` +
            `📊 Lãi/Lỗ: **${profit >= 0 ? "+" : ""}${profit.toLocaleString(
              "vi-VN"
            )} VND**`
        )
        .setFooter({ text: "BOT Casino 💎" })
        .setTimestamp();

      let components = [];

      if (game.amount > 50) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tuimu_page2")
            .setLabel("➡️ Trang 2")
            .setStyle(ButtonStyle.Primary)
        );
        components.push(row);
      }

      await interaction.update({
        embeds: [embed],
        components: components,
      });

      setTimeout(async () => {
        try {
          await interaction.message.delete();
          games.delete(interaction.message.id);
        } catch (err) {}
      }, 30000);
    }

    // 📖 TRANG 2
    if (interaction.customId === "tuimu_page2") {
      const page2 = game.results.slice(50, 100).join("\n");

      const embed = new EmbedBuilder()
        .setColor(game.profit >= 0 ? 0x00ff00 : 0xff0000)
        .setTitle("🎊 KẾT QUẢ MỞ TÚI (Trang 2/2)")
        .setDescription(
          `${page2}\n\n` +
            `💰 Tổng nhận: **${game.totalReward.toLocaleString("vi-VN")} VND**\n` +
            `📊 Lãi/Lỗ: **${game.profit >= 0 ? "+" : ""}${game.profit.toLocaleString(
              "vi-VN"
            )} VND**`
        )
        .setFooter({ text: "BOT Casino 💎" })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: [],
      });
    }
  },
};
