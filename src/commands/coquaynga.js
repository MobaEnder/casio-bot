const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType 
} = require("discord.js");
const User = require("../models/User");

/**
 * Tạo ổ đạn thực tế (1 viên ngẫu nhiên trong 6 ngăn)
 */
function shuffleChamber(size = 6) {
    let chambers = Array(size).fill(0);
    chambers[Math.floor(Math.random() * size)] = 1;
    return chambers;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coquaynga")
        .setDescription("🔫 Chế độ Solo hoặc Tạo phòng Đối đầu")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền cược")
               .setRequired(true)
               .setMinValue(1000)
        ),

    async execute(interaction) {
        try {
            const bet = interaction.options.getInteger("tiencuoc");
            const challenger = interaction.user;

            // Kiểm tra tiền chủ phòng
            const userChallenger = await User.findOne({ userId: challenger.id });
            if (!userChallenger || userChallenger.money < bet) {
                return interaction.reply({ content: "❌ Bạn không đủ tiền để tạo phòng!", flags: 64 });
            }

            const lobbyEmbed = new EmbedBuilder()
                .setTitle("🔫 PHÒNG CHỜ CÒ QUAY NGA")
                .setDescription(`👤 Chủ phòng: <@${challenger.id}>\n💰 Tiền cược: **${bet.toLocaleString()}** VND\n🎁 Thưởng nhà cái: **+50%** nếu thắng\n\n*Nhấn nút dưới đây để chọn chế độ!*`)
                .setColor(0x2f3136)
                .setFooter({ text: "Phòng tự hủy sau 60s nếu không bắt đầu." });

            const lobbyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("start_solo").setLabel("Chơi Solo").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("start_duel").setLabel("Đối Đầu (1vs1)").setStyle(ButtonStyle.Danger)
            );

            const lobbyMsg = await interaction.reply({
                embeds: [lobbyEmbed],
                components: [lobbyRow],
                fetchReply: true
            });

            const lobbyCollector = lobbyMsg.createMessageComponentCollector({
                time: 60000
            });

            lobbyCollector.on("collect", async (i) => {
                if (i.customId === "start_solo") {
                    if (i.user.id !== challenger.id) return i.reply({ content: "Chỉ chủ phòng mới có thể chọn Solo!", flags: 64 });
                    lobbyCollector.stop("solo");
                    await i.deferUpdate();
                    await startSolo(interaction, bet, challenger);
                } 
                
                else if (i.customId === "start_duel") {
                    if (i.user.id === challenger.id) return i.reply({ content: "Bạn không thể đối đầu với chính mình!", flags: 64 });
                    
                    const opponentDB = await User.findOne({ userId: i.user.id });
                    if (!opponentDB || opponentDB.money < bet) return i.reply({ content: "Bạn không đủ tiền tham gia!", flags: 64 });

                    lobbyCollector.stop("duel");
                    await i.deferUpdate();
                    await startDuel(interaction, bet, challenger, i.user);
                }
            });

            lobbyCollector.on("end", (_, reason) => {
                if (reason === "time") {
                    interaction.editReply({ content: "⏰ Phòng chờ đã hết hạn.", embeds: [], components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error("LỖI COQUAYNGA:", error);
        }
    }
};

// --- CHẾ ĐỘ SOLO ---
async function startSolo(interaction, bet, userObj) {
    const user = await User.findOne({ userId: userObj.id });
    user.money -= bet;
    await user.save();

    let chambers = shuffleChamber(6);
    let step = 0;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("solo_fire").setLabel("💥 BÓP CÒ").setStyle(ButtonStyle.Danger)
    );

    const updateSolo = (txt, color = 0x00aeef) => {
        return interaction.editReply({
            content: " ",
            embeds: [new EmbedBuilder().setTitle("🔫 SOLO SINH TỒN").setDescription(txt).setColor(color)],
            components: [row]
        });
    };

    await updateSolo(`💰 Đang cược: **${bet.toLocaleString()}** VND\n\n*Bạn có 6 ngăn đạn, 1 viên thật. Hãy cố gắng sống sót qua 5 lượt!*`);

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        filter: i => i.user.id === userObj.id,
        componentType: ComponentType.Button,
        time: 120000
    });

    collector.on("collect", async (i) => {
        await i.deferUpdate();
        row.components[0].setDisabled(true); // Khóa nút tạm thời
        await updateSolo("*Đang bóp cò...*");
        await new Promise(r => setTimeout(r, 1000));

        if (chambers[step] === 1) return collector.stop("dead");
        
        step++;
        if (step === 5) return collector.stop("win");
        
        row.components[0].setDisabled(false);
        await updateSolo(`**CẠCH!** Ngăn đạn trống. Lượt thứ **${step}** an toàn!\nTiếp tục chứ?`);
    });

    collector.on("end", async (_, reason) => {
        if (reason === "dead") {
            await interaction.editReply({ content: `💥 **ĐOÀNH!** <@${userObj.id}> đã tử trận. Mất **${bet.toLocaleString()}** VND.`, embeds: [], components: [] });
        } else if (reason === "win") {
            const prize = bet + Math.floor(bet * 0.5); 
            user.money += prize;
            await user.save();
            await interaction.editReply({ 
                content: `🏆 **THẮNG SOLO!** <@${userObj.id}> sống sót và nhận **${prize.toLocaleString()}** VND (Vốn + 50% thưởng nhà cái)!`, 
                embeds: [], components: [] 
            });
        }
    });
}

