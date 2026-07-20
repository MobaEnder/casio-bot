const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const games = new Map();
const BET_TIME = 40000; // 40 giây đặt cược
const LIVE_UPDATE_MS = 5000;

const teams = [
    { name: "Real Madrid", emoji: "⚪" }, { name: "Man City", emoji: "🔵" },
    { name: "Manchester United", emoji: "🔴" }, { name: "Liverpool", emoji: "🔴" },
    { name: "Barcelona", emoji: "🔵" }, { name: "Bayern Munich", emoji: "🔴" },
    { name: "Arsenal", emoji: "🔴" }, { name: "Chelsea", emoji: "🔵" },
    { name: "PSG", emoji: "🔵" }, { name: "Inter Milan", emoji: "🔵" },
    { name: "AC Milan", emoji: "🔴" }, { name: "Juventus", emoji: "⚪" },
    { name: "Dortmund", emoji: "🟡" }, { name: "Atletico Madrid", emoji: "🔴" },
    { name: "Leverkusen", emoji: "🔴" }, { name: "Tottenham", emoji: "⚪" },
    { name: "Al Nassr", emoji: "🟡" }, { name: "Inter Miami", emoji: "💗" },
    { name: "Napoli", emoji: "🔵" }, { name: "Aston Villa", emoji: "🟣" },
];

const GOAL_FLAVOR = [
    "sút xa sấm sét nổ tung mành lưới! 🚀",
    "đánh đầu cắm không thể cản phá! 💥",
    "solo qua 3 hậu vệ rồi dứt điểm lạnh lùng! 🥶",
    "đá phạt cong như trái chuối vào góc chữ A! 🍌",
    "phản công thần tốc, VÀOOOO! ⚡",
];
const EVENT_FLAVOR = [
    "🟨 Thẻ vàng! Pha vào bóng rát chân...",
    "🧤 Thủ môn bay người cứu thua không tưởng!",
    "📺 VAR đang kiểm tra... không có gì!",
    "🥅 Bóng dội cột dọc! Trời ơi tiếc quá!",
    "🤕 Cầu thủ nằm sân câu giờ chuyên nghiệp...",
];

// ---------- SẢNH KÈO LIVE ----------
function renderLobby(game) {
    const totals = new Map(); // teamIndex -> {sum, count}
    let pot = 0;
    for (const bet of game.bets.values()) {
        const t = totals.get(bet.teamIndex) || { sum: 0, count: 0 };
        t.sum += bet.amount; t.count++;
        totals.set(bet.teamIndex, t);
        pot += bet.amount;
    }

    let board = "";
    const sorted = [...totals.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 8);
    for (const [idx, t] of sorted) {
        board += `> ${teams[idx].emoji} **${teams[idx].name}** — 💵 \`${money(t.sum)}\` (${t.count}👥)\n`;
    }

    return casinoEmbed({
        color: COLORS.green,
        title: "🏟️ ⚽ SIÊU CÚP THẾ GIỚI — MỞ KÈO ⚽ 🏟️",
    })
        .setDescription(
            `> 💰 Tỉ lệ trả thưởng: **1 ăn 15** — đổi đời trong 1 nốt nhạc!\n\n` +
            `⏳ **Khóa kèo ${countdown(game.endsAt)}** — ${countdown(game.endsAt, "T")}\n` +
            `💰 Tổng hũ: ${vnd(pot)} • 🎫 **${game.bets.size}** vé\n\n` +
            `**📊 BẢNG KÈO ĐANG NÓNG:**\n${board || "> *Chưa ai xuống tiền... mở bát nào!*"}`
        )
        .setFooter({ text: "👉 Chọn đội từ menu bên dưới • Đừng tin vào trọng tài!" });
}

