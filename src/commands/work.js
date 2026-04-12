const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

const jobs = [
    // --- Nhóm Lao Động Phổ Thông (60k - 150k) ---
    { name: "Bán vé số dạo dưới trời mưa", min: 60000, max: 120000 },
    { name: "Phụ hồ cho thợ chính vui tính", min: 100000, max: 150000 },
    { name: "Rửa bát thuê tại quán phở", min: 65000, max: 110000 },
    { name: "Phát tờ rơi tại ngã tư", min: 60000, max: 100000 },
    { name: "Dọn rác bãi biển", min: 75000, max: 130000 },
    { name: "Chạy xe ôm công nghệ (Grab)", min: 80000, max: 140000 },
    { name: "Bán bánh mì thịt nướng", min: 70000, max: 125000 },
    { name: "Cắt cỏ công viên", min: 65000, max: 115000 },
    { name: "Bơm vá xe vỉa hè", min: 60000, max: 130000 },
    { name: "Bốc vác tại kho hàng", min: 90000, max: 150000 },

    // --- Nhóm Dịch Vụ & Văn Phòng (100k - 200k) ---
    { name: "Thu ngân siêu thị giờ cao điểm", min: 100000, max: 180000 },
    { name: "Trực tổng đài tư vấn tình cảm", min: 110000, max: 190000 },
    { name: "Pha chế (Barista) quán cà phê", min: 105000, max: 175000 },
    { name: "Gia sư dạy toán lớp 1", min: 120000, max: 200000 },
    { name: "Trông tiệm net xuyên màn đêm", min: 100000, max: 160000 },
    { name: "Soạn đơn hàng cho Shopee", min: 115000, max: 185000 },
    { name: "Kiểm kho hàng điện tử", min: 125000, max: 195000 },
    { name: "Lễ tân khách sạn 3 sao", min: 130000, max: 200000 },
    { name: "Dắt chó đi dạo cho đại gia", min: 110000, max: 190000 },
    { name: "Chăm sóc khách hàng khó tính", min: 120000, max: 200000 },

    // --- Nhóm Nghệ Thuật & Freelance (150k - 250k) ---
    { name: "Thiết kế logo giá rẻ", min: 150000, max: 230000 },
    { name: "Edit video Tiktok triệu view", min: 160000, max: 250000 },
    { name: "Viết bài (Content) cho Fanpage", min: 150000, max: 220000 },
    { name: "Chụp ảnh sự kiện sinh nhật", min: 170000, max: 250000 },
    { name: "Vẽ chân dung khách du lịch", min: 155000, max: 240000 },
    { name: "Làm DJ tại quán cà phê", min: 180000, max: 250000 },
    { name: "Hát kẹo kéo phố đi bộ", min: 150000, max: 235000 },
    { name: "Cày rank thuê Liên Quân", min: 165000, max: 250000 },
    { name: "Review đồ ăn vỉa hè", min: 150000, max: 210000 },
    { name: "Quản trị viên Group 1 triệu mem", min: 175000, max: 250000 },

    // --- Nhóm Kỹ Thuật & Độc Lạ (200k - 300k) ---
    { name: "Fix bug cho sếp lúc 2h sáng", min: 200000, max: 300000 },
    { name: "Lau kính tòa nhà chọc trời", min: 220000, max: 300000 },
    { name: "Lắp đặt wifi vùng sâu vùng xa", min: 200000, max: 280000 },
    { name: "Sửa máy lạnh giữa trưa hè", min: 210000, max: 290000 },
    { name: "Thợ lặn vớt rác dưới sông", min: 230000, max: 300000 },
    { name: "Dò mã code cho web cá độ", min: 250000, max: 300000 },
    { name: "Làm giả người yêu ra mắt gia đình", min: 240000, max: 300000 },
    { name: "Ngủ thử nhà ma để review", min: 250000, max: 300000 },
    { name: "Viết bot Discord cho Casino", min: 220000, max: 295000 },
    { name: "Xếp hàng mua iPhone hộ đại gia", min: 210000, max: 285000 },
    { name: "Trình diễn ảo thuật tại phố bộ", min: 200000, max: 270000 },
    { name: "Cài Win dạo cho các em gái", min: 200000, max: 260000 },
    { name: "Thám tử tư theo dõi ngoại tình", min: 230000, max: 300000 },
    { name: "Thử thuốc cho viện nghiên cứu", min: 250000, max: 300000 },
    { name: "Bảo vệ kho vàng", min: 220000, max: 290000 },
    { name: "Gỡ dây điện chằng chịt", min: 215000, max: 295000 },
    { name: "Livestream bán kim cương giả", min: 200000, max: 300000 },
    { name: "Huấn luyện vẹt nói tiếng người", min: 200000, max: 280000 },
    { name: "Lái xe tải xuyên đêm", min: 220000, max: 300000 },
    { name: "Điều phối bay cho máy bay giấy", min: 200000, max: 300000 }
];

