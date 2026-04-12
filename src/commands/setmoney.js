const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// Đảm bảo lấy đúng ID admin từ .env
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
    .addStringOption(option => // Dùng String để tránh giới hạn số nguyên của Discord
      option
        .setName("amount")
        .setDescription("Số tiền muốn set (VND)")
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName("private")
        .setDescription("Gửi kết quả ẩn (Chỉ mình bạn thấy)")
        .setRequired(false)
    ),

  async execute(interaction) {
    // 1. Kiểm tra quyền Admin
    if (!adminIds.includes(interaction.user.id)) {
      return interaction.reply({
        content: "⛔ Bạn không có quyền sử dụng quyền năng tối thượng này!",
        flags: 64,
      });
    }

    const target = interaction.options.getUser("user");
    const amountStr = interaction.options.getString("amount");
    const amount = parseInt(amountStr);
    const isPrivate = interaction.options.getBoolean("private") ?? false;

    // 2. Kiểm tra số tiền hợp lệ
    if (isNaN(amount) || amount < 0) {
      return interaction.reply({
        content: "❌ Số tiền không hợp lệ (Phải là số dương)!",
        flags: 64,
      });
    }

    try {
      // 3. Tìm hoặc tạo user trong database
      let user = await User.findOne({ userId: target.id });
      if (!user) {
        user = await User.create({ userId: target.id });
      }

      // 4. Cập nhật số tiền
      user.money = amount;
      await user.save();

      // 5. Phản hồi
      const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("✅ CẬP NHẬT SỐ DƯ THÀNH CÔNG")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: "👤 Đối tượng", value: `<@${target.id}>`, inline: true },
            { name: "💰 Số dư mới", value: `**${amount.toLocaleString("vi-VN")} VND**`, inline: true }
        )
        .setFooter({ text: `Người thực hiện: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ 
        embeds: [embed], 
        flags: isPrivate ? 64 : undefined 
      });

    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: "❌ Đã có lỗi xảy ra khi truy cập cơ sở dữ liệu!",
        flags: 64,
      });
    }
  },
};