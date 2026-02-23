const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vitien")
    .setDescription("💰 Xem số tiền hiện tại của bạn"),

  async execute(interaction) {
    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      user = await User.create({
        userId: interaction.user.id,
        money: 1000,
      });
    }

    if (typeof user.money !== "number") {
      user.money = 1000;
      await user.save();
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("🐷 Ví tiền của bạn")
      .setDescription(`💵 Bạn đang có **${user.money.toLocaleString("vi-VN")} VND**`)
      .setFooter({ text: "BOT 💖 Chúc bạn chơi game vui vẻ!" })
      .setTimestamp();

    const response = await interaction.reply({
      embeds: [embed],
      flags: 64,
      withResponse: true,
    });

    setTimeout(() => {
      response.resource.message.delete().catch(() => {});
    }, 15000);
  },
};
