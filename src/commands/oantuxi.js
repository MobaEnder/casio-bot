const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const challenges = new Map(); // Lưu các trận 1vs1

module.exports = {
    data: new SlashCommandBuilder()
        .setName("oantuxi")
        .setDescription("✊✌️✋ Oẳn tù xì - Vốn ít lời nhiều!")
        .addSubcommand(sub =>
            sub.setName("bot")
                .setDescription("Chơi với Nhà Cái (Tỉ lệ thắng 35%)")
                .addIntegerOption(opt => opt.setName("tien").setDescription("Số tiền cược").setRequired(true).setMinValue(1000))
        )
        .addSubcommand(sub =>
            sub.setName("user")
                .setDescription("Thách đấu 1vs1 với người khác")
                .addUserOption(opt => opt.setName("doi_thu").setDescription("Người bạn muốn thách đấu").setRequired(true))
                .addIntegerOption(opt => opt.setName("tien").setDescription("Số tiền cược").setRequired(true).setMinValue(1000))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger("tien");
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user || user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền để ra kèo!", flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm tham gia các hoạt động cá cược!", flags: 64 });

        // --- CHẾ ĐỘ CHƠI VỚI BOT ---
        if (sub === "bot") {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("✊✌️✋ ĐẤU VỚI NHÀ CÁI")
                .setDescription(`Bạn đang cược **${amount.toLocaleString()} VND**.\nHãy chọn món đồ của bạn!`)
                .setFooter({ text: "Bot có khả năng đọc thấu suy nghĩ của bạn (Bịp đó)!" });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`otx_bot_r_${amount}`).setLabel("ĐẤM (Rock)").setEmoji("✊").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`otx_bot_s_${amount}`).setLabel("KÉO (Scissors)").setEmoji("✌️").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`otx_bot_p_${amount}`).setLabel("LÁ (Paper)").setEmoji("✋").setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // --- CHẾ ĐỘ 1VS1 ---
        if (sub === "user") {
            const target = interaction.options.getUser("doi_thu");
            if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Bạn không thể tự đấm chính mình!", flags: 64 });
            
            const targetData = await User.findOne({ userId: target.id });
            if (!targetData || targetData.money < amount) return interaction.reply({ content: `❌ Đối thủ không đủ **${amount.toLocaleString()} VND** để theo kèo!`, flags: 64 });

            const embed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("⚔️ KÈO MÁU OẲN TÙ XÌ")
                .setDescription(`<@${interaction.user.id}> đã thách đấu <@${target.id}>\n💰 Tiền cược: **${amount.toLocaleString()} VND**\n\n**Cả hai hãy chọn "vũ khí" bên dưới!**`)
                .setFooter({ text: "Thời gian chờ: 60 giây" });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("otx_pvp_r").setLabel("ĐẤM").setEmoji("✊").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("otx_pvp_s").setLabel("KÉO").setEmoji("✌️").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("otx_pvp_p").setLabel("LÁ").setEmoji("✋").setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({ content: `<@${target.id}> ơi, có người tìm bạn tính sổ!`, embeds: [embed], components: [row], fetchReply: true });

            challenges.set(msg.id, {
                p1: { id: interaction.user.id, choice: null },
                p2: { id: target.id, choice: null },
                amount,
                msg
            });
        }
    },

    async handleButton(interaction) {
        const [prefix, mode, choice, amtStr] = interaction.customId.split("_");
        if (prefix !== "otx") return;

        // XỬ LÝ CHƠI VỚI BOT
        if (mode === "bot") {
            const amount = parseInt(amtStr);
            const userChoice = choice; // r, s, p
            const uData = await User.findOne({ userId: interaction.user.id });
            if (uData.money < amount) return interaction.reply({ content: "Hết tiền rồi!", flags: 64 });

            // LOGIC BỊP: 65% Bot thắng hoặc hòa (để bào tiền), 35% cho User thắng
            let botChoice;
            const isHouseWin = Math.random() < 0.65;

            if (isHouseWin) {
                // Bot chọn cái khắc chế userChoice
                if (userChoice === "r") botChoice = "p"; // Thắng Đấm bằng Lá
                else if (userChoice === "s") botChoice = "r"; // Thắng Kéo bằng Đấm
                else botChoice = "s"; // Thắng Lá bằng Kéo
            } else {
                // 35% cơ hội User thắng
                if (userChoice === "r") botChoice = "s";
                else if (userChoice === "s") botChoice = "p";
                else botChoice = "r";
            }

            const emojis = { r: "✊ (Đấm)", s: "✌️ (Kéo)", p: "✋ (Lá)" };
            let resultMsg = "";
            let color = "Grey";

            if (botChoice === userChoice) {
                resultMsg = "🤝 **HÒA!** Bot cũng ra y hệt bạn. Tiền vẫn còn đó.";
                color = "Yellow";
            } else if (
                (userChoice === "r" && botChoice === "s") ||
                (userChoice === "s" && botChoice === "p") ||
                (userChoice === "p" && botChoice === "r")
            ) {
                uData.money += amount;
                resultMsg = `🎉 **THẮNG!** Bạn nhận được **+${amount.toLocaleString()} VND**.`;
                color = "Green";
            } else {
                uData.money -= amount;
                resultMsg = `💀 **THUA!** Bot đã dùng ${emojis[botChoice]} để hạ gục bạn. Mất **${amount.toLocaleString()} VND**.`;
                color = "Red";
            }

            await uData.save();
            const resEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle("KẾT QUẢ VS BOT")
                .setDescription(`Bạn: **${emojis[userChoice]}**\nBot: **${emojis[botChoice]}**\n\n${resultMsg}`);

            return interaction.update({ embeds: [resEmbed], components: [] });
        }

        // XỬ LÝ CHƠI 1VS1
        if (mode === "pvp") {
            const game = challenges.get(interaction.message.id);
            if (!game) return interaction.reply({ content: "Trận đấu không tồn tại!", flags: 64 });

            const isP1 = interaction.user.id === game.p1.id;
            const isP2 = interaction.user.id === game.p2.id;

            if (!isP1 && !isP2) return interaction.reply({ content: "Không phải việc của bạn!", flags: 64 });

            const currentPlayer = isP1 ? game.p1 : game.p2;
            if (currentPlayer.choice) return interaction.reply({ content: "Bạn đã chọn rồi, chờ đối thủ đi!", flags: 64 });

            currentPlayer.choice = choice; // r, s, p
            await interaction.reply({ content: `✅ Bạn đã chọn bí mật!`, flags: 64 });

            // Nếu cả 2 đã chọn xong
            if (game.p1.choice && game.p2.choice) {
                let countdown = 3;
                const countdownEmbed = new EmbedBuilder()
                    .setColor("Yellow")
                    .setTitle("⌛ ĐANG ĐỐI CHIẾU KẾT QUẢ...")
                    .setDescription("Cả hai đã ra đòn! Kết quả sẽ có sau **3 giây**...");

                await game.msg.edit({ embeds: [countdownEmbed], components: [] });

                setTimeout(async () => {
                    const p1Choice = game.p1.choice;
                    const p2Choice = game.p2.choice;
                    const emojis = { r: "✊", s: "✌️", p: "✋" };

                    let winnerId = null;
                    if (p1Choice === p2Choice) {
                        winnerId = "draw";
                    } else if (
                        (p1Choice === "r" && p2Choice === "s") ||
                        (p1Choice === "s" && p2Choice === "p") ||
                        (p1Choice === "p" && p2Choice === "r")
                    ) {
                        winnerId = game.p1.id;
                    } else {
                        winnerId = game.p2.id;
                    }

                    const p1Data = await User.findOne({ userId: game.p1.id });
                    const p2Data = await User.findOne({ userId: game.p2.id });

                    let finalDesc = `<@${game.p1.id}>: ${emojis[p1Choice]} vs <@${game.p2.id}>: ${emojis[p2Choice]}\n\n`;

                    if (winnerId === "draw") {
                        finalDesc += "🤝 **KẾT QUẢ HÒA!** Không ai mất tiền.";
                    } else {
                        const winner = winnerId === game.p1.id ? p1Data : p2Data;
                        const loser = winnerId === game.p1.id ? p2Data : p1Data;

                        winner.money += game.amount;
                        loser.money -= game.amount;
                        await winner.save();
                        await loser.save();

                        finalDesc += `🏆 **NGƯỜI THẮNG:** <@${winnerId}>\n💰 Tiền thưởng: **+${game.amount.toLocaleString()} VND**`;
                    }

                    const finalEmbed = new EmbedBuilder()
                        .setColor("Gold")
                        .setTitle("🏁 KẾT THÚC TRẬN ĐẤU")
                        .setDescription(finalDesc);

                    await game.msg.edit({ embeds: [finalEmbed] });
                    challenges.delete(interaction.message.id);
                }, 3000); // 3 giây để tạo kịch tính (bạn có thể đổi thành 10s theo ý muốn)
            }
        }
    }
};