const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const SPIN_COST = 50000; // Giá mua thêm lượt
const FREE_COOLDOWN = 24 * 60 * 60 * 1000;

// 🎡 BÁNH XE GIẢI THƯỞNG (weight = tỉ lệ) — chỉnh tùy ý
const WHEEL = [
    { label: "💸 20.000 VND", weight: 25, apply: (u) => { u.money += 20000; return "+20.000 VND"; } },
    { label: "💵 50.000 VND", weight: 20, apply: (u) => { u.money += 50000; return "+50.000 VND"; } },
    { label: "💰 100.000 VND", weight: 14, apply: (u) => { u.money += 100000; return "+100.000 VND"; } },
    { label: "🤑 300.000 VND", weight: 6, apply: (u) => { u.money += 300000; return "+300.000 VND"; } },
    { label: "💎 1.000.000 VND", weight: 2, apply: (u) => { u.money += 1000000; return "+1.000.000 VND — GIẢI ĐẶC BIỆT!"; } },
    { label: "🎫 +3 Lượt Tháp", weight: 10, apply: (u) => { u.towerAttempts = (u.towerAttempts || 0) + 3; return "+3 lượt leo tháp"; } },
    { label: "🍀 Bùa Luck +10%", weight: 8, apply: (u) => { if (!u.buffs) u.buffs = {}; u.buffs.winRateBoost = Math.max(u.buffs.winRateBoost || 0, 0.10); u.markModified("buffs"); return "Bùa Luck +10% ván tới"; } },
    { label: "🔰 Khiên 30%", weight: 8, apply: (u) => { if (!u.buffs) u.buffs = {}; u.buffs.shield = Math.max(u.buffs.shield || 0, 0.30); u.markModified("buffs"); return "Khiên giảm 30% tiền thua ván tới"; } },
    { label: "💨 Trượt...", weight: 7, apply: () => "Không trúng gì... chúc may mắn lần sau! 🥲" },
];

function spinWheel() {
    const total = WHEEL.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (const prize of WHEEL) {
        if ((r -= prize.weight) <= 0) return prize;
    }
    return WHEEL[0];
}

function wheelDisplay(highlightIdx = -1) {
    return WHEEL.map((p, i) => `${i === highlightIdx ? "▶️ **" : "▫️ "}${p.label}${i === highlightIdx ? "** ◀️" : ""}`).join("\n");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vongquay")
        .setDescription("🎡 Vòng Quay May Mắn - 1 lượt MIỄN PHÍ mỗi ngày!"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        const freeReady = Date.now() - (user.lastSpin || 0) >= FREE_COOLDOWN;

        const embed = casinoEmbed({ color: COLORS.purple, title: "🎡 ✦ VÒNG QUAY MAY MẮN ✦ 🎡" })
            .setDescription(
                `> 🆓 Lượt miễn phí: ${freeReady ? "**SẴN SÀNG!** 🟢" : `hồi lại ${countdown((user.lastSpin || 0) + FREE_COOLDOWN)} 🔴`}\n` +
                `> 💵 Mua thêm lượt: \`${money(SPIN_COST)} VND\`/lượt (không giới hạn)\n${"─".repeat(25)}\n` +
                `**🎁 BẢNG GIẢI THƯỞNG:**\n${wheelDisplay()}`
            )
            .setFooter({ text: "🎡 Quay là có quà (trừ khi... trượt 😅)" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vongquay_free").setLabel("Quay Miễn Phí").setEmoji("🆓").setStyle(ButtonStyle.Success).setDisabled(!freeReady),
            new ButtonBuilder().setCustomId("vongquay_paid").setLabel(`Quay ${money(SPIN_COST)}`).setEmoji("💵").setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const mode = interaction.customId.split("_")[1];
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (mode === "free") {
            if (Date.now() - (user.lastSpin || 0) < FREE_COOLDOWN) {
                return interaction.reply({ content: `⏳ Lượt free của bạn hồi lại ${countdown((user.lastSpin || 0) + FREE_COOLDOWN)}!`, flags: 64 });
            }
            user.lastSpin = Date.now();
        } else {
            if (user.money < SPIN_COST) return interaction.reply({ content: `❌ Cần ${vnd(SPIN_COST)} để mua lượt quay! Ví còn ${vnd(user.money)}.`, flags: 64 });
            user.money -= SPIN_COST;
        }
        await user.save();

        // 🎬 ANIMATION QUAY: nhảy ngẫu nhiên rồi dừng ở giải
        const prize = spinWheel();
        const prizeIdx = WHEEL.indexOf(prize);

        await interaction.reply({
            embeds: [casinoEmbed({ color: COLORS.orange, title: `🎡 ${interaction.user.username} ĐANG QUAY...` })
                .setDescription(wheelDisplay(Math.floor(Math.random() * WHEEL.length)))],
        });
        for (let i = 0; i < 3; i++) {
            await sleep(900);
            await safeEdit(interaction, {
                embeds: [casinoEmbed({ color: COLORS.orange, title: `🎡 ${interaction.user.username} ĐANG QUAY...` })
                    .setDescription(wheelDisplay(Math.floor(Math.random() * WHEEL.length)))],
            });
        }
        await sleep(900);

        // Áp dụng giải
        const freshUser = await User.findOne({ userId: interaction.user.id });
        const resultText = prize.apply(freshUser);
        await freshUser.save();

        const isMiss = prize.label.includes("Trượt");
        await safeEdit(interaction, {
            embeds: [casinoEmbed({
                color: isMiss ? COLORS.dark : COLORS.gold,
                title: isMiss ? "💨 TRƯỢT MẤT RỒI..." : "🎉 CHÚC MỪNG TRÚNG THƯỞNG!",
            })
                .setDescription(
                    `${wheelDisplay(prizeIdx)}\n${"─".repeat(25)}\n` +
                    `# ${prize.label}\n> 🎁 ${resultText}\n> 💼 Ví hiện tại: ${vnd(freshUser.money)}`
                )
                .setFooter({ text: mode === "free" ? "🆓 Lượt free mai lại có • Mua thêm lượt để quay tiếp!" : "💵 Gõ /vongquay để quay tiếp!" })],
        });
    },
};