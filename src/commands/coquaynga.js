const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed, sleep } = require("../utils/ui");

// Tạo ổ đạn: 1 viên thật trong 6 ngăn (giữ nguyên)
function shuffleChamber(size = 6) {
    let chambers = Array(size).fill(0);
    chambers[Math.floor(Math.random() * size)] = 1;
    return chambers;
}

// Vẽ ổ đạn: ngăn đã bắn ⚪, ngăn còn lại ❓
function renderChamber(step, total = 6) {
    let s = "";
    for (let i = 0; i < total; i++) s += i < step ? "⚪" : "❓";
    return s;
}

// Tỉ lệ dính đạn ở lượt tiếp theo
const deathChance = (step) => Math.round((1 / (6 - step)) * 100);

const TENSION = [
    "Ngón tay run rẩy đặt lên cò súng...",
    "Mồ hôi lạnh chảy dọc sống lưng...",
    "Tim đập thình thịch như trống trận...",
    "Cả sòng nín thở theo dõi...",
    "Tử thần đang đứng sau lưng bạn...",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coquaynga")
        .setDescription("🔫 Chế độ Solo hoặc Tạo phòng Đối đầu")
        .addIntegerOption((opt) =>
            opt.setName("tiencuoc").setDescription("Số tiền cược").setRequired(true).setMinValue(1000)
        ),

    async execute(interaction) {
        try {
            const bet = interaction.options.getInteger("tiencuoc");
            const challenger = interaction.user;

            const userChallenger = await User.findOne({ userId: challenger.id });
            if (!userChallenger || userChallenger.money < bet) {
                return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(userChallenger?.money || 0)}, không đủ tạo phòng!`, flags: 64 });
            }
            if (userChallenger.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

            const lobbyEmbed = casinoEmbed({ color: COLORS.dark, title: "🔫 ✦ PHÒNG CHỜ CÒ QUAY NGA ✦ 🔫" })
                .setDescription(
                    `\`\`\`\n   ╭─────────╮\n   │  🔫 ❓x6 │  1 viên thật\n   ╰─────────╯\n\`\`\`` +
                    `> 👤 Chủ phòng: <@${challenger.id}>\n` +
                    `> 💰 Tiền cược: ${vnd(bet)}\n` +
                    `> 🎁 Thưởng nhà cái: **+50%** nếu sống sót\n\n` +
                    `🎯 **Solo:** sống qua 5 phát bóp cò → nhận **${money(bet + Math.floor(bet * 0.5))} VND**\n` +
                    `⚔️ **Đối đầu:** thay phiên bóp cò, kẻ sống ẵm **${money(bet * 2 + Math.floor(bet * 0.5))} VND**`
                )
                .setFooter({ text: "⏰ Phòng tự hủy sau 60s nếu không bắt đầu" });

            const lobbyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("start_solo").setLabel("Chơi Solo").setEmoji("🎯").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("start_duel").setLabel("Đối Đầu (1vs1)").setEmoji("⚔️").setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds: [lobbyEmbed], components: [lobbyRow] });
            const lobbyMsg = await interaction.fetchReply();

            const lobbyCollector = lobbyMsg.createMessageComponentCollector({ time: 60000 });

            lobbyCollector.on("collect", async (i) => {
                if (i.customId === "start_solo") {
                    if (i.user.id !== challenger.id) return i.reply({ content: "❌ Chỉ chủ phòng mới có thể chọn Solo!", flags: 64 });
                    lobbyCollector.stop("solo");
                    await i.deferUpdate();
                    await startSolo(interaction, bet, challenger);
                } else if (i.customId === "start_duel") {
                    if (i.user.id === challenger.id) return i.reply({ content: "❌ Bạn không thể đối đầu với chính mình!", flags: 64 });

                    const opponentDB = await User.findOne({ userId: i.user.id });
                    if (!opponentDB || opponentDB.money < bet) return i.reply({ content: `❌ Cần ${vnd(bet)} để nhận kèo!`, flags: 64 });
                    if (opponentDB.banned) return i.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

                    lobbyCollector.stop("duel");
                    await i.deferUpdate();
                    await startDuel(interaction, bet, challenger, i.user);
                }
            });

            lobbyCollector.on("end", (_, reason) => {
                if (reason === "time") {
                    interaction.editReply({ content: "⏰ Phòng chờ đã hết hạn — không ai dám chơi 😏", embeds: [], components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error("LỖI COQUAYNGA:", error);
        }
    },
};

// --- 🎯 CHẾ ĐỘ SOLO ---
async function startSolo(interaction, bet, userObj) {
    const user = await User.findOne({ userId: userObj.id });
    user.money -= bet;
    await user.save();

    let chambers = shuffleChamber(6);
    let step = 0;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("solo_fire").setLabel("BÓP CÒ").setEmoji("💥").setStyle(ButtonStyle.Danger)
    );

    const soloEmbed = (txt, color = COLORS.blue) =>
        casinoEmbed({ color, title: "🎯 SOLO SINH TỬ — 5 PHÁT ĐỊNH MỆNH" })
            .setDescription(
                `${txt}\n\n` +
                `🔫 Ổ đạn: ${renderChamber(step)}\n` +
                `✅ Đã sống sót: **${step}/5** phát\n` +
                `☠️ Tỉ lệ dính đạn phát tới: **${deathChance(step)}%**`
            )
            .setFooter({ text: `💰 Đang cược: ${money(bet)} VND • Sống 5 phát nhận ${money(bet + Math.floor(bet * 0.5))} VND` });

    const updateSolo = (txt, color) =>
        interaction.editReply({ content: " ", embeds: [soloEmbed(txt, color)], components: [row] });

    await updateSolo(`> <@${userObj.id}> cầm khẩu súng lên...\n> *6 ngăn đạn, 1 viên thật. Số phận trong tay bạn!*`);

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        filter: (i) => i.user.id === userObj.id,
        componentType: ComponentType.Button,
        time: 120000,
    });

    collector.on("collect", async (i) => {
        await i.deferUpdate();
        row.components[0].setDisabled(true);
        await updateSolo(`> 😰 *${TENSION[Math.floor(Math.random() * TENSION.length)]}*`, COLORS.orange);
        await sleep(1200);

        if (chambers[step] === 1) return collector.stop("dead");

        step++;
        if (step === 5) return collector.stop("win");

        row.components[0].setDisabled(false);
        await updateSolo(`> 🍀 **CẠCH!** Ngăn trống — thoát chết trong gang tấc!\n> Dám bóp tiếp không? 😈`, COLORS.green);
    });

    collector.on("end", async (_, reason) => {
        if (reason === "dead") {
            if (user.stats) { user.stats.lose++; user.stats.gamblePlayed++; await user.save(); }
            await interaction.editReply({
                content: " ",
                embeds: [casinoEmbed({ color: COLORS.red, title: "💥 ĐOÀNH!!! VIÊN ĐẠN ĐỊNH MỆNH" })
                    .setDescription(
                        `\`\`\`\n   💥🔫\n   😵 (gục xuống)\n\`\`\`` +
                        `> <@${userObj.id}> đã tử trận ở phát thứ **${step + 1}**...\n🕳️ Mất trắng **-${money(bet)} VND**`
                    )
                    .setFooter({ text: "⚰️ RIP • Gõ /coquaynga để đầu thai chơi tiếp" })],
                components: [],
            });
        } else if (reason === "win") {
            const prize = bet + Math.floor(bet * 0.5);
            user.money += prize;
            if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
            await user.save();
            await interaction.editReply({
                content: " ",
                embeds: [casinoEmbed({ color: COLORS.gold, title: "🏆 THẦN CHẾT CŨNG PHẢI NỂ!" })
                    .setDescription(
                        `\`\`\`\n   🔫 ⚪⚪⚪⚪⚪❓\n   😎 (phủi bụi vai áo)\n\`\`\`` +
                        `> <@${userObj.id}> sống sót qua **cả 5 phát** bóp cò!\n` +
                        `💰 Nhận về **+${money(prize)} VND** (vốn + 50% thưởng)\n💼 Ví: ${vnd(user.money)}`
                    )
                    .setFooter({ text: "🎯 Gan lì thật sự • Gõ /coquaynga để thử vận tiếp" })],
                components: [],
            });
        }
    });
}

