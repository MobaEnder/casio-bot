const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed } = require("../utils/ui");
const JackpotPool = require("../utils/jackpotPool");

const games = new Map();
const DECK_SIZE = 15;
const BOMBS = 4;
const MULT_STEP = 1.25; // Mỗi lá an toàn: hệ số x1.25

const SAFE_CATS = ["😺", "😸", "😹", "😻", "🐱", "🐈", "😽", "🙀"];
const SAFE_FLAVOR = [
    "Mèo con dễ thương! Thoát nạn!",
    "Chỉ là mèo lười đang ngủ... phù!",
    "Mèo béo đòi ăn, không nổ!",
    "Meo meo~ an toàn tuyệt đối!",
];

function renderGame(game, statusLine, color = COLORS.purple) {
    const remaining = game.deck.length;
    const bombsLeft = game.deck.filter((c) => c === "💣").length;
    const bombChance = remaining > 0 ? Math.round((bombsLeft / remaining) * 100) : 0;
    const payout = Math.floor(game.bet * game.mult);
    const riskIcon = bombChance >= 50 ? "🟥" : bombChance >= 30 ? "🟧" : "🟩";

    return casinoEmbed({ color, title: "🐱💣 ✦ MÈO NỔ — RÚT HAY CHẠY? ✦ 💣🐱" })
        .setDescription(
            `> 💵 Cược: ${vnd(game.bet)} • Mỗi lá an toàn hệ số **x${MULT_STEP}**\n${"─".repeat(25)}\n` +
            `🎴 **Bộ bài còn:** ${remaining} lá *(trong đó **${bombsLeft}** 💣 mèo nổ!)*\n` +
            `${riskIcon} **Tỉ lệ rút trúng nổ:** ${bombChance}%\n${bar(bombChance / 100, 12, riskIcon, "⬛")}\n\n` +
            `📈 **Hệ số hiện tại:** x${game.mult.toFixed(2)}\n` +
            `💰 **Ôm tiền ngay được:** \`${money(payout)} VND\` *(lãi ${payout - game.bet >= 0 ? "+" : ""}${money(payout - game.bet)})*\n\n` +
            `🐾 Đã rút: ${game.drawn.join(" ") || "*chưa lá nào*"}\n\n${statusLine}`
        )
        .setFooter({ text: "😼 Càng rút hệ số càng phồng... nhưng mèo nổ đang rình đấy!" });
}

