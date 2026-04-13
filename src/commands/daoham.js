const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();
const MAX_FLOOR = 36;
const MIN_BET = 200000; // Vé cố định 200k

/* ======================= */
/* 🎯 TỈ LỆ XẬP THEO TẦNG (ĐÃ GIẢM ĐỂ AN TOÀN HƠN) */
/* ======================= */
function getCrashChance(floor) {
    // Hệ số đã được hạ xuống (0.8, 1.1, 1.4) giúp người chơi dễ đi xa hơn
    if (floor <= 10) return (1 + ((floor - 1) * (4 / 9))) * 0.8;
    if (floor <= 20) return (7 + ((floor - 11) * (5 / 9))) * 1.1;
    return (16 + ((floor - 21) * (9 / 15))) * 1.4;
}

/* ======================= */
/* 🎲 TỈ LỆ TẦNG RỖNG */
/* ======================= */
function getEmptyChance(floor) {
    if (floor <= 10) return 25;
    if (floor <= 20) return 20;
    return 15;
}

/* ======================= */
/* 🎨 MÀU THEO ĐỘ NGUY HIỂM */
/* ======================= */
function getColorByFloor(floor) {
    if (floor <= 10) return 0x00ff00; // Xanh
    if (floor <= 20) return 0xffcc00; // Vàng
    if (floor <= 30) return 0xff8800; // Cam
    return 0xff0000; // Đỏ
}

