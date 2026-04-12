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
const MIN_BET = 200000;

/* ======================= */
/* 🎯 TỈ LỆ XẬP THEO TẦNG */
/* ======================= */
function getCrashChance(floor) {
    if (floor <= 10) return (1 + ((floor - 1) * (7 / 9))) * 1.4;
    if (floor <= 20) return (7 + ((floor - 11) * (9 / 9))) * 1.7;
    return (16 + ((floor - 21) * (10 / 15))) * 2;
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
    const safeFloor = Math.min(floor, MAX_FLOOR); // Fix bug vượt quá Max
    const totalBars = 18;
    const filled = Math.round((safeFloor / MAX_FLOOR) * totalBars);
    const empty = Math.max(0, totalBars - filled);

    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${safeFloor}/${MAX_FLOOR}`;
}

/* ======================= */
/* ⛏️ RANDOM QUẶNG (CÓ SCALE THEO BET) */
/* ======================= */
function getOreByFloor(floor, bet) {
    let ores;
    if (floor <= 10) {
        ores = [
            { name: "🪨 Đá Thường", min: 5000, max: 7000 },
            { name: "🟤 Đồng", min: 8000, max: 9000 },
            { name: "⚙️ Sắt", min: 10000, max: 13000 },
            { name: "🔩 Bạc Thô", min: 12000, max: 22000 },
            { name: "💠 Thạch Anh", min: 15000, max: 23000 },
        ];
    } else if (floor <= 20) {
        ores = [
            { name: "🥈 Bạc", min: 23000, max: 30000 },
            { name: "🟡 Vàng", min: 35000, max: 40000 },
            { name: "🔷 Sapphire", min: 40000, max: 55000 },
            { name: "💎 Kim Cương Thô", min: 45000, max: 60000 },
            { name: "🔮 Đá Ma Thuật", min: 30000, max: 50000 },
        ];
    } else {
        ores = [
            { name: "💎 Kim Cương", min: 50000, max: 70000 },
            { name: "🟥 Ruby", min: 55000, max: 70000 },
            { name: "🟦 Ngọc Lam", min: 50000, max: 70000 },
            { name: "🟪 Thạch Tím", min: 60000, max: 70000 },
            { name: "👑 Quặng Huyền Thoại", min: 60000, max: 70000 },
        ];
    }

    const ore = ores[Math.floor(Math.random() * ores.length)];
    
    // Scale: Nếu cược > MIN_BET, giá trị quặng sẽ tăng tương ứng
    const scale = bet / MIN_BET; 
    const baseValue = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;
    const multiplier = Math.floor(Math.random() * 4) + 2;

    return {
        name: ore.name,
        value: Math.floor(baseValue * multiplier * scale), // Giá trị đã nhân scale
        multiplier,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daoham")
        .setDescription("⛏️ Đào hầm kiếm quặng - Rủi ro cao, lợi nhuận khủng")
        .addIntegerOption(option =>
            option
                .setName("tien")
                .setDescription("Số tiền cược (tối thiểu 200.000)")
                .setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tien");

        if (bet < MIN_BET)
            return interaction.reply({ content: `❌ Tiền vé xuống hầm tối thiểu là **${MIN_BET.toLocaleString()} VND**!`, flags: 64 });

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (user.banned)
            return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia các hoạt động do nợ xấu!", flags: 64 });

        if (user.money < bet)
            return interaction.reply({ content: "❌ Bạn không đủ tiền mua vé xuống hầm!", flags: 64 });

        // Trừ tiền vé
        user.money -= bet;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("⛏️ BẮT ĐẦU KHAI THÁC")
            .setDescription(
                `💰 Tiền vé: **${bet.toLocaleString("vi-VN")} VND**\n\n` +
                `📍 Tầng hiện tại: **0**\n` +
                `📈 ${getProgressBar(0)}\n\n` +
                `⚠️ *Lưu ý: Hầm có thể sập bất cứ lúc nào, hãy Rút Tiền đúng lúc!*`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("daoham_continue").setLabel("⛏️ ĐÀO XUỐNG").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("daoham_cashout").setLabel("💰 RÚT LUI").setStyle(ButtonStyle.Primary).setDisabled(true)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Tạo Timeout xóa game nếu người chơi afk
        const timeout = setTimeout(() => {
            games.delete(msg.id);
            interaction.editReply({ content: "⏳ Bạn đã AFK quá lâu, hầm mỏ đã tự động đóng lại (Mất vé).", components: [] }).catch(()=>{});
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
            return interaction.reply({ content: "❌ Nút này không dành cho bạn hoặc phiên đã hết hạn!", flags: 64 });
        }

        if (game.isProcessing) return interaction.deferUpdate(); // Khóa chống spam click
        game.isProcessing = true;

        await interaction.deferUpdate(); // Phản hồi ngay để tránh Discord báo lỗi
        clearTimeout(game.timeoutId); // Xóa timeout cũ

        let user = await User.findOne({ userId: interaction.user.id });

        if (interaction.customId === "daoham_continue") {
            game.floor++;

            // 1. CHUẨN BỊ NÚT
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("daoham_continue").setLabel("⛏️ ĐÀO TIẾP").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("daoham_cashout").setLabel("💰 RÚT TIỀN").setStyle(ButtonStyle.Primary)
            );

            // 2. CHECK XẬP HẦM
            const crashChance = getCrashChance(game.floor);
            if (Math.random() * 100 < crashChance) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 XẬP HẦM!!!")
                    .setDescription(
                        `💀 Bạn bị chôn vùi tại tầng: **${game.floor}**\n` +
                        `💥 Tỉ lệ xập lúc chết: **${crashChance.toFixed(1)}%**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `💀 **MẤT TRẮNG VÉ: ${game.bet.toLocaleString("vi-VN")} VND**\n` +
                        `🗑️ **ĐÁNH MẤT QUẶNG: ${game.totalReward.toLocaleString("vi-VN")} VND**`
                    )
                    .setThumbnail("https://preview.redd.it/why-even-bother-v0-95755o0poi3e1.jpeg?width=1080&crop=smart&auto=webp&s=73d44d84bf8e1566d0d8bb619da7baff34f4cee3");

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            // 3. CHECK PHÁ ĐẢO (MAX FLOOR)
            if (game.floor >= MAX_FLOOR) {
                const jackpot = game.totalReward * 2; // Thưởng x2 khi phá đảo
                user.money += jackpot;
                await user.save();

                const embed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle("👑 PHÁ ĐẢO HẦM MỎ!")
                    .setDescription(
                        `🎉 Chúc mừng bạn đã chạm đến Tầng Lõi **(${MAX_FLOOR}/${MAX_FLOOR})**!\n\n` +
                        `🎁 **THƯỞNG X2 JACKPOT PHÁ ĐẢO**\n` +
                        `💰 Tự động rút lui: **${jackpot.toLocaleString("vi-VN")} VND**`
                    );

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            // 4. CHECK TẦNG RỖNG
            const emptyChance = getEmptyChance(game.floor);
            if (Math.random() * 100 < emptyChance) {
                const embed = new EmbedBuilder()
                    .setColor(getColorByFloor(game.floor))
                    .setTitle("⛏️ TẦNG RỖNG")
                    .setDescription(
                        `📍 Tầng: **${game.floor}**\n` +
                        `💥 Nguy hiểm: **${crashChance.toFixed(1)}%** | 🕳️ Rỗng: **${emptyChance}%**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `💨 *Bạn đào mãi nhưng chỉ toàn đất đá...*\n` +
                        `📦 Túi đồ: **${game.totalReward.toLocaleString("vi-VN")} VND**`
                    );

                // Reset timeout và mở khóa cờ
                game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
                game.isProcessing = false;
                return interaction.editReply({ embeds: [embed], components: [row] });
            }

            // 5. ĐÀO ĐƯỢC QUẶNG
            const ore = getOreByFloor(game.floor, game.bet); // Đã truyền bet vào để scale tiền
            game.totalReward += ore.value;

            const embed = new EmbedBuilder()
                .setColor(getColorByFloor(game.floor))
                .setTitle("💎 ĐÀO THÀNH CÔNG!")
                .setDescription(
                    `📍 Tầng: **${game.floor}**\n` +
                    `💥 Nguy hiểm: **${crashChance.toFixed(1)}%**\n` +
                    `📈 ${getProgressBar(game.floor)}\n\n` +
                    `⛏️ Quặng: **${ore.name}**\n` +
                    `✨ Độ tinh khiết: **x${ore.multiplier}**\n` +
                    `💵 Trị giá: **+${ore.value.toLocaleString("vi-VN")} VND**\n\n` +
                    `📦 TỔNG TÚI ĐỒ: **${game.totalReward.toLocaleString("vi-VN")} VND**`
                );

            game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
            game.isProcessing = false;
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // 6. NÚT RÚT TIỀN (CASH OUT)
        if (interaction.customId === "daoham_cashout") {
            user.money += game.totalReward;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor(0x00ffcc)
                .setTitle("🏃‍♂️ RÚT LUI AN TOÀN!")
                .setDescription(
                    `📍 Bạn đã quyết định dừng lại tại tầng: **${game.floor}**\n` +
                    `📈 ${getProgressBar(game.floor)}\n\n` +
                    `💵 **Lãi thu về:** **${game.totalReward.toLocaleString("vi-VN")} VND**\n` +
                    `*(Vé ban đầu: ${game.bet.toLocaleString()} VND)*`
                );

            games.delete(interaction.message.id);
            return interaction.editReply({ embeds: [embed], components: [] });
        }
    },
};