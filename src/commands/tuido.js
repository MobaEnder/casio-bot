const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed } = require("../utils/ui");

// --- 1. TÍNH TỔNG LỰC CHIẾN (GIỮ NGUYÊN) ---
function calculateDPS(card) {
    const level = card.level || 1;
    const base = card.hp * 0.1 + card.atk * 2 + card.def * 1.5 + card.mdef * 1.5 + card.spd * 5;
    const offensive = card.atkSpd * 100 * (1 + (card.critRate / 100) * (card.critDmg / 100));
    return Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
}

// --- 2. QUAY CHỈ SỐ (GIỮ NGUYÊN) ---
function rollStat(baseValue) {
    const min = baseValue * 0.7;
    const max = baseValue * 1.3;
    let result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (Math.random() < 0.05) result = Math.floor(max * 1.5);
    return parseFloat(result.toFixed(2));
}

// Độ hiếm theo DPS
function rarity(dps) {
    if (dps >= 8000) return { tag: "🌈 SSR", color: COLORS.gold };
    if (dps >= 5000) return { tag: "🟣 SR", color: COLORS.purple };
    if (dps >= 3000) return { tag: "🔵 R", color: COLORS.blue };
    if (dps >= 1500) return { tag: "🟢 UC", color: COLORS.green };
    return { tag: "⚪ C", color: COLORS.dark };
}

