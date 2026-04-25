const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../models/User");

// --- HÀM TRỢ GIÚP ---

function rollStat(baseValue) {
    const min = baseValue * 0.7;
    const max = baseValue * 1.3;
    let result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (Math.random() < 0.05) result = Math.floor(max * 1.5);
    return parseFloat(result.toFixed(2));
}

function createDetailEmbed(card, ownerName, resultMsg = "") {
    return new EmbedBuilder()
        .setColor(resultMsg.includes("✅") ? 0x2ecc71 : (resultMsg.includes("❌") ? 0xe74c3c : 0x3498db))
        .setTitle(`🃏 THẺ: ${card.name.toUpperCase()}`)
        .setAuthor({ name: `Chủ sở hữu: ${ownerName}` })
        .setDescription(`${resultMsg}\n\n**Chỉ số hiện tại:**`)
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
        .setFooter({ text: "Tin nhắn tự hủy sau 60s nếu không hoạt động." });
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
            .setDescription("Chọn thẻ để xem chi tiết (Menu tự xóa sau 30s)");

        const row = new ActionRowBuilder();
        user.cards.forEach((card, i) => {
            row.addComponents(new ButtonBuilder().setCustomId(`tuido_view_${i}`).setLabel(`Thẻ ${i + 1}`).setStyle(ButtonStyle.Secondary));
        });

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Tự động xóa menu chọn thẻ sau 30s
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

        // --- XEM CHI TIẾT (CÔNG KHAI) ---
        if (action === "view") {
            const embed = createDetailEmbed(card, interaction.user.username);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuido_rollall_${cardIndex}`).setLabel("Quay All (50k)").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Nâng Cấp Chỉ Định").setStyle(ButtonStyle.Success)
            );

            const detailMsg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            // Tự động xóa chi tiết thẻ sau 60s nếu không ai nhấn gì
            const collector = detailMsg.createMessageComponentCollector({ time: 60000 });
            collector.on('end', collected => {
                if (collected.size === 0) detailMsg.delete().catch(() => {});
            });
            return;
        }

        // --- QUAY ALL ---
        if (action === "rollall") {
            if (user.money < 50000) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
            user.money -= 50000;
            ["hp", "atk", "def", "mdef", "spd", "atkSpd", "critRate", "critDmg"].forEach(s => card[s] = rollStat(card[s]));
            user.markModified('cards');
            await user.save();

            return interaction.update({ embeds: [createDetailEmbed(card, interaction.user.username, "🎲 **Đã quay lại toàn bộ chỉ số!**")] });
        }

        // --- GỌI MENU CHỌN CHỈ SỐ ---
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
            return interaction.reply({ content: "Chọn chỉ số nâng cấp:", components: [menuRow], flags: 64 });
        }

        // --- NÚT ĐẬP TIẾP TỤC (SPAM) ---
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

    // --- LOGIC NÂNG CẤP DÙNG CHUNG ---
    async logicUpgrade(interaction, user, cardIndex, stat) {
        const card = user.cards[cardIndex];
        const multiplier = Math.max(1, Math.floor(card[stat] / 100));
        const cost = 100000 * multiplier;

        if (user.money < cost) return interaction.reply({ content: `❌ Cần ${cost.toLocaleString()} VND để đập tiếp!`, flags: 64 });

        user.money -= cost;
        let successRate = 0.8 - (card[stat] / 3000); // Tỉ lệ xịt tăng theo chỉ số
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
        
        // Nút bấm để đập tiếp chỉ số đó luôn
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tuido_fastup_${cardIndex}_${stat}`).setLabel(`Đập tiếp ${stat.toUpperCase()}`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Đổi chỉ số khác").setStyle(ButtonStyle.Secondary)
        );

        // Update trực tiếp tin nhắn công khai
        if (interaction.isStringSelectMenu() || interaction.customId.includes("fastup")) {
            return interaction.update({ embeds: [newEmbed], components: [row], content: "" });
        }
    }
};