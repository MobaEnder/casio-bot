const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../models/User");

// --- HÀM TRỢ GIÚP ---

// Random All chỉ số (+/- 30%)
function rollStat(baseValue) {
    const min = baseValue * 0.7;
    const max = baseValue * 1.3;
    let result = Math.floor(Math.random() * (max - min + 1)) + min;
    if (Math.random() < 0.05) result = Math.floor(max * 1.5);
    return parseFloat(result.toFixed(2));
}

// Hàm tạo Embed chi tiết thẻ (Để dùng chung cho update tin nhắn)
function createDetailEmbed(card, cardIndex, ownerName) {
    // Tính toán cấp độ dựa trên chỉ số hoặc dùng mặc định
    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🃏 THẺ: ${card.name.toUpperCase()}`)
        .setAuthor({ name: `Sở hữu bởi: ${ownerName}` })
        .setDescription("Chỉ số hiện tại của thẻ (Hiển thị công khai):")
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
        .setFooter({ text: "Càng nâng cấp, tỉ lệ xịt càng cao và giá càng đắt!" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuido")
        .setDescription("🎒 Xem túi đồ thẻ bài và Nâng cấp chỉ số"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.cards || user.cards.length === 0) 
            return interaction.reply({ content: "🎒 Túi đồ của bạn đang trống!", flags: 64 });

        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle("🎒 TÚI ĐỒ THẺ BÀI")
            .setDescription("Chọn thẻ bên dưới để xem chi tiết (Công khai)");

        const row = new ActionRowBuilder();
        user.cards.forEach((card, i) => {
            embed.addFields({ name: `[${i + 1}] ${card.name}`, value: `⚔️ ATK: ${card.atk}`, inline: true });
            row.addComponents(new ButtonBuilder().setCustomId(`tuido_view_${i}`).setLabel(`Thẻ ${i + 1}`).setStyle(ButtonStyle.Secondary));
        });

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const cardIndex = parseInt(parts[2]);

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return;
        const card = user.cards[cardIndex];

        // --- XEM CHI TIẾT THẺ (CÔNG KHAI) ---
        if (action === "view") {
            const detailEmbed = createDetailEmbed(card, cardIndex, interaction.user.username);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuido_rollall_${cardIndex}`).setLabel("Quay All (50k)").setStyle(ButtonStyle.Primary).setEmoji("🎲"),
                new ButtonBuilder().setCustomId(`tuido_upgradebtn_${cardIndex}`).setLabel("Nâng Cấp Chỉ Định").setStyle(ButtonStyle.Success).setEmoji("🆙")
            );

            // Gửi công khai (không dùng flags: 64)
            return interaction.reply({ embeds: [detailEmbed], components: [row] });
        }

        // --- QUAY TẤT CẢ (ROLL ALL) ---
        if (action === "rollall") {
            if (user.money < 50000) return interaction.reply({ content: "❌ Bạn cần 50,000 VND!", flags: 64 });
            
            user.money -= 50000;
            card.hp = rollStat(card.hp); card.atk = rollStat(card.atk);
            card.def = rollStat(card.def); card.mdef = rollStat(card.mdef);
            card.spd = rollStat(card.spd); card.atkSpd = rollStat(card.atkSpd);
            card.critRate = rollStat(card.critRate); card.critDmg = rollStat(card.critDmg);
            
            user.markModified('cards');
            await user.save();

            const newEmbed = createDetailEmbed(card, cardIndex, interaction.user.username);
            return interaction.update({ 
                content: `🎲 **${interaction.user.username}** đã quay lại toàn bộ chỉ số! (-50,000 VND)`,
                embeds: [newEmbed] 
            });
        }

        // --- MENU CHỌN NÂNG CẤP ---
        if (action === "upgradebtn") {
            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tuido_upmenu_${cardIndex}`)
                    .setPlaceholder("Chọn chỉ số muốn Nâng Cấp...")
                    .addOptions([
                        { label: "Máu (HP)", value: "hp" }, { label: "Tấn Công", value: "atk" },
                        { label: "Phòng Thủ", value: "def" }, { label: "Thủ Phép", value: "mdef" },
                        { label: "Tốc Độ", value: "spd" }, { label: "Tốc Đánh", value: "atkSpd" },
                        { label: "Chí Mạng", value: "critRate" }, { label: "ST Chí Mạng", value: "critDmg" }
                    ])
            );
            return interaction.reply({ content: "⚠️ Chọn chỉ số để nâng cấp (Tỉ lệ xịt tăng dần theo chỉ số hiện tại):", components: [menuRow], flags: 64 });
        }
    },

    async handleMenu(interaction) {
        const parts = interaction.customId.split("_");
        if (parts[1] !== "upmenu") return;

        const cardIndex = parseInt(parts[2]);
        const stat = interaction.values[0];
        
        const user = await User.findOne({ userId: interaction.user.id });
        const card = user.cards[cardIndex];

        // --- LOGIC NÂNG CẤP TĂNG TIẾN ---
        // Giá cơ bản 100k, nhân thêm hệ số dựa trên độ lớn của chỉ số (càng cao càng đắt)
        const baseUpgradeCost = 100000;
        const currentStatValue = card[stat];
        const multiplier = Math.max(1, Math.floor(currentStatValue / 100)); 
        const finalCost = baseUpgradeCost * multiplier;

        if (user.money < finalCost) return interaction.reply({ content: `❌ Cần ${finalCost.toLocaleString()} VND để nâng cấp tiếp chỉ số này!`, flags: 64 });

        user.money -= finalCost;

        // Tỉ lệ thành công: cơ bản 80%, giảm 5% cho mỗi 100 điểm chỉ số, tối thiểu 10%
        let successRate = 0.8 - (currentStatValue / 2000);
        if (successRate < 0.1) successRate = 0.1;

        let resultMsg = "";
        if (Math.random() <= successRate) {
            // Thành công: Tăng từ 5% - 15% chỉ số hiện tại
            const increase = Math.floor(currentStatValue * (Math.random() * 0.1 + 0.05)) + 1;
            card[stat] += (stat === "atkSpd") ? parseFloat((increase/100).toFixed(2)) : increase;
            resultMsg = `✅ **Thành Công!** ${stat.toUpperCase()} tăng lên \`${card[stat]}\` (-${finalCost.toLocaleString()} VND)`;
        } else {
            // Thất bại: Giữ nguyên hoặc giảm nhẹ 2% (đen thôi đỏ quên đi)
            if (Math.random() < 0.5) {
                const decrease = Math.floor(currentStatValue * 0.02) + 1;
                card[stat] -= (stat === "atkSpd") ? 0.01 : decrease;
                resultMsg = `❌ **Thất Bại!** Chỉ số bị giảm nhẹ do cường hóa lỗi... (-${finalCost.toLocaleString()} VND)`;
            } else {
                resultMsg = `⚠️ **Thất Bại!** Nâng cấp không thành công nhưng chỉ số được giữ nguyên. (-${finalCost.toLocaleString()} VND)`;
            }
        }

        user.markModified('cards');
        await user.save();

        // Cập nhật TRỰC TIẾP vào tin nhắn cũ (Public)
        const newEmbed = createDetailEmbed(card, cardIndex, interaction.user.username);
        
        // Cố gắng tìm và sửa tin nhắn gốc nếu có thể, hoặc thông báo kết quả
        try {
            await interaction.update({ content: `🔔 **KẾT QUẢ NÂNG CẤP:**\n${resultMsg}`, components: [] });
            // Tìm tin nhắn gốc để update chỉ số công khai
            if (interaction.message.reference) {
                 const originalMsg = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
                 await originalMsg.edit({ embeds: [newEmbed] });
            }
        } catch (e) {
            return interaction.reply({ content: resultMsg, flags: 64 });
        }
    }
};