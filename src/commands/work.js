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
  { name: "Giả làm người yêu", min: 10000, max: 30000 },
  { name: "Trông mèo", min: 20000, max: 60000 },
  { name: "Bán nước mía", min: 20000, max: 55000 },
  { name: "Phụ hồ", min: 40000, max: 90000 },
  { name: "Bán cá ngoài chợ", min: 30000, max: 70000 },
  { name: "Thu ngân siêu thị", min: 35000, max: 80000 },
  { name: "Phát tờ rơi", min: 15000, max: 35000 },
  { name: "Chạy xe ôm", min: 30000, max: 70000 },
  { name: "Bán bắp rang", min: 20000, max: 50000 },
  { name: "Rửa xe", min: 25000, max: 60000 },
  { name: "Giao nước bình", min: 35000, max: 75000 },
  { name: "Trông tiệm net", min: 30000, max: 65000 },
  { name: "Cắt cỏ thuê", min: 25000, max: 60000 },
  { name: "Bán kem dạo", min: 15000, max: 40000 },
  { name: "Sửa điện thoại", min: 40000, max: 100000 },
  { name: "Cài win thuê", min: 30000, max: 80000 },
  { name: "Chạy quảng cáo thuê", min: 50000, max: 120000 },
  { name: "Viết content", min: 35000, max: 90000 },
  { name: "Thiết kế logo", min: 40000, max: 100000 },
  { name: "Edit video", min: 45000, max: 110000 },
  { name: "Chụp ảnh sự kiện", min: 50000, max: 130000 },
  { name: "Làm DJ đám cưới", min: 60000, max: 150000 },
  { name: "Làm MC sự kiện", min: 50000, max: 120000 },
  { name: "Trông trẻ", min: 25000, max: 70000 },
  { name: "Dọn nhà thuê", min: 30000, max: 80000 },
  { name: "Bán trà sữa", min: 25000, max: 60000 },
  { name: "Pha chế cafe", min: 30000, max: 75000 },
  { name: "Bán gà rán", min: 30000, max: 70000 },
  { name: "Bán bánh tráng trộn", min: 20000, max: 50000 },
  { name: "Đóng gói hàng", min: 25000, max: 60000 },
  { name: "Soạn đơn Shopee", min: 25000, max: 65000 },
  { name: "Livestream bán hàng", min: 30000, max: 90000 },
  { name: "Quản lý fanpage", min: 40000, max: 100000 },
  { name: "Moderate group", min: 20000, max: 60000 },
  { name: "Cày view YouTube", min: 15000, max: 45000 },
  { name: "Viết caption thuê", min: 20000, max: 60000 },
  { name: "Review đồ ăn", min: 25000, max: 70000 },
  { name: "Dắt chó đi dạo", min: 20000, max: 60000 },
  { name: "Bán hoa dạo", min: 20000, max: 50000 },
  { name: "Bán trái cây", min: 25000, max: 65000 },
  { name: "Thu gom ve chai", min: 15000, max: 45000 },
  { name: "Chở hàng thuê", min: 35000, max: 80000 },
  { name: "Phụ bếp", min: 30000, max: 75000 },
  { name: "Nướng thịt xiên", min: 25000, max: 60000 },
  { name: "Bán xúc xích", min: 20000, max: 50000 },
  { name: "Trông xe", min: 20000, max: 55000 },
  { name: "Gác cổng", min: 25000, max: 60000 },
  { name: "Bảo vệ quán net", min: 30000, max: 70000 },
  { name: "Lắp wifi", min: 40000, max: 100000 },
  { name: "Sửa quạt", min: 25000, max: 70000 },
  { name: "Sửa máy lạnh", min: 50000, max: 120000 },
  { name: "Bơm vá xe", min: 20000, max: 60000 },
  { name: "Đánh giày", min: 15000, max: 40000 },
  { name: "Chạy việc lặt vặt", min: 20000, max: 60000 },
  { name: "Dọn rác thuê", min: 25000, max: 65000 },
  { name: "Chăm cây cảnh", min: 25000, max: 70000 },
  { name: "Trồng rau thuê", min: 20000, max: 60000 },
  { name: "Làm vườn", min: 25000, max: 70000 },
  { name: "Bán chè", min: 20000, max: 50000 },
  { name: "Bán bún bò", min: 30000, max: 70000 },
  { name: "Bán phở", min: 30000, max: 75000 },
  { name: "Bán hủ tiếu", min: 30000, max: 75000 },
  { name: "Bán cơm tấm", min: 30000, max: 70000 },
  { name: "Bán bánh xèo", min: 30000, max: 75000 },
  { name: "Bán gỏi cuốn", min: 25000, max: 65000 },
  { name: "Bán sinh tố", min: 20000, max: 60000 },
  { name: "Bán nước ép", min: 20000, max: 60000 },
  { name: "Bán trà chanh", min: 20000, max: 55000 },
  { name: "Coi quầy tạp hóa", min: 25000, max: 65000 },
  { name: "Bán đồ online", min: 30000, max: 90000 },
  { name: "Sửa laptop", min: 50000, max: 120000 },
  { name: "Lập website", min: 60000, max: 150000 },
  { name: "Fix bug code", min: 50000, max: 130000 },
  { name: "Quản trị server", min: 60000, max: 150000 },
  { name: "Viết bot Discord", min: 50000, max: 120000 },
  { name: "Viết bot Telegram", min: 50000, max: 120000 },
  { name: "Phát triển game nhỏ", min: 60000, max: 140000 },
  { name: "Thiết kế UI", min: 40000, max: 100000 },
  { name: "Thiết kế banner", min: 35000, max: 90000 },
  { name: "Vẽ sticker", min: 30000, max: 80000 },
  { name: "Bán acc game", min: 40000, max: 100000 },
  { name: "Farm đồ game", min: 30000, max: 90000 },
  { name: "Test game", min: 35000, max: 85000 },
  { name: "Chạy sự kiện game", min: 40000, max: 100000 },
  { name: "Làm admin server", min: 40000, max: 100000 }
];

