const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed, sleep } = require("../utils/ui");

// --- BIỂU TƯỢNG SLOT ---
const SLOTS = ["🍒", "🍇", "🍉", "🍓", "🍀", "🔔", "💖", "💎"];
const SPIN = "🌀";

const getRandomSlot = () => SLOTS[Math.floor(Math.random() * SLOTS.length)];

// Máy slot khung đẹp, có hàng mờ trên/dưới như máy thật
function renderMachine(e1, e2, e3, spinning = false) {
    const blur = () => (spinning ? getRandomSlot() : "▪️");
    return (
        `╔══════ 🎰 ══════╗\n` +
        `║  ${blur()} ┊ ${blur()} ┊ ${blur()}  ║\n` +
        `║ ▸ ${e1} ┊ ${e2} ┊ ${e3} ◂ ║\n` +
        `║  ${blur()} ┊ ${blur()} ┊ ${blur()}  ║\n` +
        `╚═════════════════╝`
    );
}

// Bảng tỉ lệ hiển thị cho người chơi
const PAYTABLE =
    "💎💎💎 → **x50** 🏆\n" +
    "3 ô giống nhau → **x5**\n" +
    "2 ô kề giống nhau → **x1.5**";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jackpot")
        .setDescription("🎰 Nổ hũ đổi đời - Nhập số tiền và xem nhân phẩm")
        .addIntegerOption((opt) =>
            opt.setName("tiencuoc")
                .setDescription("Số tiền muốn mang đi cược (Tối thiểu 5,000 VND)")
                .setRequired(true)
                .setMinValue(5000)
        ),

    async execute(interaction) {
        const betAmount = interaction.options.getInteger("tiencuoc");
        await interaction.deferReply();

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < betAmount) {
            return interaction.editReply({
                embeds: [casinoEmbed({
                    color: COLORS.red,
                    title: "❌ KHÔNG ĐỦ VỐN",
                    description: `Khố rách áo ôm mà đòi chơi sang!\n💳 Ví của bạn: ${vnd(user?.money || 0)}`,
                })],
            });
        }
        if (user.banned) return interaction.editReply({ content: "🚫 Bạn bị cấm cược!" });

        user.money -= betAmount;
        await user.save();

        const r1 = getRandomSlot(), r2 = getRandomSlot(), r3 = getRandomSlot();

        const baseEmbed = () =>
            casinoEmbed({ color: COLORS.gold, title: `🎰 MÁY NỔ HŨ CỦA ${interaction.user.username.toUpperCase()}` });

        // 🎬 Hiệu ứng quay từng ô
        const frames = [
            [SPIN, SPIN, SPIN, 900],
            [r1, SPIN, SPIN, 900],
            [r1, r2, SPIN, 1400],
        ];
        for (const [a, b, c, ms] of frames) {
            await interaction.editReply({
                embeds: [baseEmbed().setDescription(
                    `💵 Tiền cược: ${vnd(betAmount)}\n\`\`\`\n${renderMachine(a, b, c, true)}\n\`\`\`\n⏳ *Đang quay... cầu nguyện đi!*`
                )],
            });
            await sleep(ms);
        }

        // 🧮 Tính thưởng (giữ nguyên tỉ lệ gốc)
        let winAmount = 0, title, flavor, color;
        if (r1 === r2 && r2 === r3) {
            if (r1 === "💎") {
                winAmount = betAmount * 50;
                title = "💎💎💎 JACKPOT KIM CƯƠNG!!! 💎💎💎";
                flavor = "🎆 CHÚA TỂ NHÂN PHẨM LÀ ĐÂY! Cả sòng quỳ rạp!";
                color = COLORS.cyan;
            } else {
                winAmount = betAmount * 5;
                title = "🎊 TRÚNG ĐẬM — 3 Ô GIỐNG NHAU! 🎊";
                flavor = "Đẹp trai đấy! Hôm nay ra đường nên mua vé số.";
                color = COLORS.green;
            }
        } else if (r1 === r2 || r2 === r3) {
            winAmount = Math.floor(betAmount * 1.5);
            title = "✨ SUÝT THÌ NỔ HŨ! ✨";
            flavor = "Thiếu đúng 1 ô... nhận an ủi x1.5 nhé!";
            color = COLORS.blue;
        } else {
            title = "💀 THUA TRẮNG 💀";
            flavor = `Đen thôi, đỏ quên đi. ${vnd(betAmount)} đã bay theo chiều gió...`;
            color = COLORS.red;
        }

        if (winAmount > 0) {
            user.money += winAmount;
            if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
            await user.save();
        } else if (user.stats) {
            user.stats.lose++; user.stats.gamblePlayed++;
            await user.save();
        }

        const profit = winAmount - betAmount;
        const resultEmbed = casinoEmbed({ color, title })
            .setDescription(
                `\`\`\`\n${renderMachine(r1, r2, r3)}\n\`\`\`\n${flavor}`
            )
            .addFields(
                { name: "💵 Tiền cược", value: vnd(betAmount), inline: true },
                { name: winAmount > 0 ? "💰 Nhận về" : "🕳️ Mất trắng", value: winAmount > 0 ? `**+${money(winAmount)}** (lãi ${profit >= 0 ? "+" : ""}${money(profit)})` : `-${money(betAmount)}`, inline: true },
                { name: "💳 Ví hiện tại", value: vnd(user.money), inline: true },
                { name: "📋 Bảng thưởng", value: PAYTABLE }
            )
            .setFooter({ text: "🎰 Gõ /jackpot để thử vận may tiếp!" });

        await interaction.editReply({ embeds: [resultEmbed] });
    },
};