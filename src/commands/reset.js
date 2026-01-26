const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const User = require("../models/User");

const ADMIN_IDS = ["471607979007803392"]; // 🔴 THAY ID CỦA BẠN

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reset")
    .setDescription("🔥 XÓA TOÀN BỘ DATABASE (Admin only)"),

  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền dùng lệnh này!",
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("⚠️ CẢNH BÁO NGUY HIỂM")
      .setDescription(
        "Bạn sắp **XÓA TOÀN BỘ dữ liệu người chơi**:\n" +
        "• Tiền\n• Bảng xếp hạng\n• Lịch sử\n• Khoản vay\n\n" +
        "**HÀNH ĐỘNG NÀY KHÔNG THỂ HOÀN TÁC!**"
      )
      .setFooter({ text: "HOP BOT • SYSTEM" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("reset_confirm")
        .setLabel("🔥 XÓA TẤT CẢ")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("reset_cancel")
        .setLabel("❌ HỦY")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64,
    });
  },

  // ===== BUTTON HANDLER =====
  async handleButton(interaction) {
    if (!interaction.customId.startsWith("reset_")) return;

    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền bấm nút này!",
        flags: 64,
      });
    }

    if (interaction.customId === "reset_cancel") {
      return interaction.update({
        content: "❎ Đã hủy reset.",
        embeds: [],
        components: [],
      });
    }

    if (interaction.customId === "reset_confirm") {
      await User.deleteMany({});

      return interaction.update({
        content: "💥 **ĐÃ XÓA SẠCH TOÀN BỘ DATABASE!**",
        embeds: [],
        components: [],
      });
    }
  },
};
