const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, bar, casinoEmbed } = require("../utils/ui");
const { ACHIEVEMENTS } = require("./thanhtuu");

// --- HÀM TÍNH DPS (đồng nhất với /tuido) ---
function calculateDPS(card) {
    const level = card.level || 1;
    const base = card.hp * 0.1 + card.atk * 2 + card.def * 1.5 + card.mdef * 1.5 + card.spd * 5;
    const offensive = card.atkSpd * 100 * (1 + (card.critRate / 100) * (card.critDmg / 100));
    return Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
}

// Đẳng cấp đại gia theo tổng tài sản
function wealthTier(total) {
    if (total >= 1_000_000_000) return { icon: "👑", name: "HUYỀN THOẠI SÒNG BÀI", color: COLORS.gold };
    if (total >= 500_000_000) return { icon: "💎", name: "ĐẠI GIA KIM CƯƠNG", color: COLORS.cyan };
    if (total >= 100_000_000) return { icon: "🏆", name: "TRÙM BẠCH KIM", color: COLORS.purple };
    if (total >= 20_000_000) return { icon: "🥇", name: "TAY CHƠI VÀNG", color: COLORS.gold };
    if (total >= 5_000_000) return { icon: "🥈", name: "DÂN CHƠI BẠC", color: COLORS.blue };
    if (total >= 1_000_000) return { icon: "🥉", name: "TẬP SỰ ĐỒNG", color: COLORS.orange };
    return { icon: "🌱", name: "TÂN THỦ CHÂN ƯỚT", color: COLORS.green };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("hoso")
        .setDescription("📂 Xem hồ sơ cá nhân siêu cấp VIP Pro")
        .addUserOption((option) =>
            option.setName("user").setDescription("Người bạn muốn xem hồ sơ (để trống để xem chính mình)")
        ),

    async execute(interaction) {
        const target = interaction.options.getUser("user") || interaction.user;
        const user = await User.findOne({ userId: target.id });

        if (!user) {
            return interaction.reply({ content: "❌ Người này chưa từng tham gia casino!", flags: 64 });
        }

        // 1. LÃI SUẤT NGÂN HÀNG (giữ nguyên công thức)
        let interest = 0;
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const ms = Date.now() - new Date(user.lastDepositAt).getTime();
            const hours = ms / (1000 * 60 * 60);
            if (hours >= 1) {
                interest = Math.floor(user.bankMoney * (Math.pow(1.008, Math.floor(hours)) - 1));
            }
        }
        const totalInBank = user.bankMoney + interest;
        const netWorth = user.money + totalInBank;
        const tier = wealthTier(netWorth);

        // 2. THẺ BÀI MẠNH NHẤT
        let strongestCardInfo = "🎴 *Chưa có thẻ bài*";
        if (user.cards && user.cards.length > 0) {
            const sortedCards = [...user.cards].sort((a, b) => calculateDPS(b) - calculateDPS(a));
            const topCard = sortedCards[0];
            strongestCardInfo = `🎴 **${topCard.name}** (Lv.${topCard.level || 1})\n🔥 Lực chiến: \`${money(calculateDPS(topCard))}\`\n🗂️ Bộ sưu tập: **${user.cards.length}** thẻ`;
        }

        // 3. DỮ LIỆU HIỂN THỊ
        const title = user.titles?.active || "Dân Thường";
        const luckBuff = user.buffs?.winRateBoost > 0 ? `🍀 Luck +${user.buffs.winRateBoost * 100}%` : "—";
        const shieldBuff = user.buffs?.shield > 0 ? `🔰 Khiên -${user.buffs.shield * 100}%` : "—";
        const guards = ["❌ Trống", "💂 Cận Vệ Tập Sự", "🎖️ Đặc Nhiệm Hoàng Gia"];
        const currentGuard = guards[user.securityLevel || 0];

        const stats = user.stats || { win: 0, lose: 0 };
        const totalGamble = stats.win + stats.lose;
        const winRate = totalGamble > 0 ? (stats.win / totalGamble) * 100 : 0;

        let loanInfo = "✅ Sạch nợ — uy tín đầy mình";
        if (user.loan && user.loan.active) {
            loanInfo = `⚠️ **Nợ:** \`${money(user.loan.amount)} VND\`\n👤 **Chủ nợ:** <@${user.loan.from}>`;
        }

        // 4. EMBED
        const profileEmbed = casinoEmbed({
            color: user.banned ? COLORS.red : tier.color,
            title: `${tier.icon} HỒ SƠ CỦA ${target.username.toUpperCase()} ${tier.icon}`,
        })
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setDescription(
                user.banned
                    ? "# 🚫 TÀI KHOẢN BỊ PHONG TỎA"
                    : (() => {
                        const dispId = user.achievements?.displayed;
                        const badge = dispId ? ACHIEVEMENTS.find((a) => a.id === dispId)?.badge : null;
                        return `> 🎖️ Danh hiệu: **"${title}"**${badge ? `\n> 🏅 Huy hiệu: **${badge}**` : ""}\n> ${tier.icon} Đẳng cấp: **${tier.name}**\n> ⭐ Cấp độ chat: **Lv.${user.level || 1}** (${user.exp || 0} EXP)\n> 💎 Tổng tài sản: **\`${money(netWorth)} VND\`**`;
                    })()
            )
            .addFields(
                {
                    name: "💰 Tài Chính",
                    value: `💵 Tiền mặt: \`${money(user.money)}\`\n🏦 Ngân hàng: \`${money(totalInBank)}\`${interest > 0 ? `\n📈 *(gồm lãi +${money(interest)})*` : ""}`,
                    inline: true,
                },
                {
                    name: "🏰 Tháp Vô Tận",
                    value: `🚩 Tầng: **${user.towerFloor || 1}**/150\n${bar((user.towerFloor || 1) / 150, 8, "🟩", "⬛")}\n⚡ Lượt hôm nay: **${user.towerAttempts || 0}**`,
                    inline: true,
                },
                {
                    name: "⚔️ Át Chủ Bài",
                    value: strongestCardInfo,
                    inline: true,
                },
                {
                    name: "📈 Chiến Tích Casino",
                    value: `✅ Thắng **${stats.win}** • ❌ Thua **${stats.lose}**\n${bar(winRate / 100, 10, "🟩", "🟥")} **${winRate.toFixed(1)}%**`,
                    inline: true,
                },
                {
                    name: "🧿 Trang Bị",
                    value: `${luckBuff}\n${shieldBuff}\n🛡️ Vệ sĩ: ${currentGuard}`,
                    inline: true,
                },
                {
                    name: "🏮 Tín Dụng",
                    value: loanInfo,
                    inline: true,
                }
            )
            .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [profileEmbed] });
    },
};