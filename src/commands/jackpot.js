const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// --- CÁC ICON NGỘ NGHĨNH DÀNH CHO SLOT ---
const SLOTS = ["🍒", "🍇", "🍉", "🍓", "🍀", "🔔", "💖", "💎"];
const SPINNING = "<a:loading:1000000000000000000>"; // Nếu bạn có icon GIF xoay, thay ID vào đây. Nếu không, xài "🌀" tạm nhé.
const SPIN_EMOJI = "🌀"; 

// Hàm random icon
function getRandomSlot() {
    return SLOTS[Math.floor(Math.random() * SLOTS.length)];
}

// Hàm vẽ khung máy chơi Slot
function renderSlotMachine(e1, e2, e3) {
    return `
\`      ___🎰 SLOTS 🎰___\`
⬛ \`|\` ${e1} \`|\` ${e2} \`|\` ${e3} \`|\` ⬛
\`      -----------------\`
`;
}

// Hàm delay để tạo hiệu ứng quay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jackpot")
        .setDescription("🎰 Nổ hũ đổi đời - Nhập số tiền và xem nhân phẩm")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền muốn mang đi cược (Tối thiểu 5,000 VND)")
               .setRequired(true)
               .setMinValue(5000)
        ),

    async execute(interaction) {
        const betAmount = interaction.options.getInteger("tiencuoc");

        // Delay reply vì chúng ta sẽ edit tin nhắn nhiều lần để tạo hiệu ứng
        await interaction.deferReply();

        const user = await User.findOne({ userId: interaction.user.id });

        // 1. Kiểm tra tiền túi
        if (!user || user.money < betAmount) {
            return interaction.editReply({ content: `❌ Khố rách áo ôm mà đòi chơi sang! Bạn chỉ còn \`${(user?.money || 0).toLocaleString()} VND\` thôi.` });
        }

        // 2. Trừ tiền cược trước (Chơi là phải giam vốn)
        user.money -= betAmount;
        await user.save();

        // 3. Chuẩn bị kết quả trước khi hiển thị
        const result1 = getRandomSlot();
        const result2 = getRandomSlot();
        const result3 = getRandomSlot();

        // 4. HIỆU ỨNG QUAY (SPINNING ANIMATION)
        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`🎰 CHUYẾN TÀU KHỞI NGHIỆP CỦA ${interaction.user.username.toUpperCase()} 🎰`)
            .setDescription(`**Tiền cược:** \`${betAmount.toLocaleString()} VND\``);

        // Khung 1: Đang quay cả 3 ô
        embed.addFields({ name: "Kết quả", value: renderSlotMachine(SPIN_EMOJI, SPIN_EMOJI, SPIN_EMOJI) });
        await interaction.editReply({ embeds: [embed] });
        await wait(1000); // Đợi 1 giây

        // Khung 2: Chốt ô số 1
        embed.spliceFields(0, 1, { name: "Kết quả", value: renderSlotMachine(result1, SPIN_EMOJI, SPIN_EMOJI) });
        await interaction.editReply({ embeds: [embed] });
        await wait(1000); // Đợi 1 giây

        // Khung 3: Chốt ô số 2
        embed.spliceFields(0, 1, { name: "Kết quả", value: renderSlotMachine(result1, result2, SPIN_EMOJI) });
        await interaction.editReply({ embeds: [embed] });
        await wait(1500); // Hồi hộp ô cuối nên đợi 1.5 giây

        // Khung 4: Chốt ô cuối (Kết quả chung cuộc)
        embed.spliceFields(0, 1, { name: "Kết quả", value: renderSlotMachine(result1, result2, result3) });

        // 5. TÍNH TOÁN KẾT QUẢ VÀ TRẢ THƯỞNG
        let winAmount = 0;
        let resultMessage = "";
        let resultColor = 0xe74c3c; // Đỏ (Thua mặc định)

        // Nếu cả 3 ô giống nhau
        if (result1 === result2 && result2 === result3) {
            if (result1 === "💎") {
                // NỔ HŨ KIM CƯƠNG (JACKPOT BIG WIN) x50
                winAmount = betAmount * 50;
                resultMessage = `🎉 **JACKPOT KIM CƯƠNG!!!** 🎉\nChúa tể nhân phẩm là đây! Bạn ăn x50 tiền cược.`;
                resultColor = 0x1abc9c; // Xanh ngọc
            } else {
                // Thắng 3 ô thường x5
                winAmount = betAmount * 5;
                resultMessage = `🎊 **TRÚNG ĐẬM!!!** 🎊\nĐẹp trai đấy! Bạn ăn x5 tiền cược.`;
                resultColor = 0x2ecc71; // Xanh lá
            }
        } 
        // Nếu có 2 ô giống nhau kề nhau (An ủi)
        else if (result1 === result2 || result2 === result3) {
            winAmount = Math.floor(betAmount * 1.5); // Lãi nhẹ x1.5
            resultMessage = `✨ **SUÝT THÌ NỔ HŨ!** ✨\nĂn an ủi x1.5 tiền cược nhé!`;
            resultColor = 0x3498db; // Xanh dương
        } 
        // Nếu thua trắng
        else {
            winAmount = 0;
            resultMessage = `💀 **THUA TRẮNG!** 💀\nĐen thôi đỏ quên đi. Số tiền \`${betAmount.toLocaleString()} VND\` đã bay theo chiều gió...`;
        }

        // 6. Cộng tiền nếu thắng và Lưu DB
        if (winAmount > 0) {
            user.money += winAmount;
            await user.save();
            embed.addFields({ name: "💰 Phần Thưởng", value: `\`+${winAmount.toLocaleString()} VND\`` });
        }

        embed.setColor(resultColor);
        embed.setDescription(`**Tiền cược:** \`${betAmount.toLocaleString()} VND\`\n\n${resultMessage}\n\n💳 **Ví hiện tại:** \`${user.money.toLocaleString()} VND\``);

        // Update tin nhắn lần cuối
        await interaction.editReply({ embeds: [embed] });
    }
};