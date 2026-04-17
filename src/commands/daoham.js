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
/* 🎯 TỈ LỆ XẬP THEO TẦNG */
/* ======================= */
function getCrashChance(floor) {
    if (floor <= 10) return (1 + ((floor - 1) * (4 / 9))) * 0.8;
    if (floor <= 20) return (7 + ((floor - 11) * (5 / 9))) * 1.1;
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
            { name: "🪨 Đá Thường", min: 8000, max: 12000 },
            { name: "🟤 Đồng Thô", min: 12000, max: 18000 },
            { name: "⚙️ Sắt", min: 18000, max: 25000 },
            { name: "🔩 Bạc Thô", min: 25000, max: 35000 },
            { name: "💠 Thạch Anh", min: 35000, max: 45000 },
        ];
    } else if (floor <= 20) {
        ores = [
            { name: "🥈 Bạc", min: 50000, max: 70000 },
            { name: "🟡 Vàng", min: 70000, max: 95000 },
            { name: "🔷 Sapphire", min: 95000, max: 120000 },
            { name: "💎 Kim Cương Thô", min: 120000, max: 160000 },
            { name: "🔮 Đá Ma Thuật", min: 160000, max: 220000 },
        ];
    } else {
        ores = [
            { name: "💎 Kim Cương", min: 250000, max: 350000 },
            { name: "🟥 Ruby", min: 350000, max: 500000 },
            { name: "🟦 Ngọc Lam", min: 500000, max: 750000 },
            { name: "🟪 Thạch Tím", min: 800000, max: 1200000 },
            { name: "👑 Quặng Huyền Thoại", min: 1500000, max: 2500000 },
        ];
    }

    const ore = ores[Math.floor(Math.random() * ores.length)];
    const scale = bet / 200000;
    const baseValue = Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;
    const multiplier = parseFloat((Math.random() * 1.5 + 1.5).toFixed(1));

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
            return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia!", flags: 64 });

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
                `⚠️ *Hệ thống sẽ tự động dùng Bùa/Khiên nếu bạn có!*`
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
            let crashChance = getCrashChance(game.floor);
            let buffInfo = "";

            // --- XỬ LÝ LUCK (🍀) ---
            if (user.buffs?.winRateBoost > 0) {
                crashChance = crashChance * (1 - user.buffs.winRateBoost); // Giảm % tỉ lệ xập
                buffInfo += `🍀 Luck -${user.buffs.winRateBoost * 100}% | `;
                user.buffs.winRateBoost = 0; // Reset bùa
                await user.save();
            }

            // KIỂM TRA XẬP HẦM
            if (Math.random() * 100 < crashChance) {
                let shieldSaved = 0;
                let shieldInfo = "";

                // --- XỬ LÝ KHIÊN (🔰) ---
                if (user.buffs?.shield > 0) {
                    shieldSaved = Math.floor(game.totalReward * user.buffs.shield);
                    user.money += shieldSaved;
                    shieldInfo = `\n🔰 **KHIÊN BẢO VỆ:** Đã cứu lại **${shieldSaved.toLocaleString()} VND**!`;
                    user.buffs.shield = 0; // Reset khiên
                    await user.save();
                }

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 XẬP HẦM!!!")
                    .setDescription(
                        `💀 Bạn bị chôn vùi tại tầng: **${game.floor}**\n` +
                        `💥 Tỉ lệ xập thực tế: **${crashChance.toFixed(1)}%**\n` +
                        `📈 ${getProgressBar(game.floor)}\n\n` +
                        `💀 **MẤT TRẮNG VÉ: ${game.bet.toLocaleString("vi-VN")} VND**\n` +
                        `🗑️ **MẤT QUẶNG: ${(game.totalReward - shieldSaved).toLocaleString("vi-VN")} VND**` +
                        shieldInfo
                    )
                    .setThumbnail("https://images.spiderum.com/sp-images/17eb0e60583e11ec97b1ed671895b6f8.png");

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            // NẾU KHÔNG XẬP -> TIẾP TỤC ĐÀO
            if (game.floor >= MAX_FLOOR) {
                const jackpot = game.totalReward * 2;
                user.money += jackpot;
                await user.save();

                const embed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle("👑 PHÁ ĐẢO HẦM MỎ!")
                    .setDescription(`🎉 Tầng Lõi **(${MAX_FLOOR}/${MAX_FLOOR})**!\n🎁 **JACKPOT x2:** **${jackpot.toLocaleString("vi-VN")} VND**`);

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("daoham_continue").setLabel("⛏️ ĐÀO TIẾP").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("daoham_cashout").setLabel("💰 RÚT TIỀN").setStyle(ButtonStyle.Primary)
            );

            const emptyChance = getEmptyChance(game.floor);
            if (Math.random() * 100 < emptyChance) {
                const embed = new EmbedBuilder()
                    .setColor(getColorByFloor(game.floor))
                    .setTitle("⛏️ TẦNG RỖNG")
                    .setDescription(`📍 Tầng: **${game.floor}** | 💥 Nguy hiểm: **${crashChance.toFixed(1)}%**\n${buffInfo ? `✨ Buff: ${buffInfo}\n` : ""}📈 ${getProgressBar(game.floor)}\n\n💨 Tầng này không có quặng!`);

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
                    `📍 Tầng: **${game.floor}** | 💥 Nguy hiểm: **${crashChance.toFixed(1)}%**\n` +
                    `${buffInfo ? `✨ Buff: ${buffInfo}\n` : ""}` +
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
                .setDescription(`📍 Dừng lại tại tầng: **${game.floor}**\n💵 **Tiền thu về:** **${game.totalReward.toLocaleString("vi-VN")} VND**`);

            games.delete(interaction.message.id);
            return interaction.editReply({ embeds: [embed], components: [] });
        }
    },
};