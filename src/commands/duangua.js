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
                "🏆 **Cơ cấu giải:** Hạng 1 (x4) | Hạng 2 (x2) | Hạng 3 (x2)\n" +
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

        // Đã sử dụng withResponse (chuẩn djs v14+)
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
            return interaction.reply({ content: "❌ Cuộc đua đã bắt đầu hoặc đã kết thúc!", flags: 64 });
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

        // Trừ tiền cược luôn
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

    const renderTrack = () => {
        let track = "";
        for (let i = 0; i < 10; i++) {
            const pos = Math.min(positions[i], TRACK_LENGTH); 
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

    // FIX 1: Bắt lỗi ngay lúc bắt đầu cập nhật giao diện đua (tránh sập nếu tin nhắn vừa bị xóa)
    try {
        await message.edit({ embeds: [embed], components: [] });
    } catch (err) {
        games.delete(message.id);
        return; 
    }

    const interval = setInterval(async () => {
        for (let i = 0; i < 10; i++) {
            if (Math.random() > 0.4) {
                positions[i] += Math.floor(Math.random() * 2) + 1;
            }
            if (positions[i] >= TRACK_LENGTH) finished = true;
        }

        // FIX 2: Bắt lỗi trong quá trình đua, nếu lỗi thì dừng cuộc đua ngay lập tức
        try {
            await message.edit({ embeds: [embed.setDescription(renderTrack())] });
        } catch (error) {
            clearInterval(interval);
            games.delete(message.id);
            return; 
        }

        if (finished) {
            clearInterval(interval);
            
            // Xếp hạng: Tạo mảng chứa thông tin ngựa và quãng đường, sau đó sort từ cao xuống thấp
            const rankedHorses = positions
                .map((pos, index) => ({ horse: index + 1, pos }))
                .sort((a, b) => {
                    // Nếu quãng đường bằng nhau, random hên xui để phân hạng
                    if (b.pos === a.pos) return Math.random() > 0.5 ? 1 : -1;
                    return b.pos - a.pos;
                });

            await finishRace(message, rankedHorses);
        }
    }, 3500); 
}

async function finishRace(message, rankedHorses) {
    const game = games.get(message.id);
    if (!game) return;

    // Lấy ra Top 3 ngựa thắng cuộc
    const first = rankedHorses[0].horse;
    const second = rankedHorses[1].horse;
    const third = rankedHorses[2].horse;

    let summary = `🥇 **Hạng Nhất (x4):** 🐎 Số ${first}\n` +
                  `🥈 **Hạng Hai (x2):** 🐎 Số ${second}\n` +
                  `🥉 **Hạng Ba (x2):** 🐎 Số ${third}\n\n` +
                  `📊 **KẾT QUẢ ĐẶT CƯỢC:**\n`;

    let hasBets = false;

    const promises = Array.from(game.bets.entries()).map(async ([userId, bet]) => {
        hasBets = true;
        const user = await User.findOne({ userId });
        if (!user) return;

        // Xử lý trả thưởng theo cơ cấu mới
        if (bet.horse === first) {
            const winAmount = Math.floor(bet.amount * 4); 
            user.money += winAmount;
            summary += `🥇 <@${userId}> thắng **+${winAmount.toLocaleString()} VND** (Ngựa ${bet.horse})\n`;
        } else if (bet.horse === second || bet.horse === third) {
            const winAmount = Math.floor(bet.amount * 2); 
            user.money += winAmount;
            summary += `🥈 <@${userId}> thắng **+${winAmount.toLocaleString()} VND** (Ngựa ${bet.horse})\n`;
        } else {
            // Không cộng lại tiền vì đã trừ lúc đầu
            summary += `❌ <@${userId}> thua trắng **-${bet.amount.toLocaleString()} VND** (Ngựa ${bet.horse})\n`;
        }
        await user.save();
    });

    await Promise.all(promises);

    if (!hasBets) {
        summary += "*Không có ai đặt cược trong vòng này.*";
    }

    const finalEmbed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle("🏁 KẾT QUẢ CUỘC ĐUA")
        .setDescription(summary)
        .setTimestamp();

    // FIX 3: Bắt lỗi khi chốt kết quả
    try {
        await message.edit({ embeds: [finalEmbed] });
    } catch (error) {
        console.error(`Không thể hiện kết quả đua ngựa ở message ID: ${message.id}`);
    } finally {
        games.delete(message.id);
    }
}
