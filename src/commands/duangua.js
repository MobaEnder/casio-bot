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
const TRACK_LENGTH = 15; // Rút ngắn một chút để đua nhanh & mượt hơn

module.exports = {
    data: new SlashCommandBuilder()
        .setName("duangua")
        .setDescription("🐎 Đua ngựa - Chọn ngựa từ 1 tới 10 và đặt cược!"),

    async execute(interaction) {
        // Kiểm tra user có bị ban không
        const user = await User.findOne({ userId: interaction.user.id });
        if (user && user.banned) {
            return interaction.reply({
                content: "⛔ Bạn đã bị cấm tham gia các hoạt động cá cược!",
                flags: 64,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setTitle("🐎 TRƯỜNG ĐUA NGỰA CHUYÊN NGHIỆP")
            .setDescription(
                "🎯 Chọn **ngựa số 1 → 10** để đặt cược!\n" +
                "⏳ Cuộc đua sẽ bắt đầu sau **40 giây**...\n\n" +
                "🐎 **Danh sách ngựa chiến:**\n" +
                "1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣\n" +
                "6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟"
            )
            .setFooter({ text: "Nhấn vào nút số ngựa để đặt cược" })
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

        const msg = await interaction.reply({
            embeds: [embed],
            components: rows,
            fetchReply: true,
        });

        games.set(msg.id, {
            bets: new Map(), // userId -> { horse, amount }
            endsAt: Date.now() + 40000,
            isStarted: false
        });

        // Bắt đầu đua sau 40s
        setTimeout(() => startRace(msg), 40000);
    },

    // ================= XỬ LÝ NÚT BẤM =================
    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Cuộc đua đã bắt đầu hoặc không tồn tại!", flags: 64 });
        }

        const horse = Number(interaction.customId.split("_")[1]);

        const modal = new ModalBuilder()
            .setCustomId(`duangua_modal_${horse}`)
            .setTitle(`🐎 Đặt cược ngựa số ${horse}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn cược (VND)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ví dụ: 100000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    // ================= XỬ LÝ MODAL =================
    async handleModal(interaction) {
        const horse = Number(interaction.customId.split("_")[2]);
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted) {
            return interaction.reply({ content: "❌ Đã hết thời gian đặt cược!", flags: 64 });
        }

        if (isNaN(amount) || amount < 1000) {
            return interaction.reply({ content: "❌ Số tiền cược tối thiểu là 1.000 VND!", flags: 64 });
        }

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) {
            return interaction.reply({ content: "❌ Bạn không đủ tiền trong ví!", flags: 64 });
        }

        // 🔥 TRỪ TIỀN NGAY ĐỂ CHỐNG BUG TIỀN ẢO
        user.money -= amount;
        await user.save();

        // Ghi nhận đặt cược (nếu đặt đè thì tính con ngựa mới nhất)
        game.bets.set(interaction.user.id, { horse, amount });

        await interaction.reply({
            content: `✅ Bạn đã đặt **${amount.toLocaleString()} VND** vào 🐎 **Ngựa số ${horse}**. Chúc may mắn!`,
            flags: 64,
        });
    },
};

// ================= HÀM ĐIỀU KHIỂN ĐUA =================
async function startRace(message) {
    const game = games.get(message.id);
    if (!game) return;
    game.isStarted = true;

    const positions = Array(10).fill(0);
    let finished = false;

    const renderTrack = () => {
        let track = "";
        for (let i = 0; i < 10; i++) {
            const pos = positions[i];
            const line = "▬".repeat(pos) + "🐎" + "  ".repeat(TRACK_LENGTH - pos);
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
        // Ngẫu nhiên tốc độ từng con ngựa
        for (let i = 0; i < 10; i++) {
            if (Math.random() > 0.4) {
                positions[i] += Math.floor(Math.random() * 2) + 1;
            }
            if (positions[i] >= TRACK_LENGTH) finished = true;
        }

        await message.edit({ embeds: [embed.setDescription(renderTrack())] }).catch(() => {});

        if (finished) {
            clearInterval(interval);
            // Tìm con ngựa thắng (vị trí xa nhất)
            const winner = positions.indexOf(Math.max(...positions)) + 1;
            await finishRace(message, winner);
        }
    }, 3500); // 3.5s cập nhật một lần để tránh Rate Limit Discord
}

async function finishRace(message, winnerHorse) {
    const game = games.get(message.id);
    if (!game) return;

    let summary = `🥇 **Ngựa thắng cuộc:** 🐎 **Ngựa số ${winnerHorse}**\n\n`;
    let winCount = 0;

    const promises = Array.from(game.bets.entries()).map(async ([userId, bet]) => {
        const user = await User.findOne({ userId });
        if (!user) return;

        if (bet.horse === winnerHorse) {
            const winAmount = Math.floor(bet.amount * 8); // Tỷ lệ x8 (Bot ăn phế 20%)
            user.money += winAmount;
            summary += `✅ <@${userId}> thắng **+${winAmount.toLocaleString()}** VND\n`;
            winCount++;
        } else {
            summary += `❌ <@${userId}> mất **-${bet.amount.toLocaleString()}** VND\n`;
        }
        await user.save();
    });

    await Promise.all(promises);

    const finalEmbed = new EmbedBuilder()
        .setColor(winCount > 0 ? "Gold" : "Red")
        .setTitle("🏁 KẾT QUẢ CUỘC ĐUA")
        .setDescription(summary + (winCount === 0 ? "\n*Không có ai trúng thưởng kỳ này!*" : ""))
        .setTimestamp();

    await message.edit({ embeds: [finalEmbed] });
    games.delete(message.id);
}