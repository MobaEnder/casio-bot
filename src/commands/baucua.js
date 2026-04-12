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
        .setDescription("🎲 Tạo sòng Bầu Cua bịp - Chơi là cháy túi!"),

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
            .setFooter({ text: "Nhà cái đến từ Macau 💎" })
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
            fetchReply: true, // Fix lỗi withResponse ở phiên bản djs mới
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

            // 🎲 LOGIC NHÀ CÁI (TỈ LỆ 40% THẮNG - 60% THUA)
            if (betFaces.length === 0 || betFaces.length === FACES.length) {
                rolls = Array.from({ length: 3 }, () => FACES[Math.floor(Math.random() * FACES.length)]);
            } else {
                const isWin = Math.random() < 0.40; // 40% Thắng
                if (isWin) {
                    const winningFace = betFaces[Math.floor(Math.random() * betFaces.length)];
                    rolls.push(winningFace); 
                    rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
                    rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
                    rolls.sort(() => Math.random() - 0.5); // Trộn xúc xắc
                } else {
                    // Cố tình ra mặt KHÔNG AI CƯỢC
                    const loseFaces = FACES.filter(f => !betFaces.includes(f));
                    rolls = Array.from({ length: 3 }, () => loseFaces[Math.floor(Math.random() * loseFaces.length)]);
                }
            }

            const counts = {};
            for (const r of rolls) counts[r] = (counts[r] || 0) + 1;

            let winners = [];
            let losers = [];

            // Xử lý kết quả trả thưởng
            for (const [userId, bet] of game.bets.entries()) {
                let uData = await User.findOne({ userId });
                if (!uData) continue;

                const hit = counts[bet.face] || 0;

                if (hit > 0) {
                    // Đã trừ tiền lúc cược. Thắng thì trả lại: Gốc + (Gốc * số mặt trúng)
                    const winAmount = bet.amount * (hit + 1); 
                    const pureProfit = bet.amount * hit; // Tiền lãi thật sự để hiển thị

                    uData.money += winAmount;
                    uData.stats.win++;
                    winners.push(`✅ <@${userId}> (+\`${pureProfit.toLocaleString()}\`) [${EMOJIS[bet.face]} x${hit}]`);
                } else {
                    // Không cần trừ tiền nữa vì đã trừ ở Modal
                    uData.stats.lose++;
                    losers.push(`❌ <@${userId}> (-\`${bet.amount.toLocaleString()}\`) [${EMOJIS[bet.face]}]`);
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
                .setFooter({ text: "BOT Casino 💎" })
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
            .setLabel("Số tiền bạn muốn tất tay (VND)")
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
            return interaction.reply({ content: "❌ Không đủ tiền cược! Tính lừa nhà cái à?", flags: 64 });
        }

        const game = games.get(interaction.message.id);
        if (!game) {
            return interaction.reply({ content: "❌ Bàn đã kết thúc trong lúc bạn mải gõ phím!", flags: 64 });
        }

        // --- BƯỚC QUAN TRỌNG: TRỪ TIỀN NGAY TỨC KHẮC ---
        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { face, amount });

        await interaction.reply({
            content: `✅ Bạn đã xuống xác **${amount.toLocaleString("vi-VN")} VND** vào **${EMOJIS[face]} ${face.toUpperCase()}**!`,
            flags: 64,
        });
    },
};