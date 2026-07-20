const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed } = require("../utils/ui");

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

// Sao độ hiếm quặng theo hệ số tinh khiết
function oreStars(multiplier) {
    if (multiplier >= 2.8) return "⭐⭐⭐⭐⭐";
    if (multiplier >= 2.4) return "⭐⭐⭐⭐";
    if (multiplier >= 2.0) return "⭐⭐⭐";
    if (multiplier >= 1.7) return "⭐⭐";
    return "⭐";
}

// Tên khu vực theo độ sâu
function zoneName(floor) {
    if (floor <= 10) return "🟢 Tầng Nông";
    if (floor <= 20) return "🟡 Tầng Khoáng";
    if (floor <= 30) return "🟠 Tầng Nham Thạch";
    return "🔴 VÙNG LÕI TỬ THẦN";
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
        if (user.money < bet) return interaction.reply({ content: `❌ Cần ${vnd(bet)} tiền mua vé! Ví bạn còn ${vnd(user.money)}.`, flags: 64 });

        user.money -= bet;
        await user.save();

        const embed = casinoEmbed({ color: COLORS.green, title: "⛏️ ✦ HẦM MỎ VÔ TẬN — MỞ CỬA ✦ ⛏️" })
            .setDescription(
                `\`\`\`\n  🏔️🏔️🏔️🏔️🏔️\n  ▓▓▓ ⛏️👷 ▓▓▓   ← cửa hầm\n  ▓▓▓▓▓▓▓▓▓▓▓\n\`\`\`` +
                `> 🎫 Tiền vé: **-${money(bet)} VND** • Ví còn: ${vnd(user.money)}\n` +
                `> 📍 Vị trí: **Cửa hầm (tầng 0)** — ${getProgressBar(0)}\n${"─".repeat(25)}\n` +
                `💡 **Luật chơi:** càng xuống sâu quặng càng quý nhưng tỉ lệ **XẬP HẦM mất trắng** càng cao. Đào tới tầng ${MAX_FLOOR} nhận **JACKPOT x2**!\n` +
                `🧿 *Bùa Luck & Khiên trong túi sẽ tự động kích hoạt.*`
            )
            .setFooter({ text: "⛏️ Bấm ĐÀO XUỐNG để bắt đầu • AFK 60s là hầm tự đóng" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("daoham_continue").setLabel("ĐÀO XUỐNG").setEmoji("⛏️").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("daoham_cashout").setLabel("RÚT LUI").setEmoji("💰").setStyle(ButtonStyle.Primary).setDisabled(true)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        const timeout = setTimeout(() => {
            games.delete(msg.id);
            interaction.editReply({ content: "⏳ Bạn đã AFK quá lâu, hầm mỏ đã đóng lại.", components: [] }).catch(() => {});
        }, 60000);

        games.set(msg.id, {
            userId: interaction.user.id,
            bet,
            floor: 0,
            totalReward: 0,
            bestOre: null,
            isProcessing: false,
            timeoutId: timeout,
        });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || interaction.user.id !== game.userId) {
            return interaction.reply({ content: "❌ Phiên này không thuộc về bạn! Gõ /daoham để mở hầm riêng.", flags: 64 });
        }

        if (game.isProcessing) return interaction.deferUpdate();
        game.isProcessing = true;

        await interaction.deferUpdate();
        clearTimeout(game.timeoutId);

        let user = await User.findOne({ userId: interaction.user.id });

        // ================== ĐÀO XUỐNG ==================
        if (interaction.customId === "daoham_continue") {
            game.floor++;
            let crashChance = getCrashChance(game.floor);
            let buffInfo = "";

            // --- LUCK 🍀 (giữ nguyên) ---
            if (user.buffs?.winRateBoost > 0) {
                crashChance = crashChance * (1 - user.buffs.winRateBoost);
                buffInfo = `🍀 Luck -${user.buffs.winRateBoost * 100}% rủi ro`;
                user.buffs.winRateBoost = 0;
                await user.save();
            }

            const riskIcon = crashChance > 25 ? "🟥" : crashChance > 10 ? "🟧" : "🟩";
            const riskBar = `${riskIcon.repeat(Math.min(12, Math.max(1, Math.round(crashChance / 4))))}${"⬛".repeat(Math.max(0, 12 - Math.round(crashChance / 4)))}`;

            // --- XẬP HẦM ---
            if (Math.random() * 100 < crashChance) {
                let shieldSaved = 0;
                let shieldInfo = "";

                if (user.buffs?.shield > 0) {
                    shieldSaved = Math.floor(game.totalReward * user.buffs.shield);
                    user.money += shieldSaved;
                    shieldInfo = `\n> 🔰 **KHIÊN BẢO VỆ:** cứu lại được **+${money(shieldSaved)} VND**!`;
                    user.buffs.shield = 0;
                    await user.save();
                }

                const embed = casinoEmbed({ color: COLORS.red, title: "💥 RẦM RẦM RẦM... XẬP HẦM!!!" })
                    .setThumbnail("https://images.spiderum.com/sp-images/17eb0e60583e11ec97b1ed671895b6f8.png")
                    .setDescription(
                        `\`\`\`\n  ▓▓▓💥▓▓▓\n  ▓☠️⛏️💎▓   (chôn vùi cùng đống quặng)\n  ▓▓▓▓▓▓▓▓\n\`\`\`` +
                        `> 💀 Bạn bị chôn vùi tại **tầng ${game.floor}** — ${zoneName(game.floor)}\n` +
                        `> 💥 Tỉ lệ xập thực tế: **${crashChance.toFixed(1)}%**\n` +
                        `> 📈 ${getProgressBar(game.floor)}\n${"─".repeat(25)}\n` +
                        `> 🎫 Mất vé: **-${money(game.bet)}**\n` +
                        `> 🗑️ Mất quặng: **-${money(game.totalReward - shieldSaved)}**${shieldInfo}`
                    )
                    .setFooter({ text: "⚰️ Tham thì thâm... Gõ /daoham để đào kiếp mới!" });

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            // --- PHÁ ĐẢO TẦNG LÕI (giữ nguyên jackpot x2) ---
            if (game.floor >= MAX_FLOOR) {
                const jackpot = game.totalReward * 2;
                user.money += jackpot;
                await user.save();

                const embed = casinoEmbed({ color: COLORS.gold, title: "👑 PHÁ ĐẢO HẦM MỎ — HUYỀN THOẠI THỢ MỎ! 👑" })
                    .setDescription(
                        `\`\`\`\n  ✨👑✨\n  💎💎💎   TẦNG LÕI ${MAX_FLOOR}/${MAX_FLOOR}\n  🏆⛏️🏆\n\`\`\`` +
                        `> 🎉 Bạn đã chạm tới **Tầng Lõi** — nơi chưa ai sống sót trở về!\n` +
                        `> 🎁 **JACKPOT x2: \`+${money(jackpot)} VND\`**\n` +
                        `> 💼 Ví hiện tại: ${vnd(user.money)}`
                    )
                    .setFooter({ text: "👑 Tên bạn đã được khắc vào lịch sử hầm mỏ!" });

                games.delete(interaction.message.id);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("daoham_continue").setLabel("ĐÀO TIẾP").setEmoji("⛏️").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("daoham_cashout").setLabel(`RÚT LUI (+${money(game.totalReward)})`).setEmoji("💰").setStyle(ButtonStyle.Primary)
            );

            // --- TẦNG RỖNG (giữ nguyên tỉ lệ) ---
            const emptyChance = getEmptyChance(game.floor);
            if (Math.random() * 100 < emptyChance) {
                const embed = casinoEmbed({ color: getColorByFloor(game.floor), title: "💨 TẦNG RỖNG — CHỈ CÓ ĐẤT VÀ ĐÁ" })
                    .setDescription(
                        `> 📍 **Tầng ${game.floor}** — ${zoneName(game.floor)}\n` +
                        `> 📈 ${getProgressBar(game.floor)}\n${buffInfo ? `> ✨ ${buffInfo}\n` : ""}${"─".repeat(25)}\n` +
                        `⛏️ Cuốc mãi chẳng thấy gì... tầng này trống trơn!\n\n` +
                        `🧨 **Rủi ro tầng kế:** ${crashChance.toFixed(1)}%\n${riskBar}\n` +
                        `📦 Túi quặng: **\`${money(game.totalReward)} VND\`**`
                    )
                    .setFooter({ text: "💨 Xui thôi! Đào tiếp hay rút lui đây?" });

                game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
                game.isProcessing = false;
                return interaction.editReply({ embeds: [embed], components: [row] });
            }

            // --- ĐÀO ĐƯỢC QUẶNG (giữ nguyên công thức) ---
            const ore = getOreByFloor(game.floor, game.bet);
            game.totalReward += ore.value;
            if (!game.bestOre || ore.value > game.bestOre.value) game.bestOre = ore;

            const embed = casinoEmbed({ color: getColorByFloor(game.floor), title: "💎 KENG! ĐÀO TRÚNG QUẶNG!" })
                .setDescription(
                    `> 📍 **Tầng ${game.floor}** — ${zoneName(game.floor)}\n` +
                    `> 📈 ${getProgressBar(game.floor)}\n${buffInfo ? `> ✨ ${buffInfo}\n` : ""}${"─".repeat(25)}\n` +
                    `# ${ore.name}\n` +
                    `> 🏅 Độ tinh khiết: **x${ore.multiplier}** ${oreStars(ore.multiplier)}\n` +
                    `> 💵 Giá trị: **+${money(ore.value)} VND**\n\n` +
                    `🧨 **Rủi ro tầng kế:** ${crashChance.toFixed(1)}%\n${riskBar}\n` +
                    `📦 Túi quặng: **\`${money(game.totalReward)} VND\`**`
                )
                .setFooter({ text: "😈 Xuống sâu nữa quặng xịn hơn... dám không?" });

            game.timeoutId = setTimeout(() => { games.delete(interaction.message.id); }, 60000);
            game.isProcessing = false;
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // ================== RÚT LUI ==================
        if (interaction.customId === "daoham_cashout") {
            user.money += game.totalReward;
            await user.save();

            const profit = game.totalReward - game.bet;
            const embed = casinoEmbed({ color: COLORS.cyan, title: "🏃‍♂️ RÚT LUI AN TOÀN — VỀ BỜ THÀNH CÔNG!" })
                .setDescription(
                    `\`\`\`\n  🏔️🏔️🏔️\n  👷💰💨  (chạy khỏi hầm với túi quặng)\n\`\`\`` +
                    `> 📍 Dừng chân tại: **tầng ${game.floor}** — ${zoneName(game.floor)}\n` +
                    `> 👑 Quặng quý nhất: ${game.bestOre ? `**${game.bestOre.name}** (\`${money(game.bestOre.value)}\`)` : "*không có*"}\n${"─".repeat(25)}\n` +
                    `> 💵 Thu về: **+${money(game.totalReward)} VND**\n` +
                    `> 📊 Lãi ròng (trừ vé): **${profit >= 0 ? "+" : ""}${money(profit)} VND** ${profit >= 0 ? "📈" : "📉"}\n` +
                    `> 💼 Ví hiện tại: ${vnd(user.money)}`
                )
                .setFooter({ text: "⛏️ Biết đủ là khôn • Gõ /daoham để xuống hầm chuyến nữa!" });

            games.delete(interaction.message.id);
            return interaction.editReply({ embeds: [embed], components: [] });
        }
    },
};