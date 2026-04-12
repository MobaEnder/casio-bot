const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");

const User = require("../models/User");

const rooms = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baicao")
        .setDescription("🃏 Chơi Bài Cào - Solo với Bot hoặc lập Squad")
        .addIntegerOption(option =>
            option.setName("tien")
                .setDescription("Tiền cược (tối thiểu 10.000)")
                .setRequired(true)),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tien");

        if (bet < 10000) {
            return interaction.reply({ content: "❌ Tiền cược tối thiểu là 10.000 VND!", flags: 64 });
        }

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) {
            return interaction.reply({ content: "❌ Bạn không đủ tiền để ra sân!", flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🃏 SÒNG BÀI CÀO")
            .setDescription(
                `💰 Tiền cược: **${bet.toLocaleString()} VND**\n\n` +
                `🤖 **Solo**: Chơi nhanh với Dealer (Bot).\n` +
                `👥 **Squad**: Tạo phòng đợi người khác vào cướp tiền.`
            )
            .setFooter({ text: "Chọn chế độ chơi bên dưới" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`baicao_solo_${bet}`)
                .setLabel("Solo với Bot")
                .setEmoji("🤖")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`baicao_squad_init_${bet}`) // Truyền bet vào đây
                .setLabel("Lập Squad")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Success)
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

        // --- 🤖 CHẾ ĐỘ SOLO ---
        if (action === "solo") {
            const user = await User.findOne({ userId: interaction.user.id });
            if (!user || user.money < bet) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });

            const deck = createDeck();
            shuffle(deck);

            const userCards = [deck.pop(), deck.pop(), deck.pop()];
            const botCards = [deck.pop(), deck.pop(), deck.pop()];

            const userScore = calculateScore(userCards);
            const botScore = calculateScore(botCards);

            let resultMsg = "";
            let color = "Grey";

            if (userScore > botScore) {
                user.money += bet;
                resultMsg = `🏆 **Bạn thắng!** Nhận \`+${bet.toLocaleString()}\` VND`;
                color = "Green";
            } else if (userScore < botScore) {
                user.money -= bet;
                resultMsg = `💀 **Bot thắng!** Bạn mất \`-${bet.toLocaleString()}\` VND`;
                color = "Red";
            } else {
                resultMsg = `🤝 **Hòa!** Tiền cược được hoàn trả.`;
            }
            await user.save();

            const soloEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle("🃏 KẾT QUẢ SOLO")
                .addFields(
                    { name: "🧔 Bạn", value: `Bài: \`${userCards.join(" ")}\`\nĐiểm: **${userScore}**`, inline: true },
                    { name: "🤖 Bot", value: `Bài: \`${botCards.join(" ")}\`\nĐiểm: **${botScore}**`, inline: true }
                )
                .setDescription(resultMsg);

            return interaction.update({ embeds: [soloEmbed], components: [] });
        }

        // --- 📂 MỞ MODAL SQUAD ---
        if (action === "squad" && parts[2] === "init") {
            const currentBet = parts[3]; // Lấy giá trị tiền cược từ vị trí cuối
            const modal = new ModalBuilder()
                .setCustomId(`baicao_modal_${currentBet}`) // Gắn tiền vào ID Modal
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
            if (!user || user.money < room.bet) return interaction.reply({ content: "❌ Bạn không đủ tiền tham gia!", flags: 64 });

            room.players.add(interaction.user.id);

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setDescription(
                    `👑 Chủ phòng: <@${room.host}>\n` +
                    `👥 Sĩ số: **${room.players.size}/${room.maxPlayers}**\n` +
                    `💰 Cược: **${room.bet.toLocaleString()} VND**\n\n` +
                    `🏃‍♂️ Danh sách: ${Array.from(room.players).map(id => `<@${id}>`).join(", ")}`
                );

            await interaction.update({ embeds: [embed] });

            if (room.players.size >= room.maxPlayers) {
                room.started = true;
                startGame(interaction.message, room);
            }
        }
    },

    async handleModal(interaction) {
        if (!interaction.customId.startsWith("baicao_modal")) return;
        
        // customId là "baicao_modal_10000" -> split sẽ lấy index 2
        const bet = parseInt(interaction.customId.split("_")[2]);
        const maxPlayers = parseInt(interaction.fields.getTextInputValue("player_count"));

        if (isNaN(bet)) {
            return interaction.reply({ content: "❌ Lỗi: Không xác định được số tiền cược!", flags: 64 });
        }

        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 17) {
            return interaction.reply({ content: "❌ Số người phải từ 2 đến 17!", flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("🃏 PHÒNG SQUAD ĐANG ĐỢI...")
            .setDescription(
                `👑 Chủ phòng: <@${interaction.user.id}>\n` +
                `👥 Sĩ số: **1/${maxPlayers}**\n` +
                `💰 Cược: **${bet.toLocaleString()} VND**\n\n` +
                `👉 Nhấn nút bên dưới để tham gia!`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`baicao_join`)
                .setLabel("Tham Gia Squad")
                .setStyle(ButtonStyle.Success)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        rooms.set(msg.id, {
            host: interaction.user.id,
            maxPlayers,
            bet, // Lưu bet vào map, đảm bảo không bị NaN
            players: new Set([interaction.user.id]),
            started: false,
        });
    }
};

// ==========================================
// 🛠️ CÁC HÀM XỬ LÝ BÀI
// ==========================================

function createDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push(value + suit);
        }
    }
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
    await channel.send("⏳ Đủ người! Đang chia bài...");

    setTimeout(async () => {
        const deck = createDeck();
        shuffle(deck);

        const results = [];
        let highestScore = -1;

        // Trừ tiền và chia bài
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

        const winners = results.filter(r => r.score === highestScore);
        const totalPot = room.bet * room.players.size;
        const winAmount = Math.floor(totalPot / winners.length);

        // Trao thưởng
        for (const w of winners) {
            const user = await User.findOne({ userId: w.playerId });
            if (user) {
                user.money += winAmount;
                await user.save();
            }
        }

        const resultText = results.map(r =>
            `<@${r.playerId}>: \`${r.cards.join(" ")}\` (**${r.score}** điểm)`
        ).join("\n");

        const resultEmbed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🃏 KẾT QUẢ SQUAD")
            .setDescription(
                `${resultText}\n\n` +
                `🏆 **Người thắng:** ${winners.map(w => `<@${w.playerId}>`).join(", ")}\n` +
                `💰 Tiền thưởng: **+${winAmount.toLocaleString()} VND**`
            );

        await channel.send({ embeds: [resultEmbed] });
        rooms.delete(message.id);
        await message.delete().catch(() => {});
    }, 2000);
}