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

const games = new Map();
const FIGHT_TIME = 10000; // 10 giây đá
const BET_TIME = 30000;   // 30 giây đặt cược

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daga")
        .setDescription("🐔 Đá gà - Chọn Gà Đỏ (Meron) hoặc Gà Đen (Wala)!"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xff3333)
            .setTitle("🐔 SÀN ĐẤU GÀ TRỰC TIẾP")
            .setDescription(
                "🎯 **Đặt cược vào chiến kê bạn tin tưởng:**\n\n" +
                "🔴 **GÀ ĐỎ (Meron)** - Tỉ lệ x1.95\n" +
                "⚫ **GÀ ĐEN (Wala)** - Tỉ lệ x1.95\n\n" +
                "⏳ Thời gian đặt cược: **30 giây**"
            )
            .setFooter({ text: "BOT Casino 💎" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("daga_red")
                .setLabel("Gà Đỏ")
                .setEmoji("🔴")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("daga_black")
                .setLabel("Gà Đen")
                .setEmoji("⚫")
                .setStyle(ButtonStyle.Secondary)
        );

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        games.set(msg.id, {
            bets: new Map(),
            isStarted: false,
        });

        setTimeout(() => startFight(msg), BET_TIME);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Trận đấu đã bắt đầu hoặc kết thúc!", flags: 64 });
        }

        const side = interaction.customId === "daga_red" ? "red" : "black";
        const modal = new ModalBuilder()
            .setCustomId(`daga_modal_${side}`)
            .setTitle(`🐔 Đặt cược Gà ${side === "red" ? "Đỏ" : "Đen"}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền cược (VND)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const side = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Hết thời gian đặt cược!", flags: 64 });
        }

        if (isNaN(amount) || amount < 1000) {
            return interaction.reply({ content: "❌ Tiền cược tối thiểu là 1.000 VND!", flags: 64 });
        }

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) {
            return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
        }

        // 🔥 TRỪ TIỀN NGAY LẬP TỨC
        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { side, amount });

        await interaction.reply({
            content: `✅ Đã đặt **${amount.toLocaleString()} VND** cho 🐔 **Gà ${side === "red" ? "Đỏ" : "Đen"}**.`,
            flags: 64,
        });
    },
};

async function startFight(message) {
    const game = games.get(message.id);
    if (!game) return;
    game.isStarted = true;

    const frames = [
        "🐔🔴   ⚔️   ⚫🐔",
        "🐔🔴  💥   ⚫🐔",
        "   🐔🔴💨   ⚫🐔",
        "🐔🔴   💥  ⚫🐔",
        "🐔🔴   ⚔️   ⚫🐔",
        "🐔🔴    💨⚫🐔",
    ];

    const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("🐔 TRẬN ĐẤU ĐANG CĂNG THẲNG!")
        .setDescription(frames[0]);

    await message.edit({ embeds: [embed], components: [] });

    let count = 0;
    const interval = setInterval(async () => {
        count++;
        const frame = frames[count % frames.length];
        await message.edit({ embeds: [embed.setDescription(frame)] }).catch(() => {});
    }, 2000);

    setTimeout(async () => {
        clearInterval(interval);
        const winner = Math.random() < 0.5 ? "red" : "black";
        await finishFight(message, winner);
    }, FIGHT_TIME);
}

async function finishFight(message, winnerSide) {
    const game = games.get(message.id);
    if (!game) return;

    let resultText = "";
    const promises = Array.from(game.bets.entries()).map(async ([userId, bet]) => {
        const user = await User.findOne({ userId });
        if (!user) return;

        if (bet.side === winnerSide) {
            const winAmount = Math.floor(bet.amount * 1.95); // Thắng nhận lại vốn + 0.95 tiền thưởng
            user.money += winAmount;
            resultText += `✅ <@${userId}> +${winAmount.toLocaleString()} VND\n`;
        } else {
            resultText += `❌ <@${userId}> -${bet.amount.toLocaleString()} VND\n`;
        }
        await user.save();
    });

    await Promise.all(promises);

    const embed = new EmbedBuilder()
        .setColor(winnerSide === "red" ? "Red" : "NotQuiteBlack")
        .setTitle("🏆 KẾT QUẢ TRẬN ĐẤU")
        .setDescription(
            `🥇 **Gà thắng:** ${winnerSide === "red" ? "🔴 GÀ ĐỎ" : "⚫ GÀ ĐEN"}\n\n` +
            `💰 **Chi tiết:**\n${resultText || "Không có ai tham gia đặt cược."}`
        )
        .setTimestamp();

    await message.edit({ embeds: [embed] });
    games.delete(message.id);
}