// --- CHẾ ĐỘ ĐỐI ĐẦU ---
async function startDuel(interaction, bet, challenger, opponent) {
    const uC = await User.findOne({ userId: challenger.id });
    const uO = await User.findOne({ userId: opponent.id });

    uC.money -= bet; uO.money -= bet;
    await uC.save(); await uO.save();

    let chambers = shuffleChamber(6);
    let players = [challenger, opponent];
    let turn = 0; let step = 0;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("duel_fire").setLabel("💥 BÓP CÒ").setStyle(ButtonStyle.Danger)
    );

    const updateDuel = (txt) => {
        return interaction.editReply({
            content: `Lượt của: <@${players[turn].id}>`,
            embeds: [new EmbedBuilder().setTitle("⚔️ ĐỐI ĐẦU SINH TỬ").setDescription(txt).setColor(0xff0000)],
            components: [row]
        });
    };

    await updateDuel("Trận đấu bắt đầu! Hai bên đã đặt cược. Ai sẽ gục ngã?");

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 
    });

    collector.on("collect", async (i) => {
        if (i.user.id !== players[turn].id) return i.reply({ content: "Không phải lượt của bạn!", flags: 64 });
        
        await i.deferUpdate();
        row.components[0].setDisabled(true);
        await updateDuel("*Nín thở bóp cò...*");
        await new Promise(r => setTimeout(r, 1200));

        if (chambers[step] === 1) return collector.stop("dead");
        
        step++; turn = 1 - turn;
        row.components[0].setDisabled(false);
        await updateDuel("`CẠCH!` May mắn lượt này an toàn. Khẩu súng được chuyển sang đối thủ...");
    });

    collector.on("end", async (_, reason) => {
        if (reason === "dead") {
            const winner = players[1 - turn];
            const prize = (bet * 2) + Math.floor(bet * 0.5); 
            const winDB = await User.findOne({ userId: winner.id });
            winDB.money += prize;
            await winDB.save();

            await interaction.editReply({ 
                content: `🏆 **CHIẾN THẮNG!** <@${winner.id}> đã sống sót và nhận **${prize.toLocaleString()}** VND!`, 
                embeds: [], components: [] 
            });
            
            // Penalty: Timeout người thua 1 phút (nếu bot có quyền)
            try { await interaction.guild.members.cache.get(players[turn].id).timeout(60000, "Thua Cò Quay Nga"); } catch(e) {}
        }
    });
}