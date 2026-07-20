const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed, safeEdit, sleep } = require("../utils/ui");
const JackpotPool = require("../utils/jackpotPool");

const games = new Map();
const HIDDEN = "`[🂠]`";
const renderCards = (cards) => cards.map((c) => `\`[${c.v}${c.s}]\``).join(" ");

function createDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck = [];
    for (const s of suits) for (const v of values) deck.push({ v, s });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Tính điểm kiểu Xì Dách VN: A = 1/10/11 (chọn tốt nhất ≤ 21)
function score(cards) {
    let base = 0, aces = 0;
    for (const c of cards) {
        if (c.v === "A") aces++;
        else if (["J", "Q", "K"].includes(c.v)) base += 10;
        else base += parseInt(c.v);
    }
    if (aces === 0) return base;
    let best = -1;
    const opts = [1, 10, 11];
    const combos = (n) => (n === 1 ? opts.map((o) => [o]) : combos(n - 1).flatMap((c) => opts.map((o) => [...c, o])));
    for (const combo of combos(aces)) {
        const total = base + combo.reduce((a, b) => a + b, 0);
        if (total <= 21 && total > best) best = total;
    }
    return best === -1 ? base + aces : best; // Quắc thì trả điểm nhỏ nhất
}

// Kiểm tra bài đặc biệt lúc chia 2 lá
function special(cards) {
    if (cards.length !== 2) return null;
    const aces = cards.filter((c) => c.v === "A").length;
    if (aces === 2) return "xiban"; // Xì Bàng
    if (aces === 1 && cards.some((c) => ["10", "J", "Q", "K"].includes(c.v))) return "xidach"; // Xì Dách
    return null;
}

function gameEmbed(game, revealDealer, statusLine, color = COLORS.blue) {
    const pScore = score(game.player);
    const dScore = score(game.dealer);
    return casinoEmbed({ color, title: "🃏 ✦ SÒNG XÌ DÁCH ✦ 🃏" })
        .setDescription(
            `> 💵 Cược: ${vnd(game.bet)} • Thắng thường **x2** • Xì Dách/Ngũ Linh **x2.5** • Xì Bàng **x3**\n${"─".repeat(25)}\n` +
            `🧔 **BÀI CỦA BẠN** (${game.player.length} lá — **${pScore} điểm**${pScore > 21 ? " 💥 QUẮC!" : ""})\n${renderCards(game.player)}\n\n` +
            `🤖 **NHÀ CÁI** ${revealDealer ? `(${game.dealer.length} lá — **${dScore} điểm**${dScore > 21 ? " 💥 QUẮC!" : ""})` : "(1 lá úp)"}\n` +
            `${revealDealer ? renderCards(game.dealer) : `${renderCards([game.dealer[0]])} ${HIDDEN}`}\n\n${statusLine}`
        )
        .setFooter({ text: "🃏 Rút: thêm bài • Dằn: giữ nguyên chờ nhà cái lật" });
}

function buttons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("xidach_hit").setLabel("RÚT BÀI").setEmoji("🎴").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("xidach_stand").setLabel("DẰN BÀI").setEmoji("✋").setStyle(ButtonStyle.Success).setDisabled(disabled)
    );
}

