const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(",")
  : [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("💰 CHỈNH TIỀN NGƯỜI DÙNG (Admin only)")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Người cần chỉnh tiền")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Số tiền muốn set (VND)")
        .setRequired(true)
    ),

  async execute(interaction) {
    // 🚫 Không phải admin ID
    if (!adminIds.includes(interaction.user.id)) {
      return interaction.reply({
        content: "⛔ Bạn không có quyền dùng lệnh này!",
        flags: 64,
      });
    }

    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (amount < 0) {
      return interaction.reply({
        content: "❌ Số tiền không hợp lệ!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: target.id });
    if (!user) {
      user = await User.create({ userId: target.id });
    }

    user.money = amount;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("💰 SET MONEY THÀNH CÔNG")
      .setDescription(
        `👤 User: <@${target.id}>\n` +
        `💎 Tiền mới: **${amount.toLocaleString("vi-VN")} VND**`
      )
      .setFooter({ text: `Admin: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
