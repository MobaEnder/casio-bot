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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("taixiu")
        .setDescription("🎲 Mở sòng Tài Xỉu - Nơi đại gia hóa ăn mày"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user?.banned) {
            return interaction.reply({ content: "⛔ Bạn đang bị phong tỏa tài sản, không được phép cờ bạc!", flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00bfff)
            .setTitle("🎲 SÒNG TÀI XỈU ĐANG MỞ")
            .setDescription(
                "🔥 **TÀI**: 11 - 17 | ❄️ **XỈU**: 4 - 10\n" +
                "⏳ Thời gian đặt cược: **20 giây**\n\n" +
                "👉 Hãy nhấn vào nút bên dưới để vào tiền!"
            )
            .setFooter({ text: "Cờ bạc là bác thằng bần, nhưng không cờ bạc thì không có tiền trả nợ." })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("taixiu_tai").setLabel("TÀI 🔥").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("taixiu_xiu").setLabel("XỈU ❄️").setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        games.set(response.id, {
            bets: new Map(),
            endsAt: Date.now() + 20000,
            message: response
        });

        setTimeout(async () => {
            const game = games.get(response.id);
            if (!game) return;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const d3 = Math.floor(Math.random() * 6) + 1;
            const sum = d1 + d2 + d3;
            const result = sum >= 11 ? "tai" : "xiu";
            const resultEmote = result === "tai" ? "🔥 TÀI" : "❄️ XỈU";

            let winners = [];
            let losers = [];

            // Xử lý tiền cược sau khi có kết quả
            for (const [userId, bet] of game.bets.entries()) {
                const uData = await User.findOne({ userId });
                if (!uData) continue;

                if (bet.choice === result) {
                    const winAmt = bet.amount * 2; // Hoàn tiền + thưởng 100%
                    uData.money += winAmt;
                    uData.stats.win++;
                    winners.push(`<@${userId}> (+\`${bet.amount.toLocaleString()}\`)`);
                } else {
                    uData.stats.lose++;
                    losers.push(`<@${userId}> (-\`${bet.amount.toLocaleString()}\`)`);
                }
                uData.stats.gamblePlayed++;
                await uData.save();
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(result === "tai" ? "Green" : "Blue")
                .setTitle("🎉 KẾT QUẢ: " + resultEmote)
                .setThumbnail("https://kenh14cdn.com/thumb_w/600/70e2b6983a/2015/10/24/151024dice02-0504a.jpg") // Có thể thêm ảnh xúc xắc
                .setDescription(
                    `🎲 Bộ ba: **${d1} - ${d2} - ${d3}** (Tổng: **${sum}**)\n\n` +
                    `🏆 **Thắng:** ${winners.slice(0, 10).join(", ") || "Trắng tay"}${winners.length > 10 ? "..." : ""}\n` +
                    `💀 **Thua:** ${losers.slice(0, 10).join(", ") || "Không ai"}${losers.length > 10 ? "..." : ""}`
                )
                .setFooter({ text: "Thắng làm vua, thua đi /work tiếp" })
                .setTimestamp();

            await response.edit({ embeds: [resultEmbed], components: [] });
            games.delete(response.id);
        }, 20000);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Bàn này đã đóng cửa!", flags: 64 });

        // Kiểm tra xem đã cược chưa
        if (game.bets.has(interaction.user.id)) {
            return interaction.reply({ content: "❌ Bạn đã đặt cược rồi, không được đổi ý!", flags: 64 });
        }

        const choice = interaction.customId === "taixiu_tai" ? "tai" : "xiu";
        const modal = new ModalBuilder().setCustomId(`taixiu_modal_${choice}`).setTitle(`Đặt cược vào ${choice.toUpperCase()}`);
        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn tất tay:")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Nhập số tiền...")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const choice = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
        const game = games.get(interaction.message.id);

        if (!game) return interaction.reply({ content: "❌ Bàn đã kết thúc trong lúc bạn đang nhập tiền!", flags: 64 });
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tiền cược tối thiểu là 1,000 VND!", flags: 64 });

        const user = await User.findOne({ userId: interaction.user.id });
        if (user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền, đừng có 'tay không bắt giặc'!", flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        // --- BƯỚC QUAN TRỌNG: TRỪ TIỀN NGAY KHI CƯỢC ---
        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { choice, amount });

        await interaction.reply({ 
            content: `✅ Đã nhận **${amount.toLocaleString()} VND** cược vào **${choice.toUpperCase()}**. Chúc bạn may mắn!`, 
            flags: 64 
        });
    }
};