function lobbyMenu(disabled = false) {
    const select = new StringSelectMenuBuilder()
        .setCustomId("cadobongda_select")
        .setPlaceholder("⚽ Chọn chiến mã của bạn...")
        .setDisabled(disabled)
        .addOptions(teams.map((t, i) => ({ label: t.name, value: i.toString(), emoji: t.emoji })));
    return new ActionRowBuilder().addComponents(select);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cadobongda")
        .setDescription("⚽ Cá độ bóng đá - Đặt 1 ăn 15!"),

    async execute(interaction) {
        const endsAt = Date.now() + BET_TIME;
        const gameData = { bets: new Map(), isStarted: false, endsAt };

        await interaction.reply({ embeds: [renderLobby(gameData)], components: [lobbyMenu()] });
        const response = await interaction.fetchReply();
        games.set(response.id, gameData);

        const liveInterval = setInterval(async () => {
            const g = games.get(response.id);
            if (!g || g.isStarted) return clearInterval(liveInterval);
            await safeEdit(interaction, { embeds: [renderLobby(g)] }, response.id);
        }, LIVE_UPDATE_MS);

        setTimeout(() => {
            clearInterval(liveInterval);
            startMatch(interaction, response.id).catch((e) => console.error("❌ [cadobongda] Lỗi trận đấu:", e));
        }, BET_TIME);
    },

    async handleMenu(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) return interaction.reply({ content: "❌ Trận đấu đã bắt đầu hoặc không tồn tại!", flags: 64 });

        if (game.bets.has(interaction.user.id)) {
            const old = game.bets.get(interaction.user.id);
            return interaction.reply({ content: `❌ Bạn đã đặt ${vnd(old.amount)} vào **${teams[old.teamIndex].name}** rồi!`, flags: 64 });
        }

        const teamIndex = parseInt(interaction.values[0]);
        const team = teams[teamIndex];

        const modal = new ModalBuilder()
            .setCustomId(`cadobongda_modal_${teamIndex}`)
            .setTitle(`${team.name} — nhập tiền cược`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn cược (tối thiểu 1.000 VND):")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("VD: 50000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const teamIndex = parseInt(interaction.customId.split("_")[2]);
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount").replace(/[.,\s]/g, ""));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted || Date.now() >= game.endsAt) {
            return interaction.reply({ content: "❌ Hết thời gian đặt cược! Tiền của bạn KHÔNG bị trừ.", flags: 64 });
        }
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tối thiểu cược 1.000 VND!", flags: 64 });

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn đang bị cấm cờ bạc!", flags: 64 });

        user.money -= amount;
        await user.save();
        game.bets.set(interaction.user.id, { teamIndex, amount });

        await interaction.reply({
            content: `✅ Đã đặt ${vnd(amount)} vào ${teams[teamIndex].emoji} **${teams[teamIndex].name}** (thắng nhận **${money(amount * 15)}**)!\n💼 Ví còn: ${vnd(user.money)} • Khóa kèo ${countdown(game.endsAt)}`,
            flags: 64,
        });
    },
};

