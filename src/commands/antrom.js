const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antrom")
        .setDescription("🕵️ Lẻn vào nhà và mượn tạm ít tiền của người khác")
        .addUserOption(opt => 
            opt.setName("target")
               .setDescription("Đối tượng xui xẻo bạn muốn nhắm tới")
               .setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("target");

        // 1. Kiểm tra tự trộm
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "❌ Bạn định tự móc túi chính mình à? Đừng ngáo thế chứ!", flags: 64 });
        }

        const thief = await User.findOne({ userId: interaction.user.id });
        const victim = await User.findOne({ userId: targetUser.id });

        // 2. Kiểm tra đối tượng
        if (!victim || victim.money < 5000) {
            return interaction.reply({ content: "🤌 Đối tượng này quá nghèo, ví không có nổi 5k. Bỏ qua đi!", flags: 64 });
        }

        // 3. Kiểm tra Cooldown (2 tiếng)
        const cooldown = 2 * 60 * 60 * 1000;
        if (thief.lastThief && Date.now() - thief.lastThief < cooldown) {
            const remain = Math.ceil((cooldown - (Date.now() - thief.lastThief)) / 60000);
            return interaction.reply({ 
                content: `🚨 **Cảnh sát đang đi tuần!** Bạn đang bị theo dõi, hãy nằm vùng thêm **${remain} phút** nữa.`, 
                flags: 64 
            });
        }

        // 4. Tính toán tỉ lệ thành công
        let winChance = 0.35; // Gốc 35% cho dễ thở chút
        const security = victim.securityLevel || 0;

        if (security === 3) winChance -= 0.30; // Bảo vệ Cao
        else if (security === 2) winChance -= 0.20; // Bảo vệ Trung
        else if (security === 1) winChance -= 0.10; // Bảo vệ Thấp

        if (winChance < 0.05) winChance = 0.05; // Tối thiểu 5%

        const isSuccess = Math.random() < winChance;
        thief.lastThief = Date.now();

        const embed = new EmbedBuilder().setTimestamp();

        if (isSuccess) {
            // THÀNH CÔNG
            const stolenAmount = Math.floor(victim.money * (Math.random() * (0.12 - 0.05) + 0.05)); // Trộm ngẫu nhiên 5-12%
            victim.money -= stolenAmount;
            thief.money += stolenAmount;

            await victim.save();
            await thief.save();

            embed
                .setColor(0x00FF00) // Màu xanh lá
                .setTitle("🥷 PHI VỤ THÀNH CÔNG RỰC RỠ!")
                .setThumbnail("https://i.pinimg.com/736x/6b/0d/ac/6b0dac51c8700766a8146361bb4a84b7.jpg") // Link ảnh icon trộm (nếu có)
                .setDescription(`Bạn đã lẻn vào nhà <@${targetUser.id}> một cách êm đềm...`)
                .addFields(
                    { name: "💰 Tiền vớ được", value: `\`${stolenAmount.toLocaleString()} VND\``, inline: true },
                    { name: "🏦 Ví hiện tại", value: `\`${thief.money.toLocaleString()} VND\``, inline: true }
                )
                .setFooter({ text: "Đừng để bị bắt ở lần sau nhé!" });

            return interaction.reply({ embeds: [embed] });

        } else {
            // THẤT BẠI
            const fine = 50000; // Phạt cố định hoặc % tùy bạn
            thief.money -= fine;
            if (thief.money < 0) thief.money = 0; // Không cho tiền âm

            await thief.save();

            embed
                .setColor(0xFF0000) // Màu đỏ
                .setTitle("🚔 BẠN ĐÃ BỊ CẢNH SÁT BẮT!")
                .setThumbnail("https://www.thanglongwaterpuppet.org/wp-content/uploads/2025/10/1_chu-ao-xanh-xuat-hien-trong-meme-khien-tinh-huong-nho-nhat-tro-nen-vui-nhon.jpg") // Link ảnh icon cảnh sát
                .setDescription(`Đen quá! <@${targetUser.id}> đã lắp camera ẩn và báo cảnh sát tóm sống bạn.`)
                .addFields(
                    { name: "💸 Tiền phạt", value: `\`${fine.toLocaleString()} VND\``, inline: true },
                    { name: "📉 Số dư còn lại", value: `\`${thief.money.toLocaleString()} VND\``, inline: true }
                )
                .setFooter({ text: "Cơm tù có vẻ ngon đấy!" });

            return interaction.reply({ embeds: [embed] });
        }
    }
};