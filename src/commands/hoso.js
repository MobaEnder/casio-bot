const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hoso")
        .setDescription("📂 Xem hồ sơ cá nhân siêu cấp VIP Pro")
        .addUserOption(option => 
            option.setName("user")
                .setDescription("Người bạn muốn xem hồ sơ (để trống để xem chính mình)")),

    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const user = await User.findOne({ userId: target.id });

        if (!user) {
            return interaction.reply({ content: "❌ Người này chưa từng tham gia casino!", flags: 64 });
        }

        // 🎨 Thiết lập màu sắc (Đổi màu đỏ nếu bị BAN)
        let profileColor = 0x00ff99; 
        if (user.banned) profileColor = 0xFF0000;

        // 🏆 Xử lý Danh hiệu & Bùa chú
        const title = user.titles?.active || "Dân Thường";
        const luckBuff = user.buffs?.winRateBoost > 0 ? `🍀 Luck +${user.buffs.winRateBoost * 100}%` : "Không có";
        const shieldBuff = user.buffs?.shield > 0 ? `🛡️ Khiên -${user.buffs.shield * 100}%` : "Không có";
        
        // 👮 Bảo vệ
        const guards = ["❌ Trống", "💂 Cận Vệ Tập Sự", "🎖️ Đặc Nhiệm Hoàng Gia"];
        const currentGuard = guards[user.securityLevel || 0];

        // 📊 Tính tỉ lệ thắng
        const stats = user.stats || { win: 0, lose: 0 };
        const totalGamble = stats.win + stats.lose;
        const winRate = totalGamble > 0 ? ((stats.win / totalGamble) * 100).toFixed(1) : 0;

        // 🏦 Xử lý Nợ (Cập nhật mới)
        let loanInfo = "✅ Sạch nợ";
        if (user.loan && user.loan.active) {
            loanInfo = `⚠️ **Nợ:** \`${user.loan.amount.toLocaleString()} VND\`\n` +
                       `👤 **Chủ nợ:** <@${user.loan.from}>\n` +
                       `⏰ **Hạn:** <t:${Math.floor(user.loan.dueAt.getTime() / 1000)}:R>`;
        }

        const profileEmbed = new EmbedBuilder()
            .setColor(profileColor)
            .setTitle(`✨ HỒ SƠ CỦA ${target.username.toUpperCase()} ✨`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setDescription(user.banned ? "🚫 **TÀI KHOẢN ĐANG BỊ PHONG TỎA (BANNED)**" : `> *"${title}"*`)
            .addFields(
                { 
                    name: "💰 Tài Chính", 
                    value: `💵 **Tiền mặt:** \`${user.money.toLocaleString()} VND\`\n🏦 **Ngân hàng:** \`${(user.bank || 0).toLocaleString()} VND\``,
                    inline: false 
                },
                { 
                    name: "🧿 Trang Bị & Bảo Vệ", 
                    value: `✨ **Bùa Luck:** ${luckBuff}\n🔰 **Bùa Khiên:** ${shieldBuff}\n🛡️ **Bảo vệ:** ${currentGuard}`,
                    inline: false 
                },
                { 
                    name: "📈 Thống Kê Casino", 
                    value: `✅ **Thắng:** ${stats.win}\n❌ **Thua:** ${stats.lose}\n📊 **Tỉ lệ:** ${winRate}%`,
                    inline: true 
                },
                { 
                    name: "🏮 Thông Tin Nợ", 
                    value: loanInfo,
                    inline: true 
                }
            )
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        // Nếu bạn muốn bỏ cái ảnh to đùng ở dưới cho gọn thì xóa dòng setImage này
        // profileEmbed.setImage("https://your-image-link.jpg");

        await interaction.reply({ embeds: [profileEmbed] });
    }
};