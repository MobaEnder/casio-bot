const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

const jobs = [
  { name: "Bán trà đá", min: 20000, max: 50000 },
  { name: "Shiper", min: 30000, max: 70000 },
  { name: "Coder", min: 50000, max: 120000 },
  { name: "Chạy bàn quán nhậu", min: 25000, max: 60000 },
  { name: "Streamer", min: 10000, max: 40000 },
  { name: "Làm thuê cho boss", min: 70000, max: 150000 },
  { name: "Hack wifi hàng xóm", min: 20000, max: 50000 },
  { name: "Bán vé số dạo", min: 15000, max: 40000 },
  { name: "Tester", min: 40000, max: 90000 },
  { name: "Chạy KPI deadline 23:59", min: 60000, max: 130000 },
  { name: "Bán bánh mì vỉa hè", min: 20000, max: 50000 },
  { name: "Dọn chuồng chó", min: 30000, max: 70000 },
  { name: "Cày rank thuê", min: 50000, max: 100000 },
  { name: "Giả làm người yêu anh trai hàng xóm", min: 10000, max: 30000 },
  { name: "Trông mèo cho hàng xóm", min: 20000, max: 60000 },
];

const jokes = [
  "💀 Ông chủ quên trả lương nên bạn phải quỳ xuống.",
  "🔥 Làm xong việc mà cảm giác như lọ.",
  "💤 Bạn ngủ gật trong giờ làm nhưng vẫn được trả lương.",
  "😎 Làm việc chill chill nhưng tiền thì không chill lắm.",
  "🤡 Bị chửi 3 lần nhưng vẫn được trả tiền.",
  "🚀 Năng suất vượt KPI của chính bạn hôm qua.",
  "💔 Đồng nghiệp nghỉ việc giữa ca, bạn gánh hết.",
  "🥲 Làm cực nhưng nhìn tiền về thấy cũng đáng.",
  "🧠 Não quá tải nhưng ví tiền thì đầy hơn.",
  "🎯 Hoàn thành nhiệm vụ mà không bị sa thải — hiếm!"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("💼 Đi làm kiếm tiền (cooldown 1 giờ)"),

  async execute(interaction) {
    const userId = interaction.user.id;

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    if (user.banned) {
      return interaction.reply({
        content: "🚫 Bạn đã bị cấm khỏi hệ thống cược.",
        flags: 64,
      });
    }

    const now = Date.now();
    const cooldown = 60 * 60 * 1000;

    // 🛡️ Fix dữ liệu date lỗi cũ
    if (user.lastWork && !(user.lastWork instanceof Date)) {
      user.lastWork = new Date(user.lastWork);
    }

    if (user.lastWork && now - user.lastWork.getTime() < cooldown) {
      const remaining = cooldown - (now - user.lastWork.getTime());
      const minutes = Math.ceil(remaining / 60000);

      return interaction.reply({
        content: `⏳ Bạn đã làm việc rồi! Quay lại sau **${minutes} phút** nữa nhé 😴`,
        flags: 64,
      });
    }

    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const reward =
      Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    user.money += reward;
    user.lastWork = new Date();
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("💼 BẠN ĐÃ ĐI LÀM!")
      .setDescription(
        `🧑‍💻 **Công việc:** ${job.name}\n` +
        `💸 **Thu nhập:** ${reward.toLocaleString("vi-VN")} VND\n\n` +
        `😂 ${joke}`
      )
      .setFooter({ text: "HOP BOT • Work System" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
