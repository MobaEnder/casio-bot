const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType 
} = require("discord.js");
const User = require("../models/User");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bomhengio")
        .setDescription("💣 Chuyền bom - Nhà cái rót tiền (Chốt hạ từ lượt thứ 4)")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền mỗi người đóng góp")
               .setRequired(true)
               .setMinValue(1000)
        ),

    async execute(interaction) {
        try {
            const initialBet = interaction.options.getInteger("tiencuoc");
            const creator = interaction.user;

            const userCreator = await User.findOne({ userId: creator.id });
            if (!userCreator || userCreator.money < initialBet) {
                return interaction.reply({ content: "❌ Bạn không đủ tiền khởi tạo hũ bom!", flags: 64 });
            }

            let players = [creator];
            let pot = initialBet;

            const lobbyEmbed = new EmbedBuilder()
                .setTitle("💣 PHÒNG CHỜ: BOM HẸN GIỜ")
                .setDescription(`👤 Chủ bom: <@${creator.id}>\n💰 Hũ khởi điểm: **${pot.toLocaleString()}** VND\n🎁 **Nhà cái:** Thưởng thêm tiền mỗi lượt!\n⚠️ **Luật:** Chỉ được ÔM TIỀN từ lượt chuyền thứ 4 trở đi.`)
                .setColor(0xffa500);

            const lobbyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("join_bomb").setLabel("Tham gia").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("start_bomb").setLabel("Bắt đầu").setStyle(ButtonStyle.Success)
            );

            const msg = await interaction.reply({ embeds: [lobbyEmbed], components: [lobbyRow], fetchReply: true });

            const lobbyCollector = msg.createMessageComponentCollector({ time: 45000 });

            lobbyCollector.on("collect", async (i) => {
                if (i.customId === "join_bomb") {
                    if (players.some(p => p.id === i.user.id)) return i.reply({ content: "Bạn đã tham gia rồi!", flags: 64 });
                    const pDB = await User.findOne({ userId: i.user.id });
                    if (!pDB || pDB.money < initialBet) return i.reply({ content: "Không đủ tiền!", flags: 64 });

                    players.push(i.user);
                    pot += initialBet;
                    await i.deferUpdate();
                    await interaction.editReply({ 
                        embeds: [lobbyEmbed.setDescription(`👤 Chủ bom: <@${creator.id}>\n💰 Hũ hiện tại: **${pot.toLocaleString()}** VND\n👥 Danh sách: ${players.map(p => `<@${p.id}>`).join(", ")}`)] 
                    });
                }

                if (i.customId === "start_bomb") {
                    if (i.user.id !== creator.id) return i.reply({ content: "Chỉ chủ phòng mới có thể bắt đầu!", flags: 64 });
                    if (players.length < 2) return i.reply({ content: "Cần ít nhất 2 người!", flags: 64 });
                    lobbyCollector.stop("started");
                }
            });

            lobbyCollector.on("collect", async (i) => {}); // Placeholder

            lobbyCollector.on("end", async (_, reason) => {
                if (reason === "started") {
                    for (const p of players) {
                        await User.findOneAndUpdate({ userId: p.id }, { $inc: { money: -initialBet } });
                    }
                    await startBombGame(interaction, players, pot, initialBet);
                } else {
                    await interaction.editReply({ content: "⏰ Phòng đã hủy.", embeds: [], components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error("LỖI BOM:", error);
        }
    }
};

async function startBombGame(interaction, players, currentPot, baseBet) {
    let currentIndex = 0;
    let passCount = 0;
    let pot = currentPot;
    const bonusPerPass = Math.floor(baseBet * 0.1);

    const updateGame = async (status) => {
        const explodeChance = Math.floor((1 - Math.pow(0.92, passCount)) * 100);
        
        // Cấu hình Nút bấm
        const gameRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pass_bomb").setLabel("Chuyền tiếp").setStyle(ButtonStyle.Primary)
        );

        // CHỐNG THÔNG ĐỒNG: Chỉ hiện nút Ôm tiền từ lượt thứ 4 (passCount >= 3)
        if (passCount >= 3) {
            gameRow.addComponents(
                new ButtonBuilder().setCustomId("hold_bomb").setLabel("🎁 Ôm tiền & Kết thúc").setStyle(ButtonStyle.Danger)
            );
        }

        const embed = new EmbedBuilder()
            .setTitle("💣 BOM ĐANG NÓNG - TIỀN ĐANG TĂNG!")
            .setDescription(`📍 Người giữ: <@${players[currentIndex].id}>\n💰 **Hũ hiện tại: ${pot.toLocaleString()} VND**\n🔥 Tỉ lệ nổ: **${explodeChance}%**\n\n${status}`)
            .setFooter({ text: passCount < 3 ? `Cần thêm ${3 - passCount} lượt chuyền nữa để có thể Ôm Tiền.` : "Cơ chế Ôm Tiền đã sẵn sàng!" })
            .setColor(passCount < 3 ? 0x5865F2 : (explodeChance > 60 ? 0xff0000 : 0xffff00));

        await interaction.editReply({ content: `🔔 Lượt của <@${players[currentIndex].id}>`, embeds: [embed], components: [gameRow] });
    };

    await updateGame("Trò chơi bắt đầu! Hãy chuyền bom nhanh nhất có thể.");

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000 
    });

    collector.on("collect", async (i) => {
        if (i.user.id !== players[currentIndex].id) return i.reply({ content: "Bạn không giữ bom!", flags: 64 });
        await i.deferUpdate();

        if (i.customId === "pass_bomb") {
            const chance = 1 - Math.pow(0.92, passCount);
            if (Math.random() < chance) {
                return collector.stop("exploded");
            }
            passCount++;
            pot += bonusPerPass; 
            currentIndex = (currentIndex + 1) % players.length;
            await updateGame("✅ Chuyền thành công! Hũ tiền đã tăng lên.");
        } 
        
        else if (i.customId === "hold_bomb") {
            // Chống trường hợp hack button gửi customId khi chưa đủ lượt
            if (passCount < 3) return; 

            if (Math.random() < 0.5) {
                return collector.stop("exploded_on_hold");
            } else {
                return collector.stop("took_the_money");
            }
        }
    });

    collector.on("end", async (_, reason) => {
        const loser = players[currentIndex];
        let resultMsg = "";

        if (reason === "exploded") {
            resultMsg = `💥 **BÙM!!!** Bom nổ khi đang chuyền. <@${loser.id}> làm mất trắng hũ **${pot.toLocaleString()}** VND!`;
        } 
        else if (reason === "exploded_on_hold") {
            resultMsg = `💥 **BÙM!** <@${loser.id}> định ôm tiền chạy nhưng bom nổ tức thì! Tham thì thâm rồi.`;
        } 
        else if (reason === "took_the_money") {
            const winner = players[currentIndex];
            await User.findOneAndUpdate({ userId: winner.id }, { $inc: { money: pot } });
            resultMsg = `🏆 **QUÁ ĐỈNH!** <@${winner.id}> đã ôm trọn hũ bom và nhận **${pot.toLocaleString()}** VND!`;
        } 
        else {
            resultMsg = `⏰ Hết thời gian, bom tự nổ! Hũ tiền tan thành mây khói.`;
        }

        await interaction.editReply({ content: resultMsg, embeds: [], components: [] });
    });
}