async function settle(interaction, game, msgId) {
    const pScore = score(game.player);
    const pSpecial = special(game.player);
    const pNguLinh = game.player.length >= 5 && pScore <= 21;

    // 🤖 Nhà cái rút đến khi đủ 17
    let revealStatus = "> 🤖 *Nhà cái lật bài...*";
    await safeEdit(interaction, { embeds: [gameEmbed(game, true, revealStatus, COLORS.orange)], components: [buttons(true)] }, msgId);
    await sleep(1300);

    while (score(game.dealer) < 17 && game.deck.length > 0) {
        game.dealer.push(game.deck.pop());
        await safeEdit(interaction, { embeds: [gameEmbed(game, true, "> 🤖 *Nhà cái rút thêm 1 lá...*", COLORS.orange)], components: [buttons(true)] }, msgId);
        await sleep(1300);
    }

    const dScore = score(game.dealer);
    const dSpecial = special(game.dealer);
    const dNguLinh = game.dealer.length >= 5 && dScore <= 21;

    // Xếp hạng tay bài: Xì Bàng > Xì Dách > Ngũ Linh > điểm thường
    const rank = (sp, nl, sc) => (sp === "xiban" ? 400 : sp === "xidach" ? 300 : nl ? 200 : sc > 21 ? -1 : sc);
    const pRank = rank(pSpecial, pNguLinh, pScore);
    const dRank = rank(dSpecial, dNguLinh, dScore);

    const user = await User.findOne({ userId: game.userId });
    let title, desc, color;

    if (pRank > dRank) {
        const mult = pSpecial === "xiban" ? 3 : pSpecial === "xidach" || pNguLinh ? 2.5 : 2;
        const winTotal = Math.floor(game.bet * mult);
        user.money += winTotal;
        if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
        title = pSpecial === "xiban" ? "👑 XÌ BÀNG — VÔ ĐỐI!" : pSpecial === "xidach" ? "🌟 XÌ DÁCH — ĐẸP NHƯ MƠ!" : pNguLinh ? "🐉 NGŨ LINH — TUYỆT PHẨM!" : "🏆 BẠN THẮNG NHÀ CÁI!";
        desc = `💰 Nhận về: **+${money(winTotal)} VND** (x${mult})\n💼 Ví: ${vnd(user.money)}`;
        color = COLORS.green;
    } else if (pRank < dRank) {
        if (user.stats) { user.stats.lose++; user.stats.gamblePlayed++; }
        title = pScore > 21 ? "💥 QUẮC RỒI — CHÁY BÀI!" : "💀 NHÀ CÁI THẮNG!";
        desc = `🕳️ Mất: **-${money(game.bet)} VND**\n💼 Ví: ${vnd(user.money)}`;
        color = COLORS.red;
    } else {
        user.money += game.bet; // Hòa hoàn tiền
        title = "🤝 HÒA ĐIỂM — HOÀN TIỀN!";
        desc = `💼 Tiền cược được trả lại. Ví: ${vnd(user.money)}`;
        color = COLORS.gold;
    }
    await user.save();
    if (pRank < dRank) JackpotPool.contribute(game.bet);
    JackpotPool.tryExplode(interaction.client, interaction.channelId, game.userId);

    await safeEdit(interaction, {
        embeds: [gameEmbed(game, true, `# ${title}\n${desc}`, color).setFooter({ text: "🃏 Gõ /xidach làm ván nữa!" })],
        components: [],
    }, msgId);
    games.delete(msgId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("xidach")
        .setDescription("🃏 Xì Dách kinh điển - Đấu trí với nhà cái!")
        .addIntegerOption((opt) => opt.setName("tiencuoc").setDescription("Tiền cược (tối thiểu 1.000)").setRequired(true).setMinValue(1000)),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        user.money -= bet;
        await user.save();

        const deck = createDeck();
        const game = { userId: interaction.user.id, bet, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()] };

        await interaction.reply({ embeds: [gameEmbed(game, false, "> 🎴 *Bài đã chia — quyết định đi!*")], components: [buttons()] });
        const msg = await interaction.fetchReply();
        games.set(msg.id, game);

        // Xì Bàng / Xì Dách ngay từ đầu → lật luôn
        if (special(game.player) || special(game.dealer)) {
            await sleep(1200);
            await settle(interaction, game, msg.id);
        }
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Ván bài đã kết thúc!", flags: 64 });
        if (interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải bài của bạn, đừng nhòm!", flags: 64 });

        await interaction.deferUpdate();

        if (interaction.customId === "xidach_hit") {
            game.player.push(game.deck.pop());
            const pScore = score(game.player);

            if (pScore > 21) return settle(interaction, game, interaction.message.id); // Quắc
            if (game.player.length >= 5) return settle(interaction, game, interaction.message.id); // Ngũ linh tự dằn

            return safeEdit(interaction, {
                embeds: [gameEmbed(game, false, `> 🎴 Rút được \`[${game.player[game.player.length - 1].v}${game.player[game.player.length - 1].s}]\` — rút tiếp hay dằn?`)],
                components: [buttons()],
            }, interaction.message.id);
        }

        if (interaction.customId === "xidach_stand") {
            const pScore = score(game.player);
            if (pScore < 16) {
                return safeEdit(interaction, {
                    embeds: [gameEmbed(game, false, `> ⚠️ **Chưa đủ 16 điểm (non tuổi)!** Luật sòng bắt buộc rút thêm.`, COLORS.orange)],
                    components: [buttons()],
                }, interaction.message.id);
            }
            return settle(interaction, game, interaction.message.id);
        }
    },
};