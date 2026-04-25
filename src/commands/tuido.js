const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../models/User");

// Hàm ngẫu nhiên chỉ số (+/- 30% so với base, có tỉ lệ nổ hũ)
function rollStat(baseValue) {
    const min = baseValue * 0.7;
    const max = baseValue * 1.3;
    let result = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // 5% tỉ lệ nổ hũ (đột biến x1.5 max)
    if (Math.random() < 0.05) result = Math.floor(max * 1.5);
    
    // Làm tròn số thập phân cho Tốc đánh
    return parseFloat(result.toFixed(2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuido")
        .setDescription("🎒 Xem túi đồ thẻ bài và Gacha chỉ số"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.cards || user.cards.length === 0) return interaction.reply({ content: "🎒 Túi đồ của bạn đang trống!", flags: 64 });

        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle("🎒 TÚI ĐỒ THẺ BÀI CỦA BẠN")
            .setDescription("Bấm vào số thứ tự bên dưới để xem chi tiết và nâng cấp thẻ!");

        const row = new ActionRowBuilder();
        user.cards.forEach((card, i) => {
            embed.addFields({ name: `[${i + 1}] ${card.name}`, value: `HP: ${card.hp} | ATK: ${card.atk}`, inline: false });
            row.addComponents(new ButtonBuilder().setCustomId(`tuido_view_${i}`).setLabel(`Thẻ ${i + 1}`).setStyle(ButtonStyle.Secondary));
        });

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const cardIndex = parseInt(parts[2]);

        const user = await User.findOne({ userId: interaction.user.id });
        const card = user.cards[cardIndex];
        if (!card) return interaction.reply({ content: "❌ Thẻ không tồn tại!", flags: 64 });

        // --- XEM CHI TIẾT THẺ ---
        if (action === "view") {
            const detailEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🃏 THẺ: ${card.name.toUpperCase()}`)
                .setDescription("Chỉ số hiện tại của thẻ:")
                .addFields(
                    { name: "❤️ Máu (HP)", value: `${card.hp}`, inline: true },
                    { name: "⚔️ Tấn Công", value: `${card.atk}`, inline: true },
                    { name: "🛡️ Phòng Thủ", value: `${card.def}`, inline: true },
                    { name: "🔰 Thủ Phép", value: `${card.mdef}`, inline: true },
                    { name: "👟 Tốc Độ", value: `${card.spd}`, inline: true },
                    { name: "⚡ Tốc Đánh", value: `${card.atkSpd}`, inline: true },
                    { name: "🎯 Tỉ lệ Chí Mạng", value: `${card.critRate}%`, inline: true },
                    { name: "💥 ST Chí Mạng", value: `${card.critDmg}%`, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tuido_rollall_${cardIndex}`).setLabel("Quay All (50,000 VND)").setStyle(ButtonStyle.Primary).setEmoji("🎲"),
                new ButtonBuilder().setCustomId(`tuido_rollonebtn_${cardIndex}`).setLabel("Quay Chỉ Định (100,000 VND)").setStyle(ButtonStyle.Success).setEmoji("🎯")
            );

            return interaction.reply({ embeds: [detailEmbed], components: [row], flags: 64 });
        }

        // --- NÚT GỌI MENU QUAY CHỈ ĐỊNH ---
        if (action === "rollonebtn") {
            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`tuido_statmenu_${cardIndex}`)
                    .setPlaceholder("Chọn chỉ số muốn Quay lại...")
                    .addOptions([
                        { label: "Máu (HP)", value: "hp" }, { label: "Tấn Công", value: "atk" },
                        { label: "Phòng Thủ", value: "def" }, { label: "Thủ Phép", value: "mdef" },
                        { label: "Tốc Độ", value: "spd" }, { label: "Tốc Đánh", value: "atkSpd" },
                        { label: "Tỉ Lệ Chí Mạng", value: "critRate" }, { label: "ST Chí Mạng", value: "critDmg" }
                    ])
            );
            return interaction.reply({ content: "Chọn 1 chỉ số bên dưới để Roll (Giá: 100,000 VND):", components: [menuRow], flags: 64 });
        }

        // --- QUAY TẤT CẢ CHỈ SỐ ---
        if (action === "rollall") {
            if (user.money < 50000) return interaction.reply({ content: "❌ Bạn cần 50,000 VND để quay All!", flags: 64 });
            
            user.money -= 50000;
            // Roll lại toàn bộ
            card.hp = rollStat(card.hp); card.atk = rollStat(card.atk);
            card.def = rollStat(card.def); card.mdef = rollStat(card.mdef);
            card.spd = rollStat(card.spd); card.atkSpd = rollStat(card.atkSpd);
            card.critRate = rollStat(card.critRate); card.critDmg = rollStat(card.critDmg);
            
            user.markModified('cards'); // Bắt buộc cho Mongoose khi sửa Array Object
            await user.save();

            return interaction.reply({ content: `🎲 **Roll All Thành Công!**\nĐã trừ 50,000 VND. Dùng \`/tuido\` để xem chỉ số mới!`, flags: 64 });
        }
    },

    // --- XỬ LÝ MENU KHI QUAY CHỈ ĐỊNH ---
    async handleMenu(interaction) {
        const parts = interaction.customId.split("_");
        if (parts[1] !== "statmenu") return;

        const cardIndex = parseInt(parts[2]);
        const statToRoll = interaction.values[0]; // hp, atk, def...
        
        const user = await User.findOne({ userId: interaction.user.id });
        if (user.money < 100000) return interaction.reply({ content: "❌ Bạn cần 100,000 VND để quay chỉ định!", flags: 64 });

        user.money -= 100000;
        const oldStat = user.cards[cardIndex][statToRoll];
        const newStat = rollStat(oldStat);
        
        user.cards[cardIndex][statToRoll] = newStat;
        user.markModified('cards');
        await user.save();

        return interaction.update({ 
            content: `🎯 **Quay Chỉ Định Thành Công!**\nĐã trừ 100,000 VND.\nChỉ số **${statToRoll.toUpperCase()}** thay đổi: \`${oldStat}\` ➡️ \`${newStat}\``, 
            components: [] 
        });
    }
};