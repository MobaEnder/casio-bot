const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// --- HÀM TÍNH DPS (Phải đồng nhất với logic trong /tuido) ---
function calculateDPS(card) {
    const level = card.level || 1;
    const base = (card.hp * 0.1) + (card.atk * 2) + (card.def * 1.5) + (card.mdef * 1.5) + (card.spd * 5);
    const offensive = (card.atkSpd * 100) * (1 + (card.critRate / 100) * (card.critDmg / 100));
    return Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
}

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

        // 1. LOGIC TÍNH LÃI SUẤT NGÂN HÀNG
        let interest = 0;
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const ms = Date.now() - new Date(user.lastDepositAt).getTime();
            const hours = ms / (1000 * 60 * 60);
            if (hours >= 1) {
                interest = Math.floor(user.bankMoney * (Math.pow(1.04, Math.floor(hours)) - 1));
            }
        }
        const totalInBank = user.bankMoney + interest;

        // 2. LOGIC TÌM THẺ BÀI MẠNH NHẤT
        let strongestCardInfo = "Chưa có thẻ bài";
        if (user.cards && user.cards.length > 0) {
            // Sắp xếp thẻ theo DPS giảm dần
            const sortedCards = [...user.cards].sort((a, b) => calculateDPS(b) - calculateDPS(a));
            const topCard = sortedCards[0];
            const topDps = calculateDPS(topCard);
            strongestCardInfo = `🎴 **${topCard.name}** (Lv.${topCard.level || 1})\n🔥 Lực chiến: \`${topDps.toLocaleString()}\``;
        }

        // 3. THIẾT LẬP HIỂN THỊ
        let profileColor = user.banned ? 0xFF0000 : 0x00ff99;
        const title = user.titles?.active || "Dân Thường";
        const luckBuff = user.buffs?.winRateBoost > 0 ? `🍀 Luck +${user.buffs.winRateBoost * 100}%` : "Không có";
        const shieldBuff = user.buffs?.shield > 0 ? `🛡️ Khiên -${user.buffs.shield * 100}%` : "Không có";
        
        const guards = ["❌ Trống", "💂 Cận Vệ Tập Sự", "🎖️ Đặc Nhiệm Hoàng Gia"];
        const currentGuard = guards[user.securityLevel || 0];

        const stats = user.stats || { win: 0, lose: 0 };
        const totalGamble = stats.win + stats.lose;
        const winRate = totalGamble > 0 ? ((stats.win / totalGamble) * 100).toFixed(1) : 0;

        let loanInfo = "✅ Sạch nợ";
        if (user.loan && user.loan.active) {
            loanInfo = `⚠️ **Nợ:** \`${user.loan.amount.toLocaleString()} VND\`\n` +
                       `👤 **Chủ nợ:** <@${user.loan.from}>`;
        }

        // 4. TẠO EMBED
        const profileEmbed = new EmbedBuilder()
            .setColor(profileColor)
            .setTitle(`✨ HỒ SƠ CỦA ${target.username.toUpperCase()} ✨`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setDescription(user.banned ? "🚫 **TÀI KHOẢN ĐANG BỊ PHONG TỎA (BANNED)**" : `> *"${title}"*`)
            .addFields(
                { 
                    name: "💰 Tài Chính", 
                    value: `💵 **Tiền mặt:** \`${user.money.toLocaleString()} VND\`\n` +
                           `🏦 **Ngân hàng:** \`${totalInBank.toLocaleString()} VND\``,
                    inline: false 
                },
                { 
                    name: "🏰 Chinh Phục Tháp", 
                    value: `🚩 **Tầng hiện tại:** \`${user.towerFloor || 1}/150\`\n⚡ **Lượt hôm nay:** \`${user.towerAttempts || 0}\``,
                    inline: true 
                },
                { 
                    name: "⚔️ Thẻ Bài Mạnh Nhất", 
                    value: strongestCardInfo,
                    inline: true 
                },
                { 
                    name: "🧿 Trang Bị & Bảo Vệ", 
                    value: `✨ **Bùa:** ${luckBuff} | ${shieldBuff}\n🛡️ **Vệ sĩ:** ${currentGuard}`,
                    inline: false 
                },
                { 
                    name: "📈 Thống Kê Casino", 
                    value: `✅ Win: ${stats.win} | ❌ Lose: ${stats.lose}\n📊 Tỉ lệ: ${winRate}%`,
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

        await interaction.reply({ embeds: [profileEmbed] });
    }
};