// --- 3. EMBED CHI TIẾT THẺ (nâng cấp giao diện) ---
function createDetailEmbed(card, ownerName, resultMsg = "") {
    const dps = calculateDPS(card);
    const level = card.level || 1;
    const exp = card.exp || 0;
    const nextExp = level * 1000;
    const r = rarity(dps);

    return casinoEmbed({
        color: resultMsg.includes("✅") ? COLORS.green : resultMsg.includes("❌") ? COLORS.red : r.color,
        title: `🃏 ${card.name.toUpperCase()} ${r.tag} [Lv.${level}]`,
    })
        .setDescription(
            (resultMsg ? `${resultMsg}\n${"─".repeat(25)}\n` : "") +
            `# 🔥 DPS: ${money(dps)}\n` +
            `⭐ **Cấp độ:** \`${level}/100\`\n` +
            `💠 **EXP:** \`${exp}/${nextExp}\`\n${bar(exp / nextExp, 12, "🟦", "⬛")}`
        )
        .addFields(
            { name: "❤️ HP", value: `\`${card.hp}\``, inline: true },
            { name: "⚔️ ATK", value: `\`${card.atk}\``, inline: true },
            { name: "🛡️ DEF", value: `\`${card.def}\``, inline: true },
            { name: "🔰 MDEF", value: `\`${card.mdef}\``, inline: true },
            { name: "👟 SPD", value: `\`${card.spd}\``, inline: true },
            { name: "⚡ ASPD", value: `\`${card.atkSpd}\``, inline: true },
            { name: "🎯 CRIT", value: `\`${card.critRate}%\``, inline: true },
            { name: "💥 CDMG", value: `\`${card.critDmg}%\``, inline: true },
            { name: "\u200b", value: "\u200b", inline: true }
        )
        .setFooter({ text: "🗼 Leo tháp (/leothap) để nhận EXP và thăng cấp thẻ!" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuido")
        .setDescription("🎒 Xem túi đồ và Nâng cấp thẻ bài"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.cards || user.cards.length === 0) {
            return interaction.reply({ content: "🎒 Túi đồ của bạn đang trống! Ghé /shopthe rước vài lá thẻ về nào.", flags: 64 });
        }

        // Tổng quan đội hình + tổng DPS
        const totalDPS = user.cards.reduce((s, c) => s + calculateDPS(c), 0);
        const cardList = user.cards.slice(0, 5).map((c, i) => {
            const dps = calculateDPS(c);
            return `${rarity(dps).tag} **${i + 1}. ${c.name}** [Lv.${c.level || 1}]\n> 🔥 DPS: \`${money(dps)}\``;
        }).join("\n");

        const embed = casinoEmbed({ color: COLORS.gold, title: `🎒 TÚI ĐỒ CỦA ${interaction.user.username.toUpperCase()}` })
            .setDescription(
                `> 🗂️ Bộ sưu tập: **${user.cards.length}/5** thẻ\n` +
                `> 💪 Tổng lực chiến đội hình: **\`${money(totalDPS)}\`**\n${"─".repeat(25)}\n${cardList}\n\n` +
                `👇 *Bấm nút để xem chi tiết & nâng cấp từng thẻ*`
            )
            .setFooter({ text: "Tin nhắn tự xóa sau 30 giây" });

        const row = new ActionRowBuilder();
        user.cards.slice(0, 5).forEach((card, i) => {
            row.addComponents(
                new ButtonBuilder().setCustomId(`tuido_view_${i}`).setLabel(`[Lv.${card.level || 1}] ${card.name}`.slice(0, 80)).setStyle(ButtonStyle.Secondary)
            );
        });

        await interaction.reply({ embeds: [embed], components: [row] });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const cardIndex = parseInt(parts[2]);
        const statToFastUp = parts[3];

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.cards[cardIndex]) return interaction.reply({ content: "❌ Không tìm thấy thẻ này!", flags: 64 });
        const card = user.cards[cardIndex];

        if (action === "view") {
            const embed = createDetailEmbed(card, interaction.user.username);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuido_rollall_${cardIndex}`).setLabel("Quay Lại Chỉ Số (1 triệu)").setEmoji("🎲").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Nâng Cấp Chỉ Định").setEmoji("🔨").setStyle(ButtonStyle.Success)
            );
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        if (action === "rollall") {
            if (user.money < 1000000) return interaction.reply({ content: `❌ Cần ${vnd(1000000)} để quay lại chỉ số!`, flags: 64 });
            user.money -= 1000000;
            ["hp", "atk", "def", "mdef", "spd", "atkSpd", "critRate", "critDmg"].forEach((s) => (card[s] = rollStat(card[s])));
            user.markModified("cards");
            await user.save();
            return interaction.update({ embeds: [createDetailEmbed(card, interaction.user.username, "🎲 **Đã quay lại toàn bộ chỉ số!** (may rủi tùy nhân phẩm)")] });
        }

        if (action === "upgradebtn") {
            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tuido_upmenu_${cardIndex}`)
                    .setPlaceholder("🔨 Chọn chỉ số muốn đập...")
                    .addOptions([
                        { label: "Máu (HP)", value: "hp", emoji: "❤️" },
                        { label: "Tấn Công (ATK)", value: "atk", emoji: "⚔️" },
                        { label: "Phòng Thủ (DEF)", value: "def", emoji: "🛡️" },
                        { label: "Tốc Độ (SPD)", value: "spd", emoji: "👟" },
                        { label: "Chí Mạng (CRIT)", value: "critRate", emoji: "🎯" },
                        { label: "ST Chí Mạng (CDMG)", value: "critDmg", emoji: "💥" },
                    ])
            );
            return interaction.update({ components: [menuRow] });
        }

        if (action === "fastup") {
            await this.logicUpgrade(interaction, user, cardIndex, statToFastUp);
        }
    },

    async handleMenu(interaction) {
        const parts = interaction.customId.split("_");
        if (parts[1] !== "upmenu") return;
        const user = await User.findOne({ userId: interaction.user.id });
        await this.logicUpgrade(interaction, user, parseInt(parts[2]), interaction.values[0]);
    },

    // --- NÂNG CẤP (logic GIỮ NGUYÊN, thêm hiển thị xác suất) ---
    async logicUpgrade(interaction, user, cardIndex, stat) {
        const card = user.cards[cardIndex];
        const multiplier = Math.max(1, Math.floor(card[stat] / 1000));
        const cost = 1000000 * multiplier;

        if (user.money < cost) return interaction.reply({ content: `❌ Cần ${vnd(cost)} để đập chỉ số này!`, flags: 64 });

        user.money -= cost;
        let successRate = 0.8 - card[stat] / 3000;
        if (successRate < 0.1) successRate = 0.1;

        let resultText = "";
        if (Math.random() <= successRate) {
            const inc = Math.floor(card[stat] * (Math.random() * 0.1 + 0.05)) + 1;
            card[stat] += stat === "atkSpd" ? 0.05 : inc;
            resultText = `✅ **THÀNH CÔNG!** ${stat.toUpperCase()} +${stat === "atkSpd" ? "0.05" : inc} (tỉ lệ ${Math.round(successRate * 100)}%)`;
        } else {
            const dec = Math.floor(card[stat] * 0.02) + 1;
            card[stat] -= stat === "atkSpd" ? 0.01 : dec;
            resultText = `❌ **THẤT BẠI!** ${stat.toUpperCase()} bị giảm nhẹ (tỉ lệ hỏng ${Math.round((1 - successRate) * 100)}%)`;
        }

        user.markModified("cards");
        await user.save();

        const newEmbed = createDetailEmbed(card, interaction.user.username, `🔨 ${resultText}\n💸 Chi phí: -${money(cost)} VND`);

        // Cảnh báo khi chỉ số cao (tỉ lệ hỏng lớn)
        const nextRate = Math.max(0.1, 0.8 - card[stat] / 3000);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tuido_fastup_${cardIndex}_${stat}`).setLabel(`Đập tiếp ${stat.toUpperCase()} (~${Math.round(nextRate * 100)}%)`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Đổi chỉ số khác").setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [newEmbed], components: [row] });
    },
};