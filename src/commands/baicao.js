const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed, sleep } = require("../utils/ui");

const rooms = new Map();

// Vẽ lá bài đẹp: [A♠] [10♥] [7♦]
const renderCards = (cards) => cards.map((c) => `\`[${c}]\``).join(" ");
const HIDDEN = "`[🂠]` `[🂠]` `[🂠]`";

// Lời phán theo điểm
function scoreVerdict(score) {
    if (score === 9) return "🔥 **CHÍN NÚT — BÀI ĐẸP NHƯ MƠ!**";
    if (score >= 7) return "😎 Bài ngon đấy!";
    if (score >= 4) return "😐 Tàm tạm...";
    if (score >= 1) return "😬 Hơi non...";
    return "💀 **BÙ! Thảm họa!**";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baicao")
        .setDescription("🃏 Chơi Bài Cào - Solo với Bot hoặc lập Squad")
        .addIntegerOption((option) =>
            option.setName("tien").setDescription("Tiền cược (tối thiểu 10.000)").setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tien");
        if (bet < 10000) return interaction.reply({ content: "❌ Tiền cược tối thiểu là 10.000 VND!", flags: 64 });

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}, không đủ ra sân!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        const embed = casinoEmbed({ color: COLORS.purple, title: "🃏 ✦ SÒNG BÀI CÀO 3 LÁ ✦ 🃏" })
            .setDescription(
                `> 💰 Tiền cược: ${vnd(bet)}\n` +
                `> 🎯 Luật: 3 lá cộng điểm lấy hàng đơn vị — **9 nút là bá chủ!**\n\n` +
                `🤖 **Solo:** đấu tay đôi với Dealer, ăn thua ngay.\n` +
                `👥 **Squad:** lập phòng 2-17 người, cào hết hũ!`
            )
            .setFooter({ text: "Chọn chế độ chơi bên dưới 👇" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`baicao_solo_${bet}`).setLabel("Solo với Dealer").setEmoji("🤖").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`baicao_squad_init_${bet}`).setLabel("Lập Squad").setEmoji("👥").setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const prefix = parts[0];
        const action = parts[1];
        const betStr = parts[2];

        if (prefix !== "baicao") return;
        const bet = parseInt(betStr);

        // --- 🤖 SOLO VỚI DEALER ---
        if (action === "solo") {
            const user = await User.findOne({ userId: interaction.user.id });
            if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });

            const deck = createDeck();
            shuffle(deck);
            const userCards = [deck.pop(), deck.pop(), deck.pop()];
            const botCards = [deck.pop(), deck.pop(), deck.pop()];
            const userScore = calculateScore(userCards);
            const botScore = calculateScore(botCards);

            // 🎬 Hiệu ứng chia bài & lật bài
            await interaction.update({
                embeds: [casinoEmbed({ color: COLORS.purple, title: "🃏 DEALER ĐANG CHIA BÀI..." })
                    .setDescription(`> 🎴 *Xào bài... chia bài...*\n\n🧔 **Bạn:** ${HIDDEN}\n🤖 **Dealer:** ${HIDDEN}`)],
                components: [],
            });
            await sleep(1300);

            await interaction.editReply({
                embeds: [casinoEmbed({ color: COLORS.purple, title: "🃏 LẬT BÀI CỦA BẠN!" })
                    .setDescription(`🧔 **Bạn:** ${renderCards(userCards)} → **${userScore} nút**\n> ${scoreVerdict(userScore)}\n\n🤖 **Dealer:** ${HIDDEN}\n> *Dealer cười bí hiểm...* 😏`)],
            });
            await sleep(1600);

            let resultTitle, resultMsg, color;
            if (userScore > botScore) {
                user.money += bet;
                if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
                resultTitle = "🏆 BẠN THẮNG — DEALER TÁI MẶT!";
                resultMsg = `💸 **+${money(bet)} VND** → Ví: ${vnd(user.money + 0)}`;
                color = COLORS.green;
            } else if (userScore < botScore) {
                user.money -= bet;
                if (user.stats) { user.stats.lose++; user.stats.gamblePlayed++; }
                resultTitle = "💀 DEALER THẮNG — VỀ BỜ THÔI!";
                resultMsg = `🕳️ **-${money(bet)} VND** → Ví: ${vnd(user.money + 0)}`;
                color = COLORS.red;
            } else {
                resultTitle = "🤝 HÒA NÚT — CHIA ĐÔI CĂNG THẲNG!";
                resultMsg = `💼 Tiền cược được hoàn trả. Ví: ${vnd(user.money)}`;
                color = COLORS.gold;
            }
            await user.save();

            return interaction.editReply({
                embeds: [casinoEmbed({ color, title: resultTitle })
                    .setDescription(
                        `🧔 **Bạn:** ${renderCards(userCards)} → **${userScore} nút**\n` +
                        `🤖 **Dealer:** ${renderCards(botCards)} → **${botScore} nút**\n` +
                        `${"─".repeat(25)}\n${resultMsg}`
                    )
                    .setFooter({ text: "🃏 Gõ /baicao để chơi ván mới!" })],
                components: [],
            });
        }

        // --- 📂 MỞ MODAL SQUAD ---
        if (action === "squad" && parts[2] === "init") {
            const currentBet = parts[3];
            const modal = new ModalBuilder()
                .setCustomId(`baicao_modal_${currentBet}`)
                .setTitle("Cấu hình phòng Squad");

            const input = new TextInputBuilder()
                .setCustomId("player_count")
                .setLabel("Số người chơi (2-17)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Ví dụ: 3")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // --- 🎮 THAM GIA PHÒNG ---
        if (action === "join") {
            const room = rooms.get(interaction.message.id);
            if (!room || room.started) return interaction.reply({ content: "❌ Phòng không tồn tại hoặc đã bắt đầu!", flags: 64 });
            if (room.players.has(interaction.user.id)) return interaction.reply({ content: "❌ Bạn đã ở trong phòng!", flags: 64 });

            const user = await User.findOne({ userId: interaction.user.id });
            if (!user || user.money < room.bet) return interaction.reply({ content: `❌ Cần ${vnd(room.bet)} để vào phòng!`, flags: 64 });
            if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

            room.players.add(interaction.user.id);

            await interaction.update({ embeds: [renderRoom(room)] });

            if (room.players.size >= room.maxPlayers) {
                room.started = true;
                startGame(interaction.message, room);
            }
        }
    },

    async handleModal(interaction) {
        if (!interaction.customId.startsWith("baicao_modal")) return;

        const bet = parseInt(interaction.customId.split("_")[2]);
        const maxPlayers = parseInt(interaction.fields.getTextInputValue("player_count"));

        if (isNaN(bet)) return interaction.reply({ content: "❌ Lỗi: Không xác định được số tiền cược!", flags: 64 });
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 17) {
            return interaction.reply({ content: "❌ Số người phải từ 2 đến 17!", flags: 64 });
        }

        const roomData = {
            host: interaction.user.id,
            maxPlayers,
            bet,
            players: new Set([interaction.user.id]),
            started: false,
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("baicao_join").setLabel("Ngồi Vào Sòng").setEmoji("🪑").setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [renderRoom(roomData)], components: [row] });
        const msg = await interaction.fetchReply();
        rooms.set(msg.id, roomData);
    },
};

