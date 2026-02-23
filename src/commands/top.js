const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("🏆 Bảng xếp hạng người giàu nhất"),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // ✅ giữ interaction sống

      const topUsers = await User.find()
        .sort({ money: -1 })
        .limit(10);

      const desc = topUsers
        .map(
          (u, i) =>
            `**#${i + 1}** <@${u.userId}> — 💰 **${u.money.toLocaleString(
              "vi-VN"
            )} VND**`
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle("🏆 TOP 10 ĐẠI GIA")
        .setThumbnail("https://cdn-icons-png.flaticon.com/512/10384/10384161.png")
        .setDescription(desc || "Chưa có dữ liệu 😢")
        .setFooter({ text: "BOT • Rich List" })
        .setTimestamp();

      const msg = await interaction.editReply({
        embeds: [embed],
      });

      // ⏳ Tự xoá sau 30s
      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 30000);
    } catch (err) {
      console.error("❌ /top error:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Có lỗi xảy ra!");
      }
    }
  },
};