function gameButtons(game, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("meono_draw").setLabel("RÚT BÀI").setEmoji("🎴").setStyle(ButtonStyle.Danger).setDisabled(disabled),
        new ButtonBuilder().setCustomId("meono_cashout").setLabel(`ÔM ${money(Math.floor(game.bet * game.mult))} & CHẠY`).setEmoji("🏃").setStyle(ButtonStyle.Success).setDisabled(disabled || game.drawn.length === 0)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("meono")
        .setDescription("🐱💣 Mèo Nổ - Rút bài né bom, hệ số nhân phồng dần!")
        .addIntegerOption((opt) => opt.setName("tiencuoc").setDescription("Tiền cược (tối thiểu 1.000)").setRequired(true).setMinValue(1000)),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        user.money -= bet;
        await user.save();

        // Tạo bộ bài: trộn bom vào
        const deck = [];
        for (let i = 0; i < DECK_SIZE - BOMBS; i++) deck.push(SAFE_CATS[Math.floor(Math.random() * SAFE_CATS.length)]);
        for (let i = 0; i < BOMBS; i++) deck.push("💣");
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        const game = { userId: interaction.user.id, bet, deck, mult: 1.0, drawn: [] };

        await interaction.reply({ embeds: [renderGame(game, "> 😼 *Bộ bài đã xáo — rút lá đầu tiên nào!*")], components: [gameButtons(game)] });
        const msg = await interaction.fetchReply();
        games.set(msg.id, game);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Ván này đã kết thúc!", flags: 64 });
        if (interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải ván của bạn!", flags: 64 });

        // 🎴 RÚT BÀI
        if (interaction.customId === "meono_draw") {
            const card = game.deck.pop();

            if (card === "💣") {
                games.delete(interaction.message.id);
                const user = await User.findOne({ userId: game.userId });
                if (user?.stats) { user.stats.lose++; user.stats.gamblePlayed++; await user.save(); }
                JackpotPool.contribute(game.bet);
                JackpotPool.tryExplode(interaction.client, interaction.channelId, game.userId);

                return interaction.update({
                    embeds: [casinoEmbed({ color: COLORS.red, title: "💥 MÈO NỔ!!! BÙMMMM!!!" })
                        .setDescription(
                            `\`\`\`\n   🐱💣\n   💥💥💥\n   ☠️ (bay màu)\n\`\`\`` +
                            `> 😹 Bạn rút trúng **MÈO NỔ** ở lá thứ **${game.drawn.length + 1}**!\n` +
                            `> 🕳️ Mất trắng **-${money(game.bet)} VND** cùng hệ số x${game.mult.toFixed(2)} đang phồng...\n\n` +
                            `🐾 Hành trình: ${game.drawn.join(" ")} 💣`
                        )
                        .setFooter({ text: "🐱 Mèo giận thì mèo nổ • /meono chơi lại!" })],
                    components: [],
                });
            }

            // Lá an toàn
            game.drawn.push(card);
            game.mult = parseFloat((game.mult * MULT_STEP).toFixed(4));

            // Rút hết bài an toàn → PHÁ ĐẢO, tự ôm tiền x thêm bonus
            const bombsLeft = game.deck.filter((c) => c === "💣").length;
            if (game.deck.length === bombsLeft) {
                games.delete(interaction.message.id);
                const payout = Math.floor(game.bet * game.mult * 1.5); // Bonus phá đảo x1.5
                const user = await User.findOne({ userId: game.userId });
                user.money += payout;
                if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
                await user.save();

                return interaction.update({
                    embeds: [casinoEmbed({ color: COLORS.gold, title: "👑 PHÁ ĐẢO — VÉT SẠCH MÈO LÀNH!" })
                        .setDescription(
                            `> 😻 Bạn rút hết **${game.drawn.length}** lá an toàn, chỉ còn toàn bom trong bộ!\n` +
                            `> 🎁 **BONUS PHÁ ĐẢO x1.5!**\n` +
                            `> 💰 Tổng nhận: **+${money(payout)} VND**\n> 💼 Ví: ${vnd(user.money)}\n\n` +
                            `🐾 ${game.drawn.join(" ")}`
                        )
                        .setFooter({ text: "👑 Thần rút bài là đây! • /meono chơi tiếp" })],
                    components: [],
                });
            }

            return interaction.update({
                embeds: [renderGame(game, `> ${card} *${SAFE_FLAVOR[Math.floor(Math.random() * SAFE_FLAVOR.length)]}* Hệ số nhảy lên **x${game.mult.toFixed(2)}**!`, COLORS.green)],
                components: [gameButtons(game)],
            });
        }

        // 🏃 ÔM TIỀN
        if (interaction.customId === "meono_cashout") {
            games.delete(interaction.message.id);
            const payout = Math.floor(game.bet * game.mult);
            const profit = payout - game.bet;
            const user = await User.findOne({ userId: game.userId });
            user.money += payout;
            if (user.stats) {
                if (profit >= 0) user.stats.win++;
                else user.stats.lose++;
                user.stats.gamblePlayed++;
            }
            await user.save();

            return interaction.update({
                embeds: [casinoEmbed({ color: COLORS.cyan, title: "🏃 ÔM TIỀN CHẠY THOÁT — KHÔN NHƯ MÈO!" })
                    .setDescription(
                        `\`\`\`\n   💰🏃💨\n   😾 (lũ mèo nổ tức tối nhìn theo)\n\`\`\`` +
                        `> 🎴 Rút được **${game.drawn.length}** lá an toàn • Hệ số chốt: **x${game.mult.toFixed(2)}**\n` +
                        `> 💰 Thu về: **+${money(payout)} VND** *(lãi ${profit >= 0 ? "+" : ""}${money(profit)})*\n` +
                        `> 💼 Ví: ${vnd(user.money)}\n\n🐾 ${game.drawn.join(" ")}`
                    )
                    .setFooter({ text: "😼 Biết đủ là khôn • /meono thử vận tiếp!" })],
                components: [],
            });
        }
    },
};