// Vẽ phòng chờ với ghế trống/đã ngồi
function renderRoom(room) {
    const seats = [];
    const playerArr = Array.from(room.players);
    for (let i = 0; i < room.maxPlayers; i++) {
        seats.push(playerArr[i] ? `> 🪑 <@${playerArr[i]}>${playerArr[i] === room.host ? " 👑" : ""}` : `> 💺 *— ghế trống —*`);
    }
    const pot = room.bet * room.maxPlayers;

    return casinoEmbed({ color: COLORS.orange, title: "🃏 PHÒNG SQUAD — ĐANG GOM NGƯỜI..." })
        .setDescription(
            `> 💰 Cược mỗi ghế: \`${money(room.bet)} VND\`\n` +
            `> 🏆 Hũ tối đa: \`${money(pot)} VND\` — cào nhất ăn hết!\n` +
            `> 👥 Sĩ số: **${room.players.size}/${room.maxPlayers}**\n` +
            `${"─".repeat(25)}\n${seats.join("\n")}`
        )
        .setFooter({ text: "🪑 Đủ người là chia bài luôn — nhanh tay kẻo hết ghế!" });
}

// ==========================================
// 🛠️ CÁC HÀM XỬ LÝ BÀI (giữ nguyên logic)
// ==========================================
function createDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck = [];
    for (const suit of suits) for (const value of values) deck.push(value + suit);
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function calculateScore(cards) {
    let total = 0;
    for (const card of cards) {
        let value = card.slice(0, -1);
        if (["J", "Q", "K"].includes(value)) total += 10;
        else if (value === "A") total += 1;
        else total += parseInt(value);
    }
    return total % 10;
}

