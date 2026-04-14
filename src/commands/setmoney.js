const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// Lấy danh sách ID admin từ file .env
const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(",")
  : [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("💰 CHỈNH TIỀN NGƯỜI DÙNG (Chỉ Admin)")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Người cần chỉnh tiền")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("amount")
        .setDescription("Số tiền muốn set (VND)")
        .setRequired(true)
    ),

  async execute(interaction) {
    // 1. Kiểm tra quyền Admin
    if (!adminIds.includes(interaction.user.id)) {
      return interaction.reply({
        content: "⛔ Bạn không có quyền sử dụng lệnh này!",
        flags: 64, // Ẩn thông báo lỗi với người khác
      });
    }

    const target = interaction.options.getUser("user");
    const amountStr = interaction.options.getString("amount");
    const amount = parseInt(amountStr);

    // 2. Kiểm tra số tiền hợp lệ
    if (isNaN(amount) || amount < 0) {
      return interaction.reply({
        content: "❌ Số tiền không hợp lệ (Phải là số dương)!",
        flags: 64, // Ẩn thông báo lỗi
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

      // 5. Phản hồi ẩn (Chỉ Admin thực hiện lệnh mới thấy)
      const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("✅ CẬP NHẬT SỐ DƯ THÀNH CÔNG")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: "👤 Đối tượng", value: `<@${target.id}>`, inline: true },
            { name: "💰 Số dư mới", value: `**${amount.toLocaleString("vi-VN")} VND**`, inline: true }
        )
        .setDescription(`Số dư của người dùng đã được điều chỉnh trên hệ thống.`)
        .setFooter({ text: `Lệnh thực hiện bởi Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ 
        embeds: [embed], 
        flags: 64 // QUAN TRỌNG: Flag 64 giúp tin nhắn này chỉ người dùng lệnh (Admin) nhìn thấy
      });

    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: "❌ Đã có lỗi xảy ra khi cập nhật Database!",
        flags: 64,
      });
    }
  },
};