const jokes = [
    // --- Nhóm hài hước & Vô tri ---
    "💀 Boss khen bạn làm tốt, nhưng vẫn không tăng lương.",
    "🤡 Đang làm thì bị khách bùng hàng, may mà vẫn nhận được lương cứng.",
    "🔥 Bạn làm hăng say đến mức cháy cả quần, boss phải đền tiền.",
    "💤 Bạn ngủ gật 2 tiếng nhưng camera bị hỏng nên không ai biết.",
    "😎 Đồng nghiệp nhờ làm hộ xong cho thêm tiền cà phê.",
    "🚀 Năng suất hôm nay 'out trình', sếp thưởng nóng luôn.",
    "💔 Vừa làm vừa khóc vì thất tình, khách hàng thấy tội nên tip thêm.",
    "🤌 Làm việc bằng niềm tin và hy vọng, cuối cùng cũng có tiền.",
    "😬 Boss nhìn bạn chằm chằm 15 phút, tưởng bị đuổi ai ngờ được khen.",
    "🎯 Hoàn thành deadline lúc 23:59:59, suýt thì ăn cám.",
    "🤔 Bạn code xong mà không hiểu sao nó lại chạy được.",
    "🍜 Kiếm đủ tiền để ăn một bát phở full topping không cần nhìn giá.",
    "💸 Tiền vào túi như nước, nhưng tí nữa đi đánh bạc thì chưa biết.",
    "🐢 Làm chậm như sên nhưng sếp lại bảo bạn 'cẩn thận'.",
    "⚡ Bạn làm nhanh quá nên đồng nghiệp tưởng bạn hack.",
    "🥵 Mồ hôi rơi, tiền rơi vào túi, trải nghiệm thật tuyệt vời.",
    "🎮 Vừa treo máy cày game vừa làm việc, đa nhiệm cực đỉnh.",
    "📦 Đóng nhầm hàng cho khách nhưng khách lại thích nên khen 5 sao.",
    "🧃 Uống hết 3 ly trà đá mới xong được đống việc này.",
    "💪 Lao động là vinh quang, lang thang là nợ nần!",
    "🤣 Bạn bị sếp mắng vì tội... làm việc quá nhanh.",
    "🧐 Đồng nghiệp hỏi vay tiền ngay khi bạn vừa nhận lương.",
    "😵 Trưa nắng gắt nhưng vì tiền nên bạn vẫn tươi cười.",
    "🤡 Bạn giả vờ bận rộn khi sếp đi ngang qua.",
    "✨ Hôm nay may mắn, làm ít mà hưởng nhiều!",
    "📱 Đang làm thì bị mẹ gọi đi xem mắt, phải xin về sớm.",
    "🙄 Khách hàng bảo: 'Làm cho anh cái này free nhé, sau anh giới thiệu khách cho'.",
    "🤮 Làm việc xong mệt đến mức nhìn thấy cơm là muốn xỉu.",
    "👺 Boss bảo: 'Coi công ty là nhà', nhưng lúc muộn 5 phút thì trừ lương.",
    "🦷 Làm việc hăng hái đến mức suýt gãy cả răng.",
    "🍗 Đủ tiền mua một xô gà rán KFC về ăn một mình.",
    "🤡 Bạn là 'nhân viên ưu tú' nhưng ví tiền thì 'ưu tư'.",
    "🌈 Đang làm thì thấy cầu vồng, hy vọng vận may sẽ tới ván cược sau.",
    "🧨 Làm việc như nổ hũ, nhận tiền xong thấy đời nở hoa.",
    "🌚 Nhìn gương thấy mình đen đi, nhưng nhìn ví thấy mình 'sáng' lên.",
    "🍦 Vừa làm vừa ăn kem, tiền lương đủ mua thêm 10 cây nữa.",
    "🚲 Xe hỏng giữa đường đi làm, may mà vẫn đến kịp nhận lương.",
    "🙉 Sếp nói gì bạn cũng 'vâng', nhưng trong đầu đang nghĩ về Casino.",
    "🙊 Suýt tí nữa thì nói xấu boss ngay trước mặt boss.",
    "👻 Làm việc ở nhà ma mà bạn còn đáng sợ hơn cả ma.",
    "🎸 Vừa làm vừa đàn hát, khách hàng tưởng bạn bị khùng nhưng vẫn cho tiền.",
    "🧼 Làm việc sạch sẽ đến mức boss không tin là bạn đã làm.",
    "🥪 Ăn vội ổ bánh mì khô khốc để cày tiếp cho xong việc.",
    "🛸 Đang làm thì cứ ngỡ mình là người ngoài hành tinh xuống trải nghiệm.",
    "🕯️ Cày việc xuyên đêm như một ngọn nến trước gió.",
    "🛠️ Sửa được cái máy xong thấy dư ra một đống ốc vít.",
    "🦥 Bạn làm việc với tốc độ của một con lười bị trầm cảm.",
    "🦁 Làm việc dũng mãnh như sư tử nhưng lúc nhận lương thì như mèo con.",
    "🦉 Trực đêm mà mắt thâm quầng như gấu trúc.",
    "🏁 Về đích công việc trong gang tấc, thật là kịch tính!",
    "🥳 Xong việc rồi! Cầm tiền này đi 'all-in' thôi nào!"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("work")
        .setDescription("💼 Đi làm kiếm tiền chân chính (cooldown 3 phút)"),

    async execute(interaction) {
        const userId = interaction.user.id;
        let user = await User.findOne({ userId });

        if (!user) user = await User.create({ userId });

        if (user.banned) {
            return interaction.reply({ content: "🚫 Bạn đã bị cấm khỏi hệ thống!", flags: 64 });
        }

        const now = Date.now();
        const cooldown = 3 * 60 * 1000; // 3 phút

        if (user.lastWork && now - new Date(user.lastWork).getTime() < cooldown) {
            const remaining = cooldown - (now - new Date(user.lastWork).getTime());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.ceil((remaining % 60000) / 1000);

            return interaction.reply({
                content: `⏳ Bạn vừa làm rồi, nghỉ tí đi! Quay lại sau **${minutes} phút ${seconds} giây** nữa nhé 😴`,
                flags: 64,
            });
        }

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const reward = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
        const joke = jokes[Math.floor(Math.random() * jokes.length)];

        user.money += reward;
        user.lastWork = new Date();
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00ff99)
            .setTitle("⚒️ NHẬT KÝ LAO ĐỘNG")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👷 Công việc", value: `\`${job.name}\``, inline: true },
                { name: "💰 Thu nhập", value: `\`+${reward.toLocaleString()} VND\``, inline: true },
                { name: "✨ Trạng thái", value: `*${joke}*` }
            )
            .setFooter({ text: `Ví hiện tại: ${user.money.toLocaleString()} VND | Chăm chỉ thì mới có ăn!` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};