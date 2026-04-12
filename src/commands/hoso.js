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

        // 🎨 Thiết lập màu sắc dựa trên danh hiệu hoặc ngẫu nhiên
        const colors = [0xFF5733, 0x33FF57, 0x3357FF, 0xF333FF, 0xFFF333];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // 🏆 Xử lý Danh hiệu & Bùa chú
        const title = user.titles?.active || "Dân Thường";
        const luckBuff = user.buffs?.winRateBoost > 0 ? `🍀 Luck +${user.buffs.winRateBoost * 100}%` : "Không có";
        const shieldBuff = user.buffs?.shield > 0 ? `🛡️ Khiên -${user.buffs.shield * 100}%` : "Không có";
        
        // 👮 Bảo vệ
        const guards = ["❌ Trống", "💂 Cận Vệ Tập Sự", "🎖️ Đặc Nhiệm Hoàng Gia"];
        const currentGuard = guards[user.securityLevel || 0];

        // 📊 Tính tỉ lệ thắng
        const totalGamble = user.stats.win + user.stats.lose;
        const winRate = totalGamble > 0 ? ((user.stats.win / totalGamble) * 100).toFixed(1) : 0;

        const profileEmbed = new EmbedBuilder()
            .setColor(randomColor)
            .setTitle(`✨ HỒ SƠ CỦA ${target.username.toUpperCase()} ✨`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setDescription(`> *"${title}"*`) // Hiển thị danh hiệu ngay dưới tên
            .addFields(
                { 
                    name: "💰 Tài Chính", 
                    value: `💵 **Tiền mặt:** \`${user.money.toLocaleString()} VND\`\n🏦 **Ngân hàng:** \`${user.bank.toLocaleString()} VND\``,
                    inline: false 
                },
                { 
                    name: "🧿 Trang Bị Đang Dùng", 
                    value: `✨ **Bùa Luck:** ${luckBuff}\n🔰 **Bùa Khiên:** ${shieldBuff}\n🛡️ **Bảo vệ:** ${currentGuard}`,
                    inline: false 
                },
                { 
                    name: "📈 Thống Kê Casino", 
                    value: `✅ **Thắng:** ${user.stats.win}\n❌ **Thua:** ${user.stats.lose}\n📊 **Tỉ lệ thắng:** ${winRate}%`,
                    inline: true 
                },
                { 
                    name: "🏮 Thông Tin Khác", 
                    value: `💳 **Nợ:** ${user.loan?.active ? `${user.loan.amount.toLocaleString()} VND` : "Không nợ"}\n📅 **Ngày tham gia:** <t:${Math.floor(user.createdAt / 1000)}:R>`,
                    inline: true 
                }
            )
            .setImage("https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/2023_10_30_638342953175094393_profile-la-gi-thmb.jpg") // Link ảnh trang trí nếu có, hoặc dùng Canvas để vẽ
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [profileEmbed] });
    }
};