async function startGame(message, room) {
    if (!room || isNaN(room.bet)) return;

    const channel = message.channel;
    await channel.send("🎴 **Đủ người!** Dealer đang xào bài... hồi hộp chưa? 😏");

    setTimeout(async () => {
        try {
            const deck = createDeck();
            shuffle(deck);

            const results = [];
            let highestScore = -1;

            for (const playerId of room.players) {
                const user = await User.findOne({ userId: playerId });
                if (user) {
                    user.money -= room.bet;
                    await user.save();
                }
                const cards = [deck.pop(), deck.pop(), deck.pop()];
                const score = calculateScore(cards);
                if (score > highestScore) highestScore = score;
                results.push({ playerId, cards, score });
            }

            const winners = results.filter((r) => r.score === highestScore);
            const totalPot = room.bet * room.players.size;
            const winAmount = Math.floor(totalPot / winners.length);

            for (const w of winners) {
                const user = await User.findOne({ userId: w.playerId });
                if (user) {
                    user.money += winAmount;
                    if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
                    await user.save();
                }
            }
            for (const r of results) {
                if (!winners.some((w) => w.playerId === r.playerId)) {
                    const user = await User.findOne({ userId: r.playerId });
                    if (user?.stats) { user.stats.lose++; user.stats.gamblePlayed++; await user.save(); }
                }
            }

            // Xếp hạng theo điểm giảm dần
            const sorted = [...results].sort((a, b) => b.score - a.score);
            const resultText = sorted.map((r, i) => {
                const isWinner = winners.some((w) => w.playerId === r.playerId);
                const medal = isWinner ? "👑" : i === sorted.length - 1 ? "💀" : "▫️";
                return `${medal} <@${r.playerId}> — ${renderCards(r.cards)} → **${r.score} nút**${r.score === 9 ? " 🔥" : ""}`;
            }).join("\n");

            const resultEmbed = casinoEmbed({ color: COLORS.gold, title: "🃏 LẬT BÀI — KẾT QUẢ SQUAD 🃏" })
                .setDescription(
                    `${resultText}\n${"─".repeat(25)}\n` +
                    `🏆 **Cào nhất:** ${winners.map((w) => `<@${w.playerId}>`).join(", ")} (${highestScore} nút)\n` +
                    `💰 **Ẵm về:** \`+${money(winAmount)} VND\`${winners.length > 1 ? ` *(chia đều hũ ${money(totalPot)})*` : ` *(trọn hũ!)*`}`
                )
                .setFooter({ text: "🃏 Gõ /baicao để mở sòng mới!" });

            await channel.send({ embeds: [resultEmbed] });
            rooms.delete(message.id);
            await message.delete().catch(() => {});
        } catch (e) {
            console.error("❌ [baicao] Lỗi chia bài squad:", e);
        }
    }, 2000);
}