// --- ⚔️ CHẾ ĐỘ ĐỐI ĐẦU ---
async function startDuel(interaction, bet, challenger, opponent) {
    const uC = await User.findOne({ userId: challenger.id });
    const uO = await User.findOne({ userId: opponent.id });

    uC.money -= bet;
    uO.money -= bet;
    await uC.save();
    await uO.save();

    let chambers = shuffleChamber(6);
    let players = [challenger, opponent];
    let turn = 0;
    let step = 0;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("duel_fire").setLabel("BÓP CÒ").setEmoji("💥").setStyle(ButtonStyle.Danger)
    );

    const duelEmbed = (txt, color = COLORS.red) =>
        casinoEmbed({ color, title: "⚔️ ĐẤU SÚNG SINH TỬ 1vs1 ⚔️" })
            .setDescription(
                `> 🅰️ <@${players[0].id}> ${turn === 0 ? "🔫 **ĐANG CẦM SÚNG**" : "😨 *đang cầu nguyện*"}\n` +
                `> 🅱️ <@${players[1].id}> ${turn === 1 ? "🔫 **ĐANG CẦM SÚNG**" : "😨 *đang cầu nguyện*"}\n\n` +
                `${txt}\n\n` +
                `🔫 Ổ đạn: ${renderChamber(step)}\n☠️ Tỉ lệ dính đạn phát tới: **${deathChance(step)}%**`
            )
            .setFooter({ text: `💰 Tổng giải: ${money(bet * 2 + Math.floor(bet * 0.5))} VND • Kẻ sống lấy hết!` });

    const updateDuel = (txt, color) =>
        interaction.editReply({ content: `🎯 Lượt của: <@${players[turn].id}>`, embeds: [duelEmbed(txt, color)], components: [row] });

    await updateDuel("> 🔔 Trận tử chiến bắt đầu! Hai bên đã đặt cược.\n> *Khẩu súng lạnh lẽo được đặt lên bàn...*");

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000,
    });

    collector.on("collect", async (i) => {
        if (i.user.id !== players[turn].id) return i.reply({ content: "❌ Không phải lượt của bạn! Đứng yên chờ số phận...", flags: 64 });

        await i.deferUpdate();
        row.components[0].setDisabled(true);
        await updateDuel(`> 😰 *${TENSION[Math.floor(Math.random() * TENSION.length)]}*`, COLORS.orange);
        await sleep(1300);

        if (chambers[step] === 1) return collector.stop("dead");

        step++;
        turn = 1 - turn;
        row.components[0].setDisabled(false);
        await updateDuel("> 🍀 **CẠCH!** Ngăn trống!\n> 😮‍💨 Khẩu súng được chuyển sang tay đối thủ...", COLORS.green);
    });

    collector.on("end", async (_, reason) => {
        if (reason === "dead") {
            const winner = players[1 - turn];
            const loser = players[turn];
            const prize = bet * 2 + Math.floor(bet * 0.5);
            const winDB = await User.findOne({ userId: winner.id });
            winDB.money += prize;
            if (winDB.stats) { winDB.stats.win++; winDB.stats.gamblePlayed++; }
            await winDB.save();
            const loseDB = await User.findOne({ userId: loser.id });
            if (loseDB?.stats) { loseDB.stats.lose++; loseDB.stats.gamblePlayed++; await loseDB.save(); }

            await interaction.editReply({
                content: " ",
                embeds: [casinoEmbed({ color: COLORS.gold, title: "🏆 KẺ SỐNG SÓT CUỐI CÙNG!" })
                    .setDescription(
                        `\`\`\`\n   💥🔫  😵 (${loser.username})\n   😎 (${winner.username} đứng phủi tay)\n\`\`\`` +
                        `> ☠️ <@${loser.id}> gục ngã ở phát thứ **${step + 1}**...\n` +
                        `> 👑 <@${winner.id}> **SỐNG SÓT** và ẵm trọn **+${money(prize)} VND**!\n\n` +
                        `⛓️ *Kẻ thua bị trói vào cột 1 phút (timeout)*`
                    )
                    .setFooter({ text: "⚔️ Gõ /coquaynga để mở kèo tử chiến mới" })],
                components: [],
            });

            // Phạt timeout người thua 1 phút (nếu bot có quyền) — giữ nguyên
            try { await interaction.guild.members.cache.get(loser.id).timeout(60000, "Thua Cò Quay Nga"); } catch (e) {}
        }
    });
}