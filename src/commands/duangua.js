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
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit } = require("../utils/ui");

const games = new Map();
const TRACK_LENGTH = 15;
const BET_TIME = 40000;
const LIVE_UPDATE_MS = 5000;

// 🐎 10 CHIẾN MÃ CÓ TÊN TUỔI
const HORSES = [
    { emoji: "🐎", name: "Xích Thố" },
    { emoji: "🦄", name: "Bạch Long" },
    { emoji: "🐴", name: "Ô Truy" },
    { emoji: "🎠", name: "Phi Vân" },
    { emoji: "🐎", name: "Hắc Phong" },
    { emoji: "🦓", name: "Vằn Điên" },
    { emoji: "🐴", name: "Thần Tốc" },
    { emoji: "🎠", name: "Cuồng Phong" },
    { emoji: "🐎", name: "Lôi Đế" },
    { emoji: "🦄", name: "Kỳ Lân" },
];

const COMMENTARY = [
    "đang bứt tốc kinh hoàng! 💨",
    "vượt lên dẫn đầu! 🔥",
    "phi nước đại như tên bắn! ⚡",
    "bỏ xa đối thủ phía sau! 😤",
    "đang gồng mình về đích! 💪",
];

// ---------- SẢNH CƯỢC LIVE ----------
function renderLobby(game) {
    const horseTotals = Array(10).fill(0);
    const horseCounts = Array(10).fill(0);
    let pot = 0;
    for (const bet of game.bets.values()) {
        horseTotals[bet.horse - 1] += bet.amount;
        horseCounts[bet.horse - 1]++;
        pot += bet.amount;
    }

    let board = "";
    for (let i = 0; i < 10; i++) {
        const hot = horseTotals[i] > 0 ? ` — 💵 \`${money(horseTotals[i])}\` (${horseCounts[i]}👥)` : "";
        board += `\`${String(i + 1).padStart(2)}\` ${HORSES[i].emoji} **${HORSES[i].name}**${hot}\n`;
    }

    return casinoEmbed({
        color: COLORS.gold,
        title: "🏇 ✦ TRƯỜNG ĐUA HOÀNG GIA ✦ 🏇",
    })
        .setDescription(
            `> 🏆 **Cơ cấu giải:** 🥇 Hạng 1 **x4** • 🥈 Hạng 2 **x2** • 🥉 Hạng 3 **x2**\n\n` +
            `⏳ **Xuất phát ${countdown(game.endsAt)}** — ${countdown(game.endsAt, "T")}\n` +
            `💰 Tổng hũ: ${vnd(pot)} • 🎫 **${game.bets.size}** vé\n\n` +
            `**🐎 DANH SÁCH CHIẾN MÃ:**\n${board}`
        )
        .setFooter({ text: "💡 Bấm số để đặt cược vào chiến mã bạn tin tưởng!" });
}

