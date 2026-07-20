const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, versusBar, bar, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const games = new Map();
const FIGHT_TIME = 10000; // 10 giây đá
const BET_TIME = 30000;   // 30 giây đặt cược
const LIVE_UPDATE_MS = 5000;

// ---------- SẢNH CƯỢC LIVE ----------
function renderLobby(game) {
    let totalRed = 0, totalBlack = 0, countRed = 0, countBlack = 0;
    for (const bet of game.bets.values()) {
        if (bet.side === "red") { totalRed += bet.amount; countRed++; }
        else { totalBlack += bet.amount; countBlack++; }
    }

    return casinoEmbed({
        color: COLORS.red,
        title: "🐔⚔️ SÀN ĐẤU GÀ TRỰC TIẾP ⚔️🐔",
    })
        .setDescription(
            `> 🎯 Cửa thắng ăn **x1.95** tiền cược!\n\n` +
            `⏳ **Vào trận ${countdown(game.endsAt)}** — ${countdown(game.endsAt, "T")}\n\n` +
            `${versusBar(totalRed, totalBlack, 12, "🟥", "⬛")}`
        )
        .addFields(
            { name: "🔴 GÀ ĐỎ (Meron)", value: `💵 ${vnd(totalRed)}\n👥 **${countRed}** người tin`, inline: true },
            { name: "🆚", value: "⚔️", inline: true },
            { name: "⚫ GÀ ĐEN (Wala)", value: `💵 ${vnd(totalBlack)}\n👥 **${countBlack}** người tin`, inline: true }
        )
        .setFooter({ text: "💡 Bấm nút chọn chiến kê • BOT Casino 💎" });
}

function lobbyButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("daga_red").setLabel("Gà Đỏ").setEmoji("🔴").setStyle(ButtonStyle.Danger).setDisabled(disabled),
        new ButtonBuilder().setCustomId("daga_black").setLabel("Gà Đen").setEmoji("⚫").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daga")
        .setDescription("🐔 Đá gà"),

    async execute(interaction) {
        const endsAt = Date.now() + BET_TIME;
        const gameData = { bets: new Map(), isStarted: false, endsAt, interaction };

        await interaction.reply({ embeds: [renderLobby(gameData)], components: [lobbyButtons()] });
        const msg = await interaction.fetchReply();
        games.set(msg.id, gameData);

        const liveInterval = setInterval(async () => {
            const g = games.get(msg.id);
            if (!g || g.isStarted) return clearInterval(liveInterval);
            await safeEdit(interaction, { embeds: [renderLobby(g)] }, msg.id);
        }, LIVE_UPDATE_MS);

        setTimeout(() => {
            clearInterval(liveInterval);
            startFight(interaction, msg).catch((e) => console.error("❌ [daga] Lỗi trận đấu:", e));
        }, BET_TIME);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Trận đấu đã bắt đầu hoặc kết thúc!", flags: 64 });
        }
        if (game.bets.has(interaction.user.id)) {
            const old = game.bets.get(interaction.user.id);
            return interaction.reply({ content: `❌ Bạn đã cược ${vnd(old.amount)} cho **Gà ${old.side === "red" ? "Đỏ 🔴" : "Đen ⚫"}** rồi!`, flags: 64 });
        }

        const side = interaction.customId === "daga_red" ? "red" : "black";
        const modal = new ModalBuilder()
            .setCustomId(`daga_modal_${side}`)
            .setTitle(`🐔 Cược Gà ${side === "red" ? "Đỏ 🔴" : "Đen ⚫"}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền cược (tối thiểu 1.000 VND)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("VD: 10000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const side = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount").replace(/[.,\s]/g, ""));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted || Date.now() >= game.endsAt) {
            return interaction.reply({ content: "❌ Hết thời gian đặt cược! Tiền của bạn KHÔNG bị trừ.", flags: 64 });
        }
        if (isNaN(amount) || amount < 1000) {
            return interaction.reply({ content: "❌ Tiền cược tối thiểu là 1.000 VND!", flags: 64 });
        }

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) {
            return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        }
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm tham gia!", flags: 64 });

        user.money -= amount;
        await user.save();
        game.bets.set(interaction.user.id, { side, amount });

        await interaction.reply({
            content: `✅ Đã đặt ${vnd(amount)} cho 🐔 **Gà ${side === "red" ? "Đỏ 🔴" : "Đen ⚫"}**!\n💼 Ví còn: ${vnd(user.money)} • Vào trận ${countdown(game.endsAt)}`,
            flags: 64,
        });
    },
};

// ---------- 🎬 TRẬN ĐẤU VỚI THANH MÁU ----------
async function startFight(interaction, message) {
    const game = games.get(message.id);
    if (!game) return;
    game.isStarted = true;

    // Quyết định kết quả TRƯỚC (giữ nguyên lõi 40/60)
    let totalRed = 0, totalBlack = 0;
    for (const bet of game.bets.values()) {
        if (bet.side === "red") totalRed += bet.amount;
        else totalBlack += bet.amount;
    }

    let winnerSide;
    if (totalRed === 0 && totalBlack === 0) {
        winnerSide = Math.random() < 0.5 ? "red" : "black";
    } else {
        const isHouseWin = Math.random() < 0.60;
        if (totalRed > totalBlack) winnerSide = isHouseWin ? "black" : "red";
        else if (totalBlack > totalRed) winnerSide = isHouseWin ? "red" : "black";
        else winnerSide = Math.random() < 0.5 ? "red" : "black";
    }

    // Kịch bản máu: gà thắng về đích 100%->cao, gà thua tụt dần về 0
    const rounds = 5;
    const actions = ["⚔️ lao vào mổ tới tấp!", "💥 tung cựa sắt chí mạng!", "🌪️ né đòn rồi phản công!", "🔥 đạp thẳng vào ngực đối thủ!", "⚡ ra đòn kết liễu!"];

    let hpRed = 100, hpBlack = 100;
    for (let i = 0; i < rounds; i++) {
        // Gà thua mất nhiều máu hơn mỗi hiệp
        const dmgToLoser = 15 + Math.floor(Math.random() * 12);
        const dmgToWinner = 4 + Math.floor(Math.random() * 8);
        if (winnerSide === "red") { hpBlack -= dmgToLoser; hpRed -= dmgToWinner; }
        else { hpRed -= dmgToLoser; hpBlack -= dmgToWinner; }
        hpRed = Math.max(winnerSide === "red" ? 15 : 0, hpRed);
        hpBlack = Math.max(winnerSide === "black" ? 15 : 0, hpBlack);
        if (i === rounds - 1) { if (winnerSide === "red") hpBlack = 0; else hpRed = 0; }

        const attacker = Math.random() < (winnerSide === "red" ? 0.7 : 0.3) ? "🔴 Gà Đỏ" : "⚫ Gà Đen";
        const fightEmbed = casinoEmbed({
            color: COLORS.orange,
            title: `🐔 HIỆP ${i + 1}/${rounds} — TRẬN ĐẤU NẢY LỬA!`,
        }).setDescription(
            `> **${attacker}** ${actions[i]}\n\n` +
            `🔴 **GÀ ĐỎ** \`${String(Math.max(0, hpRed)).padStart(3)}%\`\n${bar(hpRed / 100, 12, "🟥", "⬛")}\n\n` +
            `⚫ **GÀ ĐEN** \`${String(Math.max(0, hpBlack)).padStart(3)}%\`\n${bar(hpBlack / 100, 12, "⬜", "⬛")}`
        ).setFooter({ text: "Trận đấu được giám sát bởi Hội Gà Bịp Quốc Tế 🏅" });

        await safeEdit(interaction, { embeds: [fightEmbed], components: [] }, message.id);
        await sleep(FIGHT_TIME / rounds);
    }

    await finishFight(interaction, message, winnerSide);
}

