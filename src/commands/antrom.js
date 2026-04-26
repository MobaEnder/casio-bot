const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antrom")
        .setDescription("🕵️ Lẻn vào nhà và hack luôn tài khoản ngân hàng của người khác")
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

        // Khởi tạo giá trị mặc định cho bank nếu chưa có
        const victimBank = victim.bank || 0;
        const victimTotalWealth = victim.money + victimBank;

        // 2. Kiểm tra đối tượng (Nạn nhân phải có tổng tiền > 5k mới trộm được)
        if (!victim || victimTotalWealth < 5000) {
            return interaction.reply({ content: "🤌 Đối tượng này quá nghèo, tổng tài sản không có nổi 5k. Bỏ qua đi!", flags: 64 });
        }

        // 3. Hệ thống Cooldown (2 tiếng = 7,200,000ms)
        const cooldown = 2 * 60 * 60 * 1000;
        const lastThief = thief.lastThief || 0;
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

        if (security === 3) winChance -= 0.30; // Bảo vệ Cao
        else if (security === 2) winChance -= 0.20; // Bảo vệ Trung
        else if (security === 1) winChance -= 0.10; // Bảo vệ Thấp

        if (winChance < 0.05) winChance = 0.05; // Tối thiểu luôn có 5% cơ hội

        const isSuccess = Math.random() < winChance;
        
        // Cập nhật thời gian trộm ngay lập tức
        thief.lastThief = Date.now();

        const embed = new EmbedBuilder().setTimestamp();

        if (isSuccess) {
            // --- THÀNH CÔNG ---
            // Cuỗm 5% - 12% tiền mặt
            const stolenWallet = Math.floor(victim.money * (Math.random() * (0.12 - 0.05) + 0.05)); 
            
            // Hack 2% - 8% tiền trong ngân hàng
            const stolenBank = Math.floor(victimBank * (Math.random() * (0.08 - 0.02) + 0.02)); 
            
            const totalStolen = stolenWallet + stolenBank;

            // Trừ tiền nạn nhân
            victim.money -= stolenWallet;
            victim.bank = victimBank - stolenBank; 
            
            // Cộng tiền cho kẻ trộm (Cộng hết vào tiền mặt)
            thief.money += totalStolen;

            await victim.save();
            await thief.save();

            embed
                .setColor(0x00FF00)
                .setTitle("🥷 PHI VỤ THÀNH CÔNG RỰC RỠ!")
                .setThumbnail("https://i.pinimg.com/736x/6b/0d/ac/6b0dac51c8700766a8146361bb4a84b7.jpg")
                .setDescription(`Bạn đã lẻn vào nhà và hack luôn SmartBanking của <@${targetUser.id}> thành công!`)
                .addFields(
                    { name: "💵 Tiền mặt lấy được", value: `\`+${stolenWallet.toLocaleString()} VND\``, inline: true },
                    { name: "💳 Tiền bank hack được", value: `\`+${stolenBank.toLocaleString()} VND\``, inline: true },
                    { name: "💰 Tổng thu hoạch", value: `\`+${totalStolen.toLocaleString()} VND\``, inline: false },
                    { name: "🏦 Ví hiện tại của bạn", value: `\`${thief.money.toLocaleString()} VND\``, inline: false }
                )
                .setFooter({ text: "Mau chuồn lẹ trước khi chủ nhà check thông báo ngân hàng!" });

            return interaction.reply({ embeds: [embed] });

        } else {
            // --- THẤT BẠI (BỊ BẮT & PHẠT TIỀN NGẪU NHIÊN) ---
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