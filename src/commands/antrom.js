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

        // 2. Kiểm tra đối tượng (Nạn nhân phải có tiền mới trộm được)
        if (!victim || victim.money < 5000) {
            return interaction.reply({ content: "🤌 Đối tượng này quá nghèo, ví không có nổi 5k. Bỏ qua đi!", flags: 64 });
        }

        // 3. Hệ thống Cooldown (2 tiếng = 7,200,000ms)
        const cooldown = 2 * 60 * 60 * 1000;
        const lastThief = thief.lastThief || 0; // Nếu chưa trộm bao giờ thì mặc định là 0
        const timePassed = Date.now() - lastThief;

        if (timePassed < cooldown) {
            const timeLeft = cooldown - timePassed;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            return interaction.reply({ 
                content: `🚨 **Cảnh sát đang tuần tra gắt gao!** Bạn đang bị đưa vào danh sách đen, hãy nằm vùng thêm **${hours} giờ ${minutes} phút** nữa.`, 
                flags: 64 
            });
        }

        // 4. Tính toán tỉ lệ thành công dựa trên Bảo Vệ của nạn nhân
        let winChance = 0.35; // Tỉ lệ gốc 35%
        const security = victim.securityLevel || 0;

        if (security === 3) winChance -= 0.30; // Bảo vệ Cao (Còn 5%)
        else if (security === 2) winChance -= 0.20; // Bảo vệ Trung (Còn 15%)
        else if (security === 1) winChance -= 0.10; // Bảo vệ Thấp (Còn 25%)

        if (winChance < 0.05) winChance = 0.05; // Tối thiểu luôn có 5% cơ hội

        const isSuccess = Math.random() < winChance;
        
        // Cập nhật thời gian trộm ngay lập tức
        thief.lastThief = Date.now();

        const embed = new EmbedBuilder().setTimestamp();

        if (isSuccess) {
            // --- THÀNH CÔNG ---
            const stolenAmount = Math.floor(victim.money * (Math.random() * (0.12 - 0.05) + 0.05)); 
            victim.money -= stolenAmount;
            thief.money += stolenAmount;

            await victim.save();
            await thief.save();

            embed
                .setColor(0x00FF00)
                .setTitle("🥷 PHI VỤ THÀNH CÔNG RỰC RỠ!")
                .setThumbnail("https://i.pinimg.com/736x/6b/0d/ac/6b0dac51c8700766a8146361bb4a84b7.jpg")
                .setDescription(`Bạn đã lẻn vào nhà <@${targetUser.id}> và khoét vách thành công!`)
                .addFields(
                    { name: "💰 Tiền vớ được", value: `\`+${stolenAmount.toLocaleString()} VND\``, inline: true },
                    { name: "🏦 Ví hiện tại", value: `\`${thief.money.toLocaleString()} VND\``, inline: true }
                )
                .setFooter({ text: "Mau chuồn lẹ trước khi chủ nhà thức dậy!" });

            return interaction.reply({ embeds: [embed] });

} else {
    // --- THẤT BẠI (BỊ BẮT & PHẠT TIỀN NGẪU NHIÊN) ---
    
    // Công thức: Math.floor(Math.random() * (max - min + 1)) + min
    const fine = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000; 
    
    thief.money -= fine; // Trừ tiền (có thể xuống số âm)

    await thief.save();

    embed
        .setColor(0xFF0000)
        .setTitle("🚔 BẠN ĐÃ BỊ CÔNG AN TÓM!")
                .setThumbnail("https://www.thanglongwaterpuppet.org/wp-content/uploads/2025/10/1_chu-ao-xanh-xuat-hien-trong-meme-khien-tinh-huong-nho-nhat-tro-nen-vui-nhon.jpg")
                .setDescription(`Đen thôi đỏ quên đi! <@${targetUser.id}> đã mai phục sẵn và tóm sống bạn giao cho đồn cảnh sát.`)
                .addFields(
                    { name: "💸 Tiền phạt", value: `\`-${fine.toLocaleString()} VND\``, inline: true },
                    { name: "📉 Tình trạng ví", value: `\`${thief.money.toLocaleString()} VND\` ${thief.money < 0 ? "(NỢ 💸)" : ""}`, inline: true }
                )
                .setFooter({ text: "Lao động là vinh quang, hãy /work để trả nợ nhé!" });

            return interaction.reply({ embeds: [embed] });
        }
    }
};