const jokes = [
"💀 Ông chủ quên trả lương nên bạn phải đòi 3 lần.",
"🔥 Làm xong việc mà áo ướt như vừa tắm.",
"💤 Bạn ngủ gật 5 phút nhưng vẫn được trả tiền.",
"😎 Làm việc chill chill nhưng tiền thì hơi ít.",
"🤡 Bị chửi 3 lần nhưng vẫn sống sót.",
"🚀 Năng suất hôm nay gấp đôi hôm qua.",
"💔 Đồng nghiệp nghỉ giữa ca, bạn gánh hết.",
"🥲 Làm cực nhưng nhìn tiền về cũng đỡ.",
"🧠 Não quá tải nhưng ví tiền dày hơn.",
"🎯 Hoàn thành nhiệm vụ mà không bị sa thải.",

"😵 Làm việc xong lưng đau nhưng ví vui.",
"💸 Tiền ít nhưng trải nghiệm nhiều.",
"🐢 Làm chậm nhưng chắc.",
"⚡ Làm nhanh quá khiến boss nghi ngờ.",
"🍜 Làm xong đủ tiền ăn tô mì.",
"📉 Năng suất thấp nhưng vẫn có lương.",
"🧊 Công việc mát mẻ như đá lạnh.",
"🥵 Công việc nóng như lò than.",
"🎮 Làm việc nhưng đầu vẫn nghĩ game.",
"📦 Đóng gói xong 50 đơn trong 1 giờ.",

"😴 Bạn vừa làm vừa ngáp.",
"🤓 Làm việc rất chuyên nghiệp.",
"😬 Boss nhìn bạn 10 giây đầy nghi ngờ.",
"🥲 Làm xong việc mới nhớ chưa ăn.",
"🧃 Kiếm đủ tiền mua ly trà sữa.",
"📊 Hiệu suất 120%.",
"🐌 Làm việc chậm nhưng đều.",
"💪 Hôm nay làm việc rất lực.",
"🎧 Làm việc kèm nghe nhạc.",
"📉 Boss nói: mai làm nhanh hơn nhé.",

"🪙 Nhặt được thêm ít tiền lẻ.",
"📦 Bị giao thêm việc bất ngờ.",
"😎 Đồng nghiệp khen bạn làm tốt.",
"💤 Suýt ngủ gật trong lúc làm.",
"🥵 Làm xong mà mồ hôi đầm đìa.",
"🚶 Làm việc xong đi bộ về.",
"💼 Boss giao thêm nhiệm vụ.",
"📉 Tiền không nhiều nhưng ổn.",
"🍞 Đủ tiền mua ổ bánh mì.",
"🧃 Đủ tiền uống nước mía.",

"🎯 Hoàn thành việc đúng hạn.",
"😅 Làm việc mà tim đập nhanh.",
"📦 Giao xong việc trong gang tấc.",
"🐢 Boss nói bạn làm hơi chậm.",
"💡 Bạn nghĩ ra cách làm nhanh hơn.",
"🧠 Não hoạt động hết công suất.",
"📉 Hơi mệt nhưng vẫn ổn.",
"🥲 Lưng hơi đau sau khi làm.",
"⚡ Làm nhanh khiến mọi người bất ngờ.",
"😴 Vừa làm vừa muốn ngủ.",

"🪙 Kiếm thêm chút tiền.",
"📊 Boss khá hài lòng.",
"🤡 Đồng nghiệp trêu bạn.",
"🥵 Làm việc hơi cực.",
"🧃 Nghỉ 1 phút uống nước.",
"💼 Công việc khá ổn.",
"📦 Làm xong đúng lúc.",
"🐌 Chậm nhưng chắc.",
"🎮 Nghĩ tới game sau giờ làm.",
"🍜 Nghĩ tới đồ ăn.",

"📉 Công việc không quá khó.",
"💡 Bạn học thêm kinh nghiệm.",
"😎 Làm việc rất tự tin.",
"😬 Boss đứng nhìn phía sau.",
"🥲 Làm xong muốn nằm nghỉ.",
"⚡ Năng suất tăng đột biến.",
"🧠 Não hơi lag.",
"🐢 Làm việc đều đều.",
"📦 Xong việc trước thời gian.",
"💤 Suýt ngủ gật.",

"💸 Nhận được tiền công.",
"📊 Boss gật đầu hài lòng.",
"😅 Làm xong thở phào.",
"🔥 Làm việc nhiệt huyết.",
"🧊 Làm việc khá chill.",
"🎯 Hoàn thành mục tiêu.",
"🤓 Làm việc cực kỳ tập trung.",
"💪 Hôm nay làm khỏe.",
"📉 Hơi mệt nhưng ổn.",
"🥳 Xong việc và nhận tiền!"
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
    // Thay đổi số 60 đầu tiên thành số 3 (3 phút * 60 giây * 1000 mili-giây)
    const cooldown = 3 * 60 * 1000; 

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
      .setFooter({ text: "BOT • Work System" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
