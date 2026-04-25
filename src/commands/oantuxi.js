const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const challenges = new Map(); // Lưu trữ dữ liệu trận đấu

module.exports = {
    data: new SlashCommandBuilder()
        .setName("oantuxi")
        .setDescription("✊✌️✋ Oẳn tù xì - Chơi với Bot hoặc Bạn bè")
        .addIntegerOption(opt => 
            opt.setName("tien")
                .setDescription("Số tiền muốn cược")
                .setRequired(true)
                .setMinValue(1000)
        )
        .addUserOption(opt => 
            opt.setName("doi_thu")
                .setDescription("Tag người muốn thách đấu (Để trống nếu muốn đấu với Bot hoặc mở kèo tự do)")
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger("tien");
        const target = interaction.options.getUser("doi_thu");
        const user = await User.findOne({ userId: interaction.user.id });

        // Kiểm tra tiền và trạng thái ban
        if (!user || user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia cá cược!", flags: 64 });

        // Trường hợp 1: Có tag đối thủ cụ thể -> Vào thẳng chế độ PvP
        if (target) {
            if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Bạn không thể tự đấu với chính mình!", flags: 64 });
            
            return setupPvP(interaction, amount, target.id);
        }

        // Trường hợp 2: Không tag ai -> Hiện Menu chọn chế độ
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("✊✌️✋ LỰA CHỌN CHẾ ĐỘ")
            .setDescription(`Bạn muốn cược **${amount.toLocaleString()} VND** vào đâu?`)
            .addFields(
                { name: "🤖 Đấu với Bot", value: "Kết quả ngay lập tức.", inline: true },
                { name: "👥 Thách đấu bạn bè", value: "Đấu 1vs1 công bằng - Ai cũng có thể tham gia.", inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`oantuxi_choice_bot_${amount}`)
                .setLabel("Chơi với Bot")
                .setEmoji("🤖")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`oantuxi_choice_user_${amount}`)
                .setLabel("Chơi với bạn")
                .setEmoji("🤝")
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const [, action, detail, amtStr] = interaction.customId.split("_");
        const amount = parseInt(amtStr || detail);

        // --- XỬ LÝ CHỌN CHẾ ĐỘ ---
        if (action === "choice") {
            if (detail === "bot") {
                // Chuyển sang giao diện đấu với Bot
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle("🤖 ĐẤU VỚI NHÀ CÁI")
                    .setDescription(`Cược: **${amount.toLocaleString()} VND**\nChọn món của bạn!`);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_r_${amount}`).setLabel("ĐẤM").setEmoji("✊").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_s_${amount}`).setLabel("KÉO").setEmoji("✌️").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_p_${amount}`).setLabel("LÁ").setEmoji("✋").setStyle(ButtonStyle.Success)
                );
                return interaction.update({ embeds: [embed], components: [row] });
            } 
            
            if (detail === "user") {
                // Chuyển sang giao diện kèo mở (Open Challenge)
                return setupPvP(interaction, amount, null, true);
            }
        }

        // --- XỬ LÝ KẾT QUẢ VS BOT ---
        if (action === "playbot") {
            const uData = await User.findOne({ userId: interaction.user.id });
            if (!uData || uData.money < amount) return interaction.reply({ content: "Hết tiền!", flags: 64 });

            const userChoice = detail; // r, s, p
            let botChoice;
            
            // Logic bịp 65% Bot thắng hoặc hòa
            if (Math.random() < 0.65) {
                botChoice = userChoice === "r" ? "p" : userChoice === "s" ? "r" : "s";
            } else {
                botChoice = userChoice === "r" ? "s" : userChoice === "s" ? "p" : "r";
            }

            const emojis = { r: "✊ (Đấm)", s: "✌️ (Kéo)", p: "✋ (Lá)" };
            let result;
            if (botChoice === userChoice) {
                result = { msg: "HÒA!", color: 0xffff00 };
            } else if ((userChoice === "r" && botChoice === "s") || (userChoice === "s" && botChoice === "p") || (userChoice === "p" && botChoice === "r")) {
                uData.money += amount;
                result = { msg: "THẮNG!", color: 0x00ff00 };
            } else {
                uData.money -= amount;
                result = { msg: "THUA!", color: 0xff0000 };
            }

            await uData.save();
            return interaction.update({
                embeds: [new EmbedBuilder().setColor(result.color).setTitle(`KẾT QUẢ: ${result.msg}`).setDescription(`Bạn: ${emojis[userChoice]}\nBot: ${emojis[botChoice]}`)],
                components: []
            });
        }

        // --- XỬ LÝ CHỌN NƯỚC ĐI PVP ---
        if (action === "playpvp") {
            const game = challenges.get(interaction.message.id);
            if (!game) return interaction.reply({ content: "Trận đấu đã kết thúc!", flags: 64 });

            // Nếu là kèo mở, ai bấm vào đầu tiên sẽ là p2
            if (!game.p2.id && interaction.user.id !== game.p1.id) {
                const p2Data = await User.findOne({ userId: interaction.user.id });
                if (!p2Data || p2Data.money < game.amount) return interaction.reply({ content: "Bạn không đủ tiền để tham gia kèo này!", flags: 64 });
                game.p2.id = interaction.user.id;
            }

            const isP1 = interaction.user.id === game.p1.id;
            const isP2 = interaction.user.id === game.p2.id;

            if (!isP1 && !isP2) return interaction.reply({ content: "Kèo này đã có chủ, hãy đợi kèo khác!", flags: 64 });

            const p = isP1 ? game.p1 : game.p2;
            if (p.choice) return interaction.reply({ content: "Bạn đã ra đòn rồi!", flags: 64 });
            
            p.choice = detail;
            await interaction.reply({ content: "✅ Bạn đã chọn bí mật!", flags: 64 });

            // Nếu cả 2 đã chọn xong
            if (game.p1.choice && game.p2.choice) {
                const c1 = game.p1.choice; const c2 = game.p2.choice;
                const emojis = { r: "✊", s: "✌️", p: "✋" };
                let winnerId = c1 === c2 ? "draw" : ((c1 === "r" && c2 === "s") || (c1 === "s" && c2 === "p") || (c1 === "p" && c2 === "r") ? game.p1.id : game.p2.id);

                if (winnerId !== "draw") {
                    const w = await User.findOne({ userId: winnerId });
                    const l = await User.findOne({ userId: winnerId === game.p1.id ? game.p2.id : game.p1.id });
                    w.money += game.amount; l.money -= game.amount;
                    await w.save(); await l.save();
                }

                await interaction.message.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0x00ffff)
                        .setTitle("🏁 KẾT THÚC TRẬN ĐẤU")
                        .setDescription(`<@${game.p1.id}>: ${emojis[c1]} vs <@${game.p2.id}>: ${emojis[c2]}\n\nKết quả: ${winnerId === "draw" ? "**Hòa!**" : `🏆 <@${winnerId}> thắng **${game.amount.toLocaleString()} VND**`}`)],
                    components: []
                });
                challenges.delete(interaction.message.id);
            }
        }
    }
};

// Hàm phụ để thiết lập trận đấu 1vs1
async function setupPvP(interaction, amount, targetId, isUpdate = false) {
    const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("⚔️ THÁCH ĐẤU OẲN TÙ XÌ")
        .setDescription(`<@${interaction.user.id}> đặt kèo: **${amount.toLocaleString()} VND**\nĐối thủ: ${targetId ? `<@${targetId}>` : "**Ai cũng được!**"}\n\n**Hãy chọn đòn đánh của bạn:**`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`oantuxi_playpvp_r_${amount}`).setLabel("ĐẤM").setEmoji("✊").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`oantuxi_playpvp_s_${amount}`).setLabel("KÉO").setEmoji("✌️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`oantuxi_playpvp_p_${amount}`).setLabel("LÁ").setEmoji("✋").setStyle(ButtonStyle.Secondary)
    );

    const msgData = { content: targetId ? `<@${targetId}> có người thách đấu!` : "📢 Một kèo Oẳn tù xì mới đã được mở!", embeds: [embed], components: [row], fetchReply: true };
    
    const msg = isUpdate ? await interaction.update(msgData) : await interaction.reply(msgData);
    
    challenges.set(msg.id, {
        p1: { id: interaction.user.id, choice: null },
        p2: { id: targetId, choice: null }, // id có thể null nếu là kèo mở
        amount
    });
}