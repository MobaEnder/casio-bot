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
const { COLORS, money, vnd, bar, casinoEmbed } = require("../utils/ui");

const games = new Map();
const MAX_TRIES = 7;
// Hệ số thưởng theo lần đoán trúng: lần 1 = x10... lần 7 = x1.1
const MULTS = [10, 5, 3, 2, 1.5, 1.3, 1.1];

function renderGame(game, statusLine, color = COLORS.blue) {
    const triesLeft = MAX_TRIES - game.tries.length;
    return casinoEmbed({ color, title: "🔢 ✦ ĐOÁN SỐ ĂN TIỀN ✦ 🔢" })
        .setDescription(
            `> 💵 Cược: ${vnd(game.bet)} • Bot đã nghĩ 1 số từ **1 → 100**\n` +
            `> 🎯 Đoán trúng lần thứ N → ăn hệ số: ${MULTS.map((m, i) => `L${i + 1}:**x${m}**`).join(" ")}\n${"─".repeat(25)}\n` +
            `🧮 **Lịch sử đoán:** ${game.tries.map((t) => `\`${t.n}${t.hint}\``).join(" → ") || "*chưa đoán lần nào*"}\n` +
            `📍 **Khoảng còn lại:** \`${game.low} → ${game.high}\`\n` +
            `❤️ **Lượt còn:** ${triesLeft}/${MAX_TRIES}\n${bar(triesLeft / MAX_TRIES, 10, "🟩", "🟥")}\n\n${statusLine}`
        )
        .setFooter({ text: "💡 ⬆️ = số bí mật LỚN hơn • ⬇️ = số bí mật NHỎ hơn" });
}

function guessButton(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("doanso_guess").setLabel("ĐOÁN SỐ").setEmoji("🎯").setStyle(ButtonStyle.Primary).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("doanso")
        .setDescription("🔢 Đoán số 1-100 - Đoán càng nhanh ăn càng đậm (tối đa x10)!")
        .addIntegerOption((opt) => opt.setName("tiencuoc").setDescription("Tiền cược (tối thiểu 1.000)").setRequired(true).setMinValue(1000)),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        user.money -= bet;
        await user.save();

        const game = {
            userId: interaction.user.id,
            bet,
            secret: Math.floor(Math.random() * 100) + 1,
            tries: [],
            low: 1,
            high: 100,
        };

        await interaction.reply({ embeds: [renderGame(game, "> 🤖 *Bot đã chốt số bí mật... đoán đi nào!*")], components: [guessButton()] });
        const msg = await interaction.fetchReply();
        games.set(msg.id, game);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Ván này đã kết thúc!", flags: 64 });
        if (interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải ván của bạn!", flags: 64 });

        const modal = new ModalBuilder().setCustomId("doanso_modal").setTitle(`🎯 Lần đoán thứ ${game.tries.length + 1}/${MAX_TRIES}`);
        const input = new TextInputBuilder()
            .setCustomId("guess_num")
            .setLabel(`Nhập số (gợi ý: từ ${game.low} đến ${game.high})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("VD: 50")
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Ván này đã kết thúc!", flags: 64 });
        if (interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải ván của bạn!", flags: 64 });

        const n = parseInt(interaction.fields.getTextInputValue("guess_num").trim());
        if (isNaN(n) || n < 1 || n > 100) return interaction.reply({ content: "❌ Nhập số từ 1 đến 100!", flags: 64 });

        await interaction.deferUpdate();

        // 🎯 ĐOÁN TRÚNG
        if (n === game.secret) {
            games.delete(interaction.message.id);
            const tryNum = game.tries.length + 1;
            game.tries.push({ n, hint: "🎯" });
            const mult = MULTS[tryNum - 1];
            const winTotal = Math.floor(game.bet * mult);

            const user = await User.findOne({ userId: game.userId });
            user.money += winTotal;
            if (user.stats) { user.stats.win++; user.stats.gamblePlayed++; }
            await user.save();

            return interaction.editReply({
                embeds: [renderGame(game,
                    `# 🎯 CHÍNH XÁC! SỐ BÍ MẬT LÀ **${game.secret}**!\n` +
                    `> 🏆 Trúng ngay lần thứ **${tryNum}** → hệ số **x${mult}**\n` +
                    `> 💰 Nhận về: **+${money(winTotal)} VND** • Ví: ${vnd(user.money)}`,
                    COLORS.gold
                ).setFooter({ text: "🔮 Thầy bói chính hiệu! • /doanso làm ván nữa" })],
                components: [],
            });
        }

        // Đoán sai → gợi ý
        const hint = n < game.secret ? "⬆️" : "⬇️";
        game.tries.push({ n, hint });
        if (n < game.secret && n >= game.low) game.low = n + 1;
        if (n > game.secret && n <= game.high) game.high = n - 1;

        // 💀 HẾT LƯỢT
        if (game.tries.length >= MAX_TRIES) {
            games.delete(interaction.message.id);
            const user = await User.findOne({ userId: game.userId });
            if (user?.stats) { user.stats.lose++; user.stats.gamblePlayed++; await user.save(); }

            return interaction.editReply({
                embeds: [renderGame(game,
                    `# 💀 HẾT LƯỢT! Số bí mật là **${game.secret}**\n> 🕳️ Mất **-${money(game.bet)} VND**... tiếc ghê!`,
                    COLORS.red
                ).setFooter({ text: "🔢 Gõ /doanso phục thù!" })],
                components: [],
            });
        }

        return interaction.editReply({
            embeds: [renderGame(game, `> ${hint} **${n}** ${n < game.secret ? "nhỏ quá — số bí mật LỚN hơn!" : "to quá — số bí mật NHỎ hơn!"}`)],
            components: [guessButton()],
        });
    },
};