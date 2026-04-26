const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../models/User");

// --- 1. HÀM TÍNH TỔNG LỰC CHIẾN (DPS) ---
function calculateDPS(card) {
    const level = card.level || 1;
    const base = (card.hp * 0.1) + (card.atk * 2) + (card.def * 1.5) + (card.mdef * 1.5) + (card.spd * 5);
    const offensive = (card.atkSpd * 100) * (1 + (card.critRate / 100) * (card.critDmg / 100));
    // Level tăng 5% sức mạnh mỗi cấp
    return Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
}

// --- 2. HÀM QUAY CHỈ SỐ (Gacha Stat) ---
function rollStat(baseValue) {
    const min = baseValue * 0.7;
    const max = baseValue * 1.3;
    let result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (Math.random() < 0.05) result = Math.floor(max * 1.5);
    return parseFloat(result.toFixed(2));
}

// --- 3. TẠO EMBED CHI TIẾT THẺ ---
function createDetailEmbed(card, ownerName, resultMsg = "") {
    const dps = calculateDPS(card);
    const level = card.level || 1;
    const exp = card.exp || 0;
    const nextExp = level * 1000; // Thống nhất công thức: Level * 1000

    return new EmbedBuilder()
        .setColor(resultMsg.includes("✅") ? 0x2ecc71 : (resultMsg.includes("❌") ? 0xe74c3c : 0x3498db))
        .setTitle(`🃏 THẺ: ${card.name.toUpperCase()} [Lv. ${level}]`)
        .setAuthor({ name: `Chủ sở hữu: ${ownerName}` })
        .setDescription(`${resultMsg}\n\n**⭐ Cấp độ: \`${level}/100\` | 💠 EXP: \`${exp}/${nextExp}\`**\n**🔥 TỔNG LỰC CHIẾN (DPS): \`${dps.toLocaleString()}\`**`)
        .addFields(
            { name: "❤️ HP", value: `\`${card.hp}\``, inline: true },
            { name: "⚔️ ATK", value: `\`${card.atk}\``, inline: true },
            { name: "🛡️ DEF", value: `\`${card.def}\``, inline: true },
            { name: "🔰 MDEF", value: `\`${card.mdef}\``, inline: true },
            { name: "👟 SPD", value: `\`${card.spd}\``, inline: true },
            { name: "⚡ ASPD", value: `\`${card.atkSpd}\``, inline: true },
            { name: "🎯 CRIT", value: `\`${card.critRate}%\``, inline: true },
            { name: "💥 CDMG", value: `\`${card.critDmg}%\``, inline: true }
        )
        .setFooter({ text: "Leo tháp để nhận thêm EXP và thăng cấp thẻ bài!" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuido")
        .setDescription("🎒 Xem túi đồ và Nâng cấp thẻ bài"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.cards || user.cards.length === 0) 
            return interaction.reply({ content: "🎒 Túi đồ của bạn đang trống!", flags: 64 });

        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle("🎒 TÚI ĐỒ CỦA " + interaction.user.username)
            .setDescription("Bấm vào tên thẻ để xem chi tiết (Tự xóa sau 30s)");

        const row = new ActionRowBuilder();
        user.cards.slice(0, 5).forEach((card, i) => {
            const lv = card.level || 1;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`tuido_view_${i}`)
                    .setLabel(`[Lv.${lv}] ${card.name}`) // ĐÃ SỬA: Hiển thị Level lên nút bấm
                    .setStyle(ButtonStyle.Secondary)
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
        if (!user || !user.cards[cardIndex]) return;
        const card = user.cards[cardIndex];

        if (action === "view") {
            const embed = createDetailEmbed(card, interaction.user.username);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuido_rollall_${cardIndex}`).setLabel("Quay All (10tr)").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Nâng Cấp Chỉ Định").setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        if (action === "rollall") {
            if (user.money < 10000000) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
            user.money -= 10000000;
            ["hp", "atk", "def", "mdef", "spd", "atkSpd", "critRate", "critDmg"].forEach(s => card[s] = rollStat(card[s]));
            user.markModified('cards');
            await user.save();
            return interaction.update({ embeds: [createDetailEmbed(card, interaction.user.username, "🎲 **Đã quay lại toàn bộ chỉ số!**")] });
        }

        if (action === "upgradebtn") {
            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tuido_upmenu_${cardIndex}`)
                    .setPlaceholder("Chọn chỉ số muốn đập...")
                    .addOptions([
                        { label: "Máu (HP)", value: "hp" }, { label: "Tấn Công", value: "atk" },
                        { label: "Phòng Thủ", value: "def" }, { label: "Tốc Độ", value: "spd" },
                        { label: "Chí Mạng", value: "critRate" }, { label: "ST Chí Mạng", value: "critDmg" }
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

    async logicUpgrade(interaction, user, cardIndex, stat) {
        const card = user.cards[cardIndex];
        const multiplier = Math.max(1, Math.floor(card[stat] / 1000));
        const cost = 1000000 * multiplier;

        if (user.money < cost) return interaction.reply({ content: `❌ Cần ${cost.toLocaleString()} VND!`, flags: 64 });

        user.money -= cost;
        let successRate = 0.8 - (card[stat] / 3000);
        if (successRate < 0.1) successRate = 0.1;

        let resultText = "";
        if (Math.random() <= successRate) {
            const inc = Math.floor(card[stat] * (Math.random() * 0.1 + 0.05)) + 1;
            card[stat] += (stat === "atkSpd") ? 0.05 : inc;
            resultText = `✅ **Thành Công!** (+${inc})`;
        } else {
            const dec = Math.floor(card[stat] * 0.02) + 1;
            card[stat] -= (stat === "atkSpd") ? 0.01 : dec;
            resultText = `❌ **Thất Bại!** (Giảm nhẹ chỉ số)`;
        }

        user.markModified('cards');
        await user.save();

        const newEmbed = createDetailEmbed(card, interaction.user.username, `🔔 **Nâng cấp ${stat.toUpperCase()}:** ${resultText}\n💰 Chi phí: -${cost.toLocaleString()} VND`);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tuido_fastup_${cardIndex}_${stat}`).setLabel(`Đập tiếp ${stat.toUpperCase()}`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Đổi chỉ số khác").setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [newEmbed], components: [row] });
    }
};