function lobbyButtons(disabled = false) {
    const rows = [];
    let row = new ActionRowBuilder();
    for (let i = 1; i <= 10; i++) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`duangua_${i}`)
                .setLabel(`${i}`)
                .setEmoji(HORSES[i - 1].emoji)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        );
        if (i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
    }
    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("duangua")
        .setDescription("🐎 Đua ngựa - Chọn ngựa từ 1 tới 10 và đặt cược!"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user && user.banned) {
            return interaction.reply({ content: "⛔ Bạn đã bị cấm tham gia cá cược!", flags: 64 });
        }

        const endsAt = Date.now() + BET_TIME;
        const gameData = { bets: new Map(), endsAt, isStarted: false };

        await interaction.reply({ embeds: [renderLobby(gameData)], components: lobbyButtons() });
        const msg = await interaction.fetchReply();
        games.set(msg.id, gameData);

        const liveInterval = setInterval(async () => {
            const g = games.get(msg.id);
            if (!g || g.isStarted) return clearInterval(liveInterval);
            await safeEdit(interaction, { embeds: [renderLobby(g)] }, msg.id);
        }, LIVE_UPDATE_MS);

        setTimeout(() => {
            clearInterval(liveInterval);
            startRace(interaction, msg).catch((e) => console.error("❌ [duangua] Lỗi cuộc đua:", e));
        }, BET_TIME);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Cuộc đua đã bắt đầu hoặc đã kết thúc!", flags: 64 });
        }
        if (game.bets.has(interaction.user.id)) {
            const old = game.bets.get(interaction.user.id);
            return interaction.reply({ content: `❌ Bạn đã cược ${vnd(old.amount)} vào ${HORSES[old.horse - 1].emoji} **${HORSES[old.horse - 1].name}** rồi!`, flags: 64 });
        }

        const horse = Number(interaction.customId.split("_")[1]);
        const modal = new ModalBuilder()
            .setCustomId(`duangua_modal_${horse}`)
            .setTitle(`${HORSES[horse - 1].emoji} Cược ${HORSES[horse - 1].name} (số ${horse})`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn cược (tối thiểu 1.000 VND)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("VD: 20000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const horse = Number(interaction.customId.split("_")[2]);
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount").replace(/[.,\s]/g, ""));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted || Date.now() >= game.endsAt) {
            return interaction.reply({ content: "❌ Hết thời gian cược! Tiền của bạn KHÔNG bị trừ.", flags: 64 });
        }
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tối thiểu 1.000 VND!", flags: 64 });

        let u = await User.findOne({ userId: interaction.user.id });
        if (!u || u.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(u?.money || 0)}!`, flags: 64 });

        u.money -= amount;
        await u.save();
        game.bets.set(interaction.user.id, { horse, amount });

        await interaction.reply({
            content: `✅ Đã cược ${vnd(amount)} vào ${HORSES[horse - 1].emoji} **${HORSES[horse - 1].name}** (số ${horse})!\n💼 Ví còn: ${vnd(u.money)} • Xuất phát ${countdown(game.endsAt)}`,
            flags: 64,
        });
    },
};

// ---------- 🏁 CUỘC ĐUA TRỰC TIẾP ----------
async function startRace(interaction, message) {
    const game = games.get(message.id);
    if (!game) return;
    game.isStarted = true;

    const positions = Array(10).fill(0);
    let finished = false;
    let tick = 0;

    const renderTrack = (commentLine) => {
        // Tìm ngựa dẫn đầu
        const maxPos = Math.max(...positions);
        let track = "";
        for (let i = 0; i < 10; i++) {
            const pos = Math.min(positions[i], TRACK_LENGTH);
            const lead = positions[i] === maxPos && maxPos > 0 ? "🔥" : "";
            track += `\`${String(i + 1).padStart(2)}\`🏁${"➖".repeat(TRACK_LENGTH - pos)}${HORSES[i].emoji}${lead}\n`;
        }
        return (
            `📣 ${commentLine}\n\n${track}\n` +
            `*(Ngựa chạy từ phải → trái, chạm 🏁 là về đích)*`
        );
    };

    const raceEmbed = (desc) =>
        casinoEmbed({ color: COLORS.green, title: "🏇 CUỘC ĐUA ĐANG DIỄN RA TRỰC TIẾP!" })
            .setDescription(desc)
            .setFooter({ text: "🎙️ Bình luận viên: BOT Casino" });

    await safeEdit(interaction, { embeds: [raceEmbed(renderTrack("**BÁM!** Các chiến mã đã xuất phát! 🚀"))], components: [] }, message.id);

    const interval = setInterval(async () => {
        tick++;
        for (let i = 0; i < 10; i++) {
            if (Math.random() > 0.4) positions[i] += Math.floor(Math.random() * 2) + 1;
            if (positions[i] >= TRACK_LENGTH) finished = true;
        }

        // Bình luận ngựa dẫn đầu
        const leadIdx = positions.indexOf(Math.max(...positions));
        const comment = `${HORSES[leadIdx].emoji} **${HORSES[leadIdx].name}** ${COMMENTARY[tick % COMMENTARY.length]}`;

        const ok = await safeEdit(interaction, { embeds: [raceEmbed(renderTrack(comment))] }, message.id);
        if (ok === null) {
            clearInterval(interval);
            games.delete(message.id);
            return;
        }

        if (finished) {
            clearInterval(interval);
            const rankedHorses = positions
                .map((pos, index) => ({ horse: index + 1, pos }))
                .sort((a, b) => (b.pos === a.pos ? (Math.random() > 0.5 ? 1 : -1) : b.pos - a.pos));
            await finishRace(interaction, message, rankedHorses);
        }
    }, 3500);
}

async function finishRace(interaction, message, rankedHorses) {
    const game = games.get(message.id);
    if (!game) return;

    try {
        const [first, second, third] = [rankedHorses[0].horse, rankedHorses[1].horse, rankedHorses[2].horse];
        const H = (n) => `${HORSES[n - 1].emoji} **${HORSES[n - 1].name}** (số ${n})`;

        let winners = [], losers = [];
        for (const [userId, bet] of game.bets.entries()) {
            const u = await User.findOne({ userId });
            if (!u) continue;
            if (bet.horse === first) {
                const winAmount = Math.floor(bet.amount * 4);
                u.money += winAmount;
                if (u.stats) u.stats.win++;
                winners.push(`> 🥇 <@${userId}> **+${money(winAmount)}** (${HORSES[bet.horse - 1].name})`);
            } else if (bet.horse === second || bet.horse === third) {
                const winAmount = Math.floor(bet.amount * 2);
                u.money += winAmount;
                if (u.stats) u.stats.win++;
                winners.push(`> ${bet.horse === second ? "🥈" : "🥉"} <@${userId}> **+${money(winAmount)}** (${HORSES[bet.horse - 1].name})`);
            } else {
                if (u.stats) u.stats.lose++;
                losers.push(`> 🕳️ <@${userId}> **-${money(bet.amount)}** (${HORSES[bet.horse - 1].name})`);
            }
            if (u.stats) u.stats.gamblePlayed++;
            await u.save();
        }

        const finalEmbed = casinoEmbed({ color: COLORS.gold, title: "🏁 KẾT QUẢ CHUNG CUỘC 🏁" })
            .setDescription(
                `## 🏆 BỤC VINH QUANG\n` +
                `> 🥇 **HẠNG NHẤT (x4):** ${H(first)}\n` +
                `> 🥈 **HẠNG HAI (x2):** ${H(second)}\n` +
                `> 🥉 **HẠNG BA (x2):** ${H(third)}\n` +
                `${"─".repeat(25)}\n` +
                `💸 **THẮNG CƯỢC (${winners.length})**\n${winners.slice(0, 10).join("\n") || "> Không ai chọn đúng top 3 😢"}` +
                `\n\n💀 **THUA CƯỢC (${losers.length})**\n${losers.slice(0, 10).join("\n") || "> Không ai mất tiền 😎"}`
            )
            .setFooter({ text: "🏇 Gõ /duangua để mở giải đua mới!" });

        await safeEdit(interaction, { embeds: [finalEmbed], components: [] }, message.id);
    } catch (err) {
        console.error("❌ [duangua] Lỗi trả thưởng:", err);
    } finally {
        games.delete(message.id);
    }
}