/* ======================= */
/* 📈 THANH TIẾN ĐỘ */
/* ======================= */
function getProgressBar(floor) {
    const safeFloor = Math.min(floor, MAX_FLOOR);
    const totalBars = 18;
    const filled = Math.round((safeFloor / MAX_FLOOR) * totalBars);
    const empty = Math.max(0, totalBars - filled);

    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${safeFloor}/${MAX_FLOOR}`;
}

/* ======================= */
/* ⛏️ RANDOM QUẶNG (ĐÃ GIẢM GIÁ TRỊ) */
/* ======================= */
function getOreByFloor(floor, bet) {
    let ores;
    if (floor <= 10) {
        ores = [
            { name: "🪨 Đá Thường", min: 1500, max: 3000 },
            { name: "🟤 Đồng", min: 3000, max: 5000 },
            { name: "⚙️ Sắt", min: 5000, max: 7000 },
            { name: "🔩 Bạc Thô", min: 7000, max: 9000 },
            { name: "💠 Thạch Anh", min: 9000, max: 12000 },
        ];
    } else if (floor <= 20) {
        ores = [
            { name: "🥈 Bạc", min: 10000, max: 15000 },
            { name: "🟡 Vàng", min: 15000, max: 20000 },
            { name: "🔷 Sapphire", min: 18000, max: 23000 },
            { name: "💎 Kim Cương Thô", min: 20000, max: 25000 },
            { name: "🔮 Đá Ma Thuật", min: 25000, max: 30000 },
        ];
    } else {
        ores = [
            { name: "💎 Kim Cương", min: 30000, max: 40000 },
            { name: "🟥 Ruby", min: 35000, max: 45000 },
            { name: "🟦 Ngọc Lam", min: 35000, max: 45000 },
            { name: "🟪 Thạch Tím", min: 40000, max: 50000 },
            { name: "👑 Quặng Huyền Thoại", min: 45000, max: 55000 },
        ];
    }

    const ore = ores[Math.floor(Math.random() * ores.length)];
    const scale = bet / MIN_BET; 
    const baseValue = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;
    
    // Multiplier thấp hơn (x1.2 đến x2.5) để tiền không tăng quá nhanh
    const multiplier = parseFloat((Math.random() * 1.3 + 1.2).toFixed(1));

    return {
        name: ore.name,
        value: Math.floor(baseValue * multiplier * scale),
        multiplier,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daoham")
        .setDescription("⛏️ Đào hầm kiếm quặng - Phí vào hầm cố định 200.000 VND"),

    async execute(interaction) {
        const bet = MIN_BET;

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (user.banned)
            return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia do nợ xấu!", flags: 64 });

        if (user.money < bet)
            return interaction.reply({ content: `❌ Bạn không đủ **${bet.toLocaleString()} VND** tiền mua vé!`, flags: 64 });

        user.money -= bet;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("⛏️ BẮT ĐẦU KHAI THÁC")
            .setDescription(
                `💰 Tiền vé: **${bet.toLocaleString("vi-VN")} VND**\n\n` +
                `📍 Tầng hiện tại: **0**\n` +
                `📈 ${getProgressBar(0)}\n\n` +
                `⚠️ *Hầm mỏ đã được gia cố, an toàn hơn nhưng quặng sẽ hiếm hơn!*`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("daoham_continue").setLabel("⛏️ ĐÀO XUỐNG").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("daoham_cashout").setLabel("💰 RÚT LUI").setStyle(ButtonStyle.Primary).setDisabled(true)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const timeout = setTimeout(() => {
            games.delete(msg.id);
            interaction.editReply({ content: "⏳ Bạn đã AFK quá lâu, hầm mỏ đã đóng lại.", components: [] }).catch(()=>{});
        }, 60000);

        games.set(msg.id, {
            userId: interaction.user.id,
            bet,
            floor: 0,
            totalReward: 0,
            isProcessing: false,
            timeoutId: timeout
        });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || interaction.user.id !== game.userId) {
            return interaction.reply({ content: "❌ Phiên này không thuộc về bạn!", flags: 64 });
        }

        if (game.isProcessing) return interaction.deferUpdate();
        game.isProcessing = true;

        await interaction.deferUpdate();
        clearTimeout(game.timeoutId);

        let user = await User.findOne({ userId: interaction.user.id });

        if (interaction.customId === "daoham_continue") {
            game.floor++;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("daoham_continue").setLabel("⛏️ ĐÀO TIẾP").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("daoham_cashout").setLabel("💰 RÚT TIỀN").setStyle(ButtonStyle.Primary)
            );

            const crashChance = getCrashChance(game.floor);
            if (Math.random() * 100 < crashChance) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 XẬP HẦM!!!")
                    .setDescription(
                        `💀 Bạn bị chôn vùi tại tầng: **${game.floor}**\n` +
                        `💥 Tỉ lệ xập: **${crashChance.toFixed(1)}%**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `💀 **MẤT TRẮNG VÉ: ${game.bet.toLocaleString("vi-VN")} VND**\n` +
                        `🗑️ **MẤT QUẶNG: ${game.totalReward.toLocaleString("vi-VN")} VND**`
                    )
                    .setThumbnail("https://preview.redd.it/why-even-bother-v0-95755o0poi3e1.jpeg?width=1080&crop=smart&auto=webp&s=73d44d84bf8e1566d0d8bb619da7baff34f4cee3");

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            if (game.floor >= MAX_FLOOR) {
                const jackpot = game.totalReward * 2;
                user.money += jackpot;
                await user.save();

                const embed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle("👑 PHÁ ĐẢO HẦM MỎ!")
                    .setDescription(
                        `🎉 Chúc mừng bạn đã chạm đến Tầng Lõi **(${MAX_FLOOR}/${MAX_FLOOR})**!\n\n` +
                        `🎁 **JACKPOT PHÁ ĐẢO x2**\n` +
                        `💰 Tổng nhận: **${jackpot.toLocaleString("vi-VN")} VND**`
                    );

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            const emptyChance = getEmptyChance(game.floor);
            if (Math.random() * 100 < emptyChance) {
                const embed = new EmbedBuilder()
                    .setColor(getColorByFloor(game.floor))
                    .setTitle("⛏️ TẦNG RỖNG")
                    .setDescription(
                        `📍 Tầng: **${game.floor}**\n` +
                        `💥 Nguy hiểm: **${crashChance.toFixed(1)}%**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `💨 *Tầng này không có quặng, hãy đào sâu hơn!*\n` +
                        `📦 Túi đồ: **${game.totalReward.toLocaleString("vi-VN")} VND**`
                    );

                game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
                game.isProcessing = false;
                return interaction.editReply({ embeds: [embed], components: [row] });
            }

            const ore = getOreByFloor(game.floor, game.bet);
            game.totalReward += ore.value;

            const embed = new EmbedBuilder()
                .setColor(getColorByFloor(game.floor))
                .setTitle("💎 ĐÀO THÀNH CÔNG!")
                .setDescription(
                    `📍 Tầng: **${game.floor}**\n` +
                    `💥 Nguy hiểm: **${crashChance.toFixed(1)}%**\n` +
                    `📈 ${getProgressBar(game.floor)}\n\n` +
                    `⛏️ Quặng: **${ore.name}** | ✨ Tinh khiết: **x${ore.multiplier}**\n` +
                    `💵 Giá trị: **+${ore.value.toLocaleString("vi-VN")} VND**\n\n` +
                    `📦 TỔNG TÚI ĐỒ: **${game.totalReward.toLocaleString("vi-VN")} VND**`
                );

            game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
            game.isProcessing = false;
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (interaction.customId === "daoham_cashout") {
            user.money += game.totalReward;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor(0x00ffcc)
                .setTitle("🏃‍♂️ RÚT LUI AN TOÀN!")
                .setDescription(
                    `📍 Dừng lại tại tầng: **${game.floor}**\n\n` +
                    `💵 **Tiền thu về:** **${game.totalReward.toLocaleString("vi-VN")} VND**\n` +
                    `*(Lợi nhuận ròng: ${(game.totalReward - game.bet).toLocaleString()} VND)*`
                );

            games.delete(interaction.message.id);
            return interaction.editReply({ embeds: [embed], components: [] });
        }
    },
};