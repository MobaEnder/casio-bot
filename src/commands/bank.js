const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bank")
    .setDescription("🏦 Chuyển tiền cho người khác")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Người nhận").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("Số tiền muốn chuyển").setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply({
        content: "❌ Số tiền phải lớn hơn 0!",
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể chuyển tiền cho chính mình!",
      });
    }

    let sender = await User.findOne({ userId: interaction.user.id });
    if (!sender) sender = await User.create({ userId: interaction.user.id });

    if (sender.money < amount) {
      return interaction.reply({
        content: "❌ Bạn không đủ tiền để chuyển!",
      });
    }

    let receiver = await User.findOne({ userId: target.id });
    if (!receiver) receiver = await User.create({ userId: target.id });

    sender.money -= amount;
    receiver.money += amount;

    await sender.save();
    await receiver.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("💸 Giao dịch thành công!")
      .setDescription(
        `👤 **${interaction.user.username}** → **${target.username}**\n\n` +
        `💵 Số tiền: **${amount.toLocaleString("vi-VN")} VND**\n` +
        `💰 Số dư còn lại: **${sender.money.toLocaleString("vi-VN")} VND**`
      )
      .setFooter({ text: "HOP-BOT 💖 Giao dịch an toàn & minh bạch!" })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  },
};
