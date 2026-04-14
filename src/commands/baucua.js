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

const EMOJIS = {
    nai: "🦌",
    bau: "🎃",
    ga: "🐔",
    ca: "🐟",
    cua: "🦀",
    tom: "🦐",
};

const FACES = Object.keys(EMOJIS);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baucua")
        .setDescription("🎲 Tạo sòng Bầu Cua - Tỉ lệ 50/50 hên xui!"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });

        if (user?.banned) {
            return interaction.reply({
                content: "⛔ Bạn đã bị cấm vĩnh viễn khỏi hệ thống cược do nợ nần ngập đầu!",
                flags: 64,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xff8800)
            .setTitle("🎲 SÒNG BẦU CUA ĐANG MỞ")
            .setDescription(
                "👉 Chọn **Nai, Bầu, Gà, Cá, Cua hoặc Tôm** để xuống tiền!\n" +
                "⏳ Nhà cái sẽ xóc lọ sau **30 giây**..."
            )
            .setFooter({ text: "Nhà cái uy tín 50/50 💎" })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("baucua_nai").setLabel("🦌 Nai").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("baucua_bau").setLabel("🎃 Bầu").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("baucua_ga").setLabel("🐔 Gà").setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("baucua_ca").setLabel("🐟 Cá").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("baucua_cua").setLabel("🦀 Cua").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("baucua_tom").setLabel("🦐 Tôm").setStyle(ButtonStyle.Success)
        );

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            fetchReply: true,
        });

        games.set(msg.id, {
            bets: new Map(), // userId -> { face, amount }
            endsAt: Date.now() + 30000,
        });

        // ⏳ Kết thúc sau 30s
        setTimeout(async () => {
            const game = games.get(msg.id);
            if (!game) return;

            let rolls = [];
            const betFaces = Array.from(new Set(Array.from(game.bets.values()).map(b => b.face)));

            // 🎲 LOGIC CHÍNH XÁC 50/50
            if (betFaces.length === 0 || betFaces.length === FACES.length) {
                // Nếu không ai cược hoặc cược hết cả 6 mặt thì random tự nhiên 100%
                rolls = Array.from({ length: 3 }, () => FACES[Math.floor(Math.random() * FACES.length)]);
            } else {
                const isWin = Math.random() < 0.50; // Tỉ lệ 50% thắng hoặc thua
                
                if (isWin) {
                    // 50% THẮNG: Chọn 1 mặt người chơi đã cược để chắc chắn trúng, 2 mặt còn lại random
                    const winningFace = betFaces[Math.floor(Math.random() * betFaces.length)];
                    rolls.push(winningFace); 
                    rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
                    rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
                    rolls.sort(() => Math.random() - 0.5); // Trộn ngẫu nhiên vị trí xúc xắc
                } else {
                    // 50% THUA: Chỉ roll ra các mặt người chơi KHÔNG đặt cược
                    const loseFaces = FACES.filter(f => !betFaces.includes(f));
                    rolls = Array.from({ length: 3 }, () => loseFaces[Math.floor(Math.random() * loseFaces.length)]);
                }
            }

            const counts = {};
            for (const r of rolls) counts[r] = (counts[r] || 0) + 1;

            let winners = [];
            let losers = [];

            // Xử lý kết quả trả thưởng
            // Tìm đoạn: for (const [userId, bet] of game.bets.entries()) { ... }

for (const [userId, bet] of game.bets.entries()) {
    const uData = await User.findOne({ userId });
    if (!uData) continue;

    let usedBuffs = []; // Để lưu thông báo bùa đã dùng

    if (bet.choice === result) {
        // --- XỬ LÝ LUCK ---
        if (uData.buffs.winRateBoost > 0) {
            usedBuffs.push(`🍀 Bùa Luck (${uData.buffs.winRateBoost * 100}%)`);
            uData.buffs.winRateBoost = 0; // Xóa bùa
        }

        const winAmt = bet.amount * 2;
        uData.money += winAmt;
        uData.stats.win++;
        winners.push(`<@${userId}> (+\`${bet.amount.toLocaleString()}\`)${usedBuffs.length ? " [" + usedBuffs.join(", ") + "]" : ""}`);
    } else {
        // --- XỬ LÝ SHIELD ---
        let lossAmount = bet.amount;
        if (uData.buffs.shield > 0) {
            const reducedLoss = bet.amount * (1 - uData.buffs.shield);
            const savedAmount = bet.amount - reducedLoss;
            uData.money += Math.floor(savedAmount); // Trả lại phần tiền được khiên bảo vệ
            lossAmount = Math.floor(reducedLoss);
            usedBuffs.push(`🔰 Khiên (${uData.buffs.shield * 100}%)`);
            uData.buffs.shield = 0; // Xóa khiên
        }

        // Nếu có bùa luck mà thua thì vẫn mất bùa
        if (uData.buffs.winRateBoost > 0) {
            usedBuffs.push(`🍀 Bùa Luck (${uData.buffs.winRateBoost * 100}%)`);
            uData.buffs.winRateBoost = 0;
        }

        uData.stats.lose++;
        losers.push(`<@${userId}> (-\`${lossAmount.toLocaleString()}\`)${usedBuffs.length ? " [" + usedBuffs.join(", ") + "]" : ""}`);
    }
    uData.stats.gamblePlayed++;
    await uData.save();
}

            const resultEmbed = new EmbedBuilder()
                .setColor(0x00ff99)
                .setTitle("🎉 KẾT QUẢ BẦU CUA")
                .setDescription(
                    `🎲 Xúc xắc: **${rolls.map(r => EMOJIS[r]).join(" - ")}**\n\n` +
                    `🏆 **Người thắng:**\n${winners.slice(0, 10).join("\n") || "Không ai ăn được nhà cái 😢"}\n\n` +
                    `💀 **Người thua:**\n${losers.slice(0, 10).join("\n") || "Không ai 😎"}`
                )
                .setFooter({ text: "BOT Casino 50/50 💎" })
                .setTimestamp();

            await msg.edit({
                embeds: [resultEmbed],
                components: [],
            });

            games.delete(msg.id);
        }, 30000);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) {
            return interaction.reply({ content: "❌ Bàn này đã đóng, chờ ván sau nhé!", flags: 64 });
        }

        if (game.bets.has(interaction.user.id)) {
            return interaction.reply({ content: "❌ Bạn đã phóng lao thì phải theo lao, không được cược 2 mặt!", flags: 64 });
        }

        const face = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setCustomId(`baucua_modal_${face}`)
            .setTitle(`💰 Đặt cược vào ${EMOJIS[face]} ${face.toUpperCase()}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền bạn muốn đặt (VND)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Tối thiểu 1000");

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const face = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));

        if (isNaN(amount) || amount < 1000) {
            return interaction.reply({ content: "❌ Tiền cược không hợp lệ (Tối thiểu 1,000 VND)!", flags: 64 });
        }

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (user.banned) {
            return interaction.reply({ content: "🚫 Bạn đang bị cấm cược!", flags: 64 });
        }

        if (user.money < amount) {
            return interaction.reply({ content: "❌ Không đủ tiền cược!", flags: 64 });
        }

        const game = games.get(interaction.message.id);
        if (!game) {
            return interaction.reply({ content: "❌ Bàn đã kết thúc trong lúc bạn mải gõ phím!", flags: 64 });
        }

        // TRỪ TIỀN NGAY TỨC KHẮC
        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { face, amount });

        await interaction.reply({
            content: `✅ Bạn đã xuống xác **${amount.toLocaleString("vi-VN")} VND** vào **${EMOJIS[face]} ${face.toUpperCase()}**!`,
            flags: 64,
        });
    },
};