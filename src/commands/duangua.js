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

const games = new Map(); // messageId -> game data
const TRACK_LENGTH = 15; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName("duangua")
        .setDescription("🐎 Đua ngựa - Chọn ngựa từ 1 tới 10 và đặt cược!"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user && user.banned) {
            return interaction.reply({
                content: "⛔ Bạn đã bị cấm tham gia cá cược!",
                flags: 64,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setTitle("🐎 TRƯỜNG ĐUA NGỰA")
            .setDescription(
                "🎯 Chọn **ngựa số 1 → 10** để đặt cược!\n" +
                "⏳ Cuộc đua sẽ bắt đầu sau **40 giây**...\n\n" +
                "🐎 **Danh sách ngựa chiến:**\n" +
                "1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣\n" +
                "6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟"
            )
            .setTimestamp();

        const rows = [];
        let row = new ActionRowBuilder();
        for (let i = 1; i <= 10; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`duangua_${i}`)
                    .setLabel(`${i}`)
                    .setStyle(ButtonStyle.Secondary)
            );
            if (i % 5 === 0) {
                rows.push(row);
                row = new ActionRowBuilder();
            }
        }

        // Fix cảnh báo Deprecated: dùng withResponse thay cho fetchReply
        const response = await interaction.reply({
            embeds: [embed],
            components: rows,
            withResponse: true,
        });

        const msg = response.resource.message;

        games.set(msg.id, {
            bets: new Map(),
            endsAt: Date.now() + 40000,
            isStarted: false
        });

        setTimeout(() => startRace(msg), 40000);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Cuộc đua đã bắt đầu!", flags: 64 });
        }

        const horse = Number(interaction.customId.split("_")[1]);
        const modal = new ModalBuilder()
            .setCustomId(`duangua_modal_${horse}`)
            .setTitle(`🐎 Đặt cược ngựa số ${horse}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn cược (VND)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const horse = Number(interaction.customId.split("_")[2]);
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted) return interaction.reply({ content: "❌ Hết thời gian cược!", flags: 64 });
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tối thiểu 1.000 VND!", flags: 64 });

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) return interaction.reply({ content: "❌ Không đủ tiền!", flags: 64 });

        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { horse, amount });
        await interaction.reply({ content: `✅ Đã cược **${amount.toLocaleString()} VND** vào 🐎 **Ngựa số ${horse}**`, flags: 64 });
    },
};

async function startRace(message) {
    const game = games.get(message.id);
    if (!game) return;
    game.isStarted = true;

    const positions = Array(10).fill(0);
    let finished = false;

    // Hàm render đã được fix lỗi RangeError
    const renderTrack = () => {
        let track = "";
        for (let i = 0; i < 10; i++) {
            const pos = Math.min(positions[i], TRACK_LENGTH); // Luôn giới hạn pos không vượt quá TRACK_LENGTH
            const dots = TRACK_LENGTH - pos;
            const line = "▬".repeat(pos) + "🐎" + "  ".repeat(dots > 0 ? dots : 0); 
            track += `**${i + 1}** |${line}|🏁\n`;
        }
        return track;
    };

    const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("🐎 CUỘC ĐUA ĐANG DIỄN RA!")
        .setDescription(renderTrack());

    await message.edit({ embeds: [embed], components: [] });

    const interval = setInterval(async () => {
        for (let i = 0; i < 10; i++) {
            if (Math.random() > 0.4) {
                positions[i] += Math.floor(Math.random() * 2) + 1;
            }
            if (positions[i] >= TRACK_LENGTH) finished = true;
        }

        await message.edit({ embeds: [embed.setDescription(renderTrack())] }).catch(() => {});

        if (finished) {
            clearInterval(interval);
            const winner = positions.indexOf(Math.max(...positions)) + 1;
            await finishRace(message, winner);
        }
    }, 3500); 
}

async function finishRace(message, winnerHorse) {
    const game = games.get(message.id);
    if (!game) return;

    let summary = `🥇 **Ngựa thắng cuộc:** 🐎 **Ngựa số ${winnerHorse}**\n\n`;
    const promises = Array.from(game.bets.entries()).map(async ([userId, bet]) => {
        const user = await User.findOne({ userId });
        if (!user) return;

        if (bet.horse === winnerHorse) {
            const winAmount = Math.floor(bet.amount * 8); 
            user.money += winAmount;
            summary += `✅ <@${userId}> +${winAmount.toLocaleString()} VND\n`;
        } else {
            summary += `❌ <@${userId}> -${bet.amount.toLocaleString()} VND\n`;
        }
        await user.save();
    });

    await Promise.all(promises);

    const finalEmbed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle("🏁 KẾT QUẢ CUỘC ĐUA")
        .setDescription(summary)
        .setTimestamp();

    await message.edit({ embeds: [finalEmbed] });
    games.delete(message.id);
}