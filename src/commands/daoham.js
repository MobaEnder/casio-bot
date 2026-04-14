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

function getCrashChance(floor) {
    if (floor <= 10) return (1 + ((floor - 1) * (4 / 9))) * 0.9;
    if (floor <= 20) return (7 + ((floor - 11) * (5 / 9))) * 1.2;
    return (16 + ((floor - 21) * (9 / 15))) * 1.4;
}

function getEmptyChance(floor) {
    if (floor <= 10) return 25;
    if (floor <= 20) return 20;
    return 15;
}

function getColorByFloor(floor) {
    if (floor <= 10) return 0x00ff00; 
    if (floor <= 20) return 0xffcc00; 
    if (floor <= 30) return 0xff8800; 
    return 0xff0000; 
}

function getProgressBar(floor) {
    const safeFloor = Math.min(floor, MAX_FLOOR);
    const totalBars = 18;
    const filled = Math.round((safeFloor / MAX_FLOOR) * totalBars);
    const empty = Math.max(0, totalBars - filled);
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${safeFloor}/${MAX_FLOOR}`;
}

function getOreByFloor(floor, bet) {
    let ores;
    if (floor <= 10) {
        ores = [
            { name: "🪨 Đá Thường", min: 5000, max: 8000 },
            { name: "🟤 Đồng", min: 8000, max: 12000 },
            { name: "⚙️ Sắt", min: 12000, max: 18000 },
            { name: "🔩 Bạc Thô", min: 18000, max: 25000 },
            { name: "💠 Thạch Anh", min: 25000, max: 35000 },
        ];
    } else if (floor <= 20) {
        ores = [
            { name: "🥈 Bạc", min: 35000, max: 40000 },
            { name: "🟡 Vàng", min: 45000, max: 50000 },
            { name: "🔷 Sapphire", min: 55000, max: 60000 },
            { name: "💎 Kim Cương Thô", min: 65000, max: 70000 },
            { name: "🔮 Đá Ma Thuật", min: 70000, max: 80000 },
        ];
    } else {
        ores = [
            { name: "💎 Kim Cương", min: 200000, max: 300000 },
            { name: "🟥 Ruby", min: 300000, max: 450000 },
            { name: "🟦 Ngọc Lam", min: 450000, max: 650000 },
            { name: "🟪 Thạch Tím", min: 700000, max: 1000000 },
            { name: "👑 Quặng Huyền Thoại", min: 1200000, max: 1800000 },
        ];
    }

    const ore = ores[Math.floor(Math.random() * ores.length)];
    const scale = bet / 200000; 
    const baseValue = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;
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

        if (user.banned) return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia!", flags: 64 });
        if (user.money < bet) return interaction.reply({ content: `❌ Bạn không đủ **${bet.toLocaleString()} VND**!`, flags: 64 });

        user.money -= bet;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("⛏️ BẮT ĐẦU KHAI THÁC")
            .setDescription(
                `💰 Tiền vé: **${bet.toLocaleString()} VND**\n\n` +
                `📍 Tầng hiện tại: **0**\n` +
                `📈 ${getProgressBar(0)}\n\n` +
                `⚠️ *Sử dụng các nút bên dưới để đào sâu hơn hoặc rút lui!*`
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

            let crashChance = getCrashChance(game.floor);
            let luckMsg = "";

            // --- KIỂM TRA BÙA LUCK ---
            if (user.buffs.winRateBoost > 0) {
                const reduction = crashChance * user.buffs.winRateBoost;
                crashChance -= reduction;
                luckMsg = `\n🍀 **Đã dùng Bùa Luck (-${user.buffs.winRateBoost * 100}% tỉ lệ xập)!**`;
                user.buffs.winRateBoost = 0; // Xóa bùa sau khi dùng
                await user.save();
            }

            if (Math.random() * 100 < crashChance) {
                let shieldMsg = "";
                let lostReward = game.totalReward;

                // --- KIỂM TRA KHIÊN BẢO VỆ ---
                if (user.buffs.shield > 0) {
                    const savedAmount = Math.floor(game.totalReward * user.buffs.shield);
                    user.money += savedAmount;
                    lostReward -= savedAmount;
                    shieldMsg = `\n🔰 **Khiên bảo vệ (${user.buffs.shield * 100}%) đã giữ lại ${savedAmount.toLocaleString()} VND cho bạn!**`;
                    user.buffs.shield = 0; // Xóa khiên sau khi dùng
                    await user.save();
                }

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 XẬP HẦM!!!")
                    .setDescription(
                        `💀 Bạn bị chôn vùi tại tầng: **${game.floor}**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `🗑️ Mất quặng trị giá: **${lostReward.toLocaleString()} VND**` +
                        luckMsg + shieldMsg
                    );

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
                        `🎉 Bạn đã chạm đến Tầng Lõi **(${MAX_FLOOR}/${MAX_FLOOR})**!\n\n` +
                        `🎁 **JACKPOT PHÁ ĐẢO x2**\n` +
                        `💰 Tổng nhận: **${jackpot.toLocaleString()} VND**` + luckMsg
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
                        `📍 Tầng: **${game.floor}** | 📈 ${getProgressBar(game.floor)}\n\n` +
                        `💨 Tầng này không có quặng!` + luckMsg +
                        `\n📦 Túi đồ: **${game.totalReward.toLocaleString()} VND**`
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
                    `📍 Tầng: **${game.floor}** | 📈 ${getProgressBar(game.floor)}\n\n` +
                    `⛏️ Quặng: **${ore.name}** | ✨ Tinh khiết: **x${ore.multiplier}**\n` +
                    `💵 Giá trị: **+${ore.value.toLocaleString()} VND**` + luckMsg +
                    `\n\n📦 TỔNG TÚI ĐỒ: **${game.totalReward.toLocaleString()} VND**`
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
                .setTitle("跑🏃‍♂️ RÚT LUI AN TOÀN!")
                .setDescription(
                    `📍 Dừng lại tại tầng: **${game.floor}**\n\n` +
                    `💵 **Tiền thu về:** **${game.totalReward.toLocaleString()} VND**`
                );

            games.delete(interaction.message.id);
            return interaction.editReply({ embeds: [embed], components: [] });
        }
    },
};