async function finishFight(interaction, message, winnerSide) {
    const game = games.get(message.id);
    if (!game) return;

    try {
        let winners = [], losers = [];
        let totalPaid = 0;

        for (const [userId, bet] of game.bets.entries()) {
            const user = await User.findOne({ userId });
            if (!user) continue;

            if (bet.side === winnerSide) {
                const winAmount = Math.floor(bet.amount * 1.95);
                user.money += winAmount;
                totalPaid += winAmount;
                if (user.stats) user.stats.win++;
                winners.push(`> 💸 <@${userId}> **+${money(winAmount)}**`);
            } else {
                if (user.stats) user.stats.lose++;
                losers.push(`> 🕳️ <@${userId}> **-${money(bet.amount)}**`);
            }
            if (user.stats) user.stats.gamblePlayed++;
            await user.save();
        }

        const isRed = winnerSide === "red";
        const embed = casinoEmbed({
            color: isRed ? COLORS.red : COLORS.dark,
            title: "🏆 KẾT QUẢ TRẬN ĐẤU 🏆",
        })
            .setDescription(
                `# ${isRed ? "🔴 GÀ ĐỎ" : "⚫ GÀ ĐEN"} CHIẾN THẮNG!\n` +
                `> ${isRed ? "Gà Đen" : "Gà Đỏ"} đã nằm sân... 🐔💫\n` +
                `${"─".repeat(25)}\n` +
                `🏆 **THẮNG (${winners.length})**\n${winners.slice(0, 8).join("\n") || "> Không ai cược cửa này 😢"}` +
                `\n\n💀 **THUA (${losers.length})**\n${losers.slice(0, 8).join("\n") || "> Không ai mất tiền 😎"}`
            )
            .setFooter({ text: `💰 Tổng trả thưởng: ${money(totalPaid)} VND • Gõ /daga để mở trận mới` });

        await safeEdit(interaction, { embeds: [embed], components: [] }, message.id);
    } catch (err) {
        console.error("❌ [daga] Lỗi trả thưởng:", err);
    } finally {
        games.delete(message.id);
    }
}