// ---------- ⚽ MÔ PHỎNG TRẬN CHUNG KẾT TRỰC TIẾP ----------
async function startMatch(interaction, gameId) {
    const game = games.get(gameId);
    if (!game) return;
    game.isStarted = true;

    // --- LÕI NHÀ CÁI (giữ nguyên: 60% chọn đội ít tiền nhất) ---
    let teamTotals = new Array(teams.length).fill(0);
    game.bets.forEach((bet) => (teamTotals[bet.teamIndex] += bet.amount));

    let winnerIndex;
    if (Math.random() < 0.60) {
        const minMoney = Math.min(...teamTotals);
        const candidates = teamTotals.map((val, idx) => (val === minMoney ? idx : null)).filter((v) => v !== null);
        winnerIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        winnerIndex = Math.floor(Math.random() * teams.length);
    }

    // Chọn đối thủ cho trận chung kết: ưu tiên đội được cược nhiều nhất (khác winner)
    let loserIndex = teamTotals.indexOf(Math.max(...teamTotals));
    if (loserIndex === winnerIndex || teamTotals[loserIndex] === 0) {
        do { loserIndex = Math.floor(Math.random() * teams.length); } while (loserIndex === winnerIndex);
    }

    const A = teams[winnerIndex], B = teams[loserIndex];

    // Kịch bản tỉ số: đội thắng nhiều bàn hơn
    let scoreA = 0, scoreB = 0;
    const finalA = 1 + Math.floor(Math.random() * 3); // 1-3 bàn
    const finalB = Math.max(0, finalA - 1 - Math.floor(Math.random() * 2)); // luôn ít hơn

    // Dòng thời gian sự kiện
    const ticks = 8; // 8 khung hình ~ 90 phút
    const events = [];
    for (let i = 0; i < finalA; i++) events.push({ team: "A", at: 1 + Math.floor(Math.random() * (ticks - 1)) });
    for (let i = 0; i < finalB; i++) events.push({ team: "B", at: 1 + Math.floor(Math.random() * (ticks - 1)) });

    const scoreboard = (minute, log) =>
        casinoEmbed({ color: COLORS.blue, title: "⚽ TRỰC TIẾP CHUNG KẾT SIÊU CÚP 🏆" })
            .setDescription(
                `\`\`\`\n  ${A.name.padEnd(14).slice(0, 14)} ${scoreA} - ${scoreB} ${B.name.padEnd(14).slice(0, 14)}\n\`\`\`` +
                `🕐 **Phút ${minute}'**\n\n📻 **Diễn biến:**\n${log.slice(-4).join("\n") || "> Bóng lăn giữa sân..."}`
            )
            .setFooter({ text: "🎙️ Bình luận: BOT Casino Sports" });

    const log = [`> 🟢 **1'** Trọng tài nổi còi khai cuộc!`];
    await safeEdit(interaction, { embeds: [scoreboard(1, log)], components: [] }, gameId);

    for (let t = 1; t <= ticks; t++) {
        await sleep(3500);
        const minute = Math.min(90, Math.floor((t / ticks) * 90));
        const goals = events.filter((e) => e.at === t);

        if (goals.length > 0) {
            for (const g of goals) {
                if (g.team === "A") { scoreA++; log.push(`> ⚽ **${minute}'** GOOOAL! ${A.emoji} **${A.name}** ${GOAL_FLAVOR[Math.floor(Math.random() * GOAL_FLAVOR.length)]}`); }
                else { scoreB++; log.push(`> ⚽ **${minute}'** ${B.emoji} **${B.name}** có bàn gỡ! ${GOAL_FLAVOR[Math.floor(Math.random() * GOAL_FLAVOR.length)]}`); }
            }
        } else {
            log.push(`> **${minute}'** ${EVENT_FLAVOR[Math.floor(Math.random() * EVENT_FLAVOR.length)]}`);
        }
        await safeEdit(interaction, { embeds: [scoreboard(minute, log)] }, gameId);
    }

    // ---------- TRẢ THƯỞNG ----------
    try {
        let winnersList = [], losersList = [];
        for (const [userId, bet] of game.bets.entries()) {
            const uData = await User.findOne({ userId });
            if (!uData) continue;
            if (bet.teamIndex === winnerIndex) {
                const winAmt = bet.amount * 15;
                uData.money += winAmt;
                if (uData.stats) uData.stats.win++;
                winnersList.push(`> 💸 <@${userId}> **+${money(winAmt)}** 🤑`);
            } else {
                if (uData.stats) uData.stats.lose++;
                losersList.push(`> 🕳️ <@${userId}> **-${money(bet.amount)}** (${teams[bet.teamIndex].name})`);
            }
            if (uData.stats) uData.stats.gamblePlayed++;
            await uData.save();
        }

        const finalEmbed = casinoEmbed({ color: COLORS.gold, title: `🏆 NHÀ VÔ ĐỊCH: ${A.name.toUpperCase()} 🏆` })
            .setDescription(
                `\`\`\`\n  CHUNG CUỘC: ${A.name} ${scoreA} - ${scoreB} ${B.name}\n\`\`\`` +
                `${A.emoji} **${A.name}** nâng cao chiếc cúp danh giá! 🎉🎊\n` +
                `${"─".repeat(25)}\n` +
                `💰 **TRÚNG KÈO x15 (${winnersList.length})**\n${winnersList.join("\n") || "> Không đại gia nào chọn đúng! Nhà cái hốt trọn 😈"}` +
                `\n\n💀 **VỠ KÈO (${losersList.length})**\n${losersList.slice(0, 10).join("\n") || "> Không ai mất tiền 😎"}`
            )
            .setFooter({ text: "⚽ Thắng làm vua, thua cày tiếp • Gõ /cadobongda để mở kèo mới" });

        await safeEdit(interaction, { embeds: [finalEmbed], components: [] }, gameId);
    } catch (err) {
        console.error("❌ [cadobongda] Lỗi trả thưởng:", err);
    } finally {
        games.delete(gameId);
    }
}