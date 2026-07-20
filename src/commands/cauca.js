const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed } = require("../utils/ui");

const games = new Map();
const abyssCooldowns = new Map();
const ENTRY_FEE = 200000;
const ABYSS_COOLDOWN_MS = 3 * 60 * 60 * 1000;

const FISH_DATA = {
    shallow: {
        name: "Nước Nông", emoji: "🏖️", color: 0x55cdfc, breakBase: 2,
        fish: [
            { name: "🐟 Cá Rô Đồng", min: 5000, max: 8000 },
            { name: "🐠 Cá Bảy Màu", min: 9000, max: 10000 },
            { name: "🐡 Cá Nóc Nhỏ", min: 10000, max: 15000 },
            { name: "🦀 Cua Đồng", min: 15000, max: 20000 },
            { name: "🦐 Tôm Thẻ", min: 20000, max: 25000 },
        ],
    },
    mid: {
        name: "Nước Vừa", emoji: "🌊", color: 0x00a8ff, breakBase: 2,
        fish: [
            { name: "🐟 Cá Chép", min: 30000, max: 35000 },
            { name: "🐠 Cá Tai Tượng", min: 40000, max: 45000 },
            { name: "🦑 Mực Ống", min: 50000, max: 55000 },
            { name: "🐢 Rùa Sen", min: 60000, max: 65000 },
            { name: "🐍 Lươn Điện", min: 65000, max: 70000 },
        ],
    },
    deep: {
        name: "Nước Sâu", emoji: "🌑", color: 0x00416a, breakBase: 5,
        fish: [
            { name: "🦈 Cá Mập Con", min: 70000, max: 75000 },
            { name: "🐟 Cá Ngừ Đại Dương", min: 80000, max: 85000 },
            { name: "🦑 Mực Khổng Lồ", min: 90000, max: 95000 },
            { name: "🐡 Cá Mặt Trăng", min: 90000, max: 93000 },
            { name: "🦀 Cua Hoàng Đế", min: 93000, max: 96000 },
        ],
    },
    abyss: {
        name: "Đáy Vực", emoji: "🕳️", color: 0x1a1a1a, breakBase: 70,
        fish: [
            { name: "🐉 Long Ngư", min: 1000000, max: 1200000 },
            { name: "🐙 Quái Vật Kraken", min: 1200000, max: 1500000 },
            { name: "💎 Cá Pha Lê", min: 1500000, max: 2000000 },
            { name: "🔱 Quy Thần Đáy Biển", min: 2500000, max: 3000000 },
            { name: "👑 Cá Hoàng Gia", min: 3500000, max: 4000000 },
        ],
    },
};

// Độ hiếm dựa trên giá trị cá so với vùng
function rarityStars(fishVal, zone) {
    const zoneMax = Math.max(...FISH_DATA[zone].fish.map((f) => f.max));
    const ratio = fishVal / zoneMax;
    if (ratio > 0.9) return "⭐⭐⭐⭐⭐ HUYỀN THOẠI";
    if (ratio > 0.7) return "⭐⭐⭐⭐ CỰC HIẾM";
    if (ratio > 0.5) return "⭐⭐⭐ HIẾM";
    if (ratio > 0.3) return "⭐⭐ THƯỜNG";
    return "⭐ PHỔ THÔNG";
}

const CAST_FLAVOR = [
    "Vút... tõm! Mồi đã chìm xuống nước 🪱",
    "Dây câu căng nhẹ... có gì đó đang rỉa mồi 👀",
    "Mặt nước gợn sóng... GIẬT CẦN! 💪",
    "Phao chìm nghỉm! Kéo lên nào!! 🎣",
];

module.exports = {
    data: new SlashCommandBuilder().setName("cauca").setDescription("🎣 Đi câu cá giải trí - Phí 200k"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });
        if (user.money < ENTRY_FEE) return interaction.reply({ content: `❌ Cần ${vnd(ENTRY_FEE)} để đi câu! Ví bạn còn ${vnd(user.money)}.`, flags: 64 });

        user.money -= ENTRY_FEE;
        await user.save();

        // Bảng giới thiệu 4 vùng nước kèm khoảng giá
        const zoneField = (z) => {
            const d = FISH_DATA[z];
            const lo = Math.min(...d.fish.map((f) => f.min));
            const hi = Math.max(...d.fish.map((f) => f.max));
            return `${d.emoji} **${d.name}**\n💵 \`${money(lo)} → ${money(hi)}\`\n⚠️ Đứt dây gốc: **${d.breakBase}%**`;
        };

        const embed = casinoEmbed({ color: COLORS.cyan, title: "🎣 ✦ CHUYẾN RA KHƠI BẮT ĐẦU ✦ 🚤" })
            .setDescription(
                `> Đã thu phí thuê thuyền ${vnd(ENTRY_FEE)} • 💼 Ví còn: ${vnd(user.money)}\n` +
                `> Câu càng nhiều, tỉ lệ **đứt dây mất trắng** càng cao. Tham thì thâm! 😈\n\n` +
                `**CHỌN VÙNG NƯỚC THẢ MỒI:**`
            )
            .addFields(
                { name: "\u200b", value: zoneField("shallow"), inline: true },
                { name: "\u200b", value: zoneField("mid"), inline: true },
                { name: "\u200b", value: zoneField("deep"), inline: true },
                { name: "\u200b", value: zoneField("abyss") + "\n🕐 *Hồi chiêu 3 giờ, tối đa 1 con*", inline: true }
            )
            .setFooter({ text: "💡 Đáy Vực: rủi ro 70% nhưng cá tiền triệu!" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cauca_select_shallow").setLabel("Nước Nông").setEmoji("🏖️").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cauca_select_mid").setLabel("Nước Vừa").setEmoji("🌊").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("cauca_select_deep").setLabel("Nước Sâu").setEmoji("🌑").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("cauca_select_abyss").setLabel("Đáy Vực").setEmoji("🕳️").setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const response = await interaction.fetchReply();
        games.set(response.id, { userId: interaction.user.id, zone: null, totalValue: 0, fishCount: 0, bestCatch: null, log: [] });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải phiên câu của bạn!", flags: 64 });

        const [, action, value] = interaction.customId.split("_");
        let user = await User.findOne({ userId: interaction.user.id });

        // 1. CHỌN VÙNG NƯỚC
        if (action === "select") {
            if (value === "abyss") {
                const lastTime = abyssCooldowns.get(interaction.user.id) || 0;
                if (Date.now() < lastTime + ABYSS_COOLDOWN_MS) {
                    const readyAt = lastTime + ABYSS_COOLDOWN_MS;
                    return interaction.reply({ content: `🌪️ Đáy Vực đang động! Quay lại <t:${Math.floor(readyAt / 1000)}:R>.`, flags: 64 });
                }
                abyssCooldowns.set(interaction.user.id, Date.now());
            }
            game.zone = value;
            return updateGameUI(interaction, game);
        }

        // 2. QUĂNG MỒI
        if (action === "cast") {
            const zoneData = FISH_DATA[game.zone];
            let breakChance = zoneData.breakBase + game.fishCount * 2;
            let luckMsg = "";

            if (user.buffs.winRateBoost > 0) {
                const reduction = breakChance * user.buffs.winRateBoost;
                breakChance -= reduction;
                luckMsg = `\n> 🍀 *Bùa Luck kích hoạt: -${user.buffs.winRateBoost * 100}% tỉ lệ đứt*`;
                user.buffs.winRateBoost = 0;
                await user.save();
            }

            // 💥 ĐỨT DÂY
            if (Math.random() * 100 < breakChance) {
                let shieldMsg = "";
                let lostValue = game.totalValue;

                if (user.buffs.shield > 0) {
                    const saved = Math.floor(game.totalValue * user.buffs.shield);
                    user.money += saved;
                    lostValue -= saved;
                    shieldMsg = `\n> 🔰 **Khiên bảo vệ giữ lại được ${money(saved)} VND!**`;
                    user.buffs.shield = 0;
                    await user.save();
                }

                const embed = casinoEmbed({ color: COLORS.red, title: "💥 PHỰT... ĐỨT DÂY CÂU!!!" })
                    .setDescription(
                        `\`\`\`\n    🎣\n     \\\n      ✂️ ~ ~ ~\n         🐟💨 (cá ôm giỏ chạy mất)\n\`\`\`` +
                        `Con cá quá khỏe đã giật đứt dây tại **${zoneData.emoji} ${zoneData.name}**!\n` +
                        `🕳️ Mất trắng **${money(lostValue)} VND** tiền cá (${game.fishCount} con).` + luckMsg + shieldMsg
                    )
                    .setFooter({ text: "🎣 Tham thì thâm... Gõ /cauca để phục thù!" });

                games.delete(interaction.message.id);
                return interaction.update({ embeds: [embed], components: [] });
            }

            // ✨ CÂU ĐƯỢC CÁ
            const caught = zoneData.fish[Math.floor(Math.random() * zoneData.fish.length)];
            const fishVal = Math.floor(Math.random() * (caught.max - caught.min + 1)) + caught.min;

            game.fishCount++;
            game.totalValue += fishVal;
            if (!game.bestCatch || fishVal > game.bestCatch.val) game.bestCatch = { name: caught.name, val: fishVal };
            game.log.push(`> ${caught.name} — \`${money(fishVal)}\` ${rarityStars(fishVal, game.zone).split(" ")[0]}`);

            const flavor = CAST_FLAVOR[Math.floor(Math.random() * CAST_FLAVOR.length)];
            return updateGameUI(interaction, game,
                `🎣 *${flavor}*\n\n✨ **BẮT ĐƯỢC: ${caught.name}**\n` +
                `> 💵 Giá trị: **+${money(fishVal)} VND**\n> 🏅 Độ hiếm: **${rarityStars(fishVal, game.zone)}**${luckMsg}`
            );
        }

        // 3. THU LƯỚI
        if (action === "collect") {
            user.money += game.totalValue;
            await user.save();
            const embed = casinoEmbed({ color: COLORS.gold, title: "🚢 THU LƯỚI TRỞ VỀ — CHUYẾN ĐI THẮNG LỢI!" })
                .setDescription(
                    `\`\`\`\n   🚤💨  ~ ~ ~\n   🐟🐠🦀 (giỏ đầy ắp)\n\`\`\`` +
                    `📦 **GIỎ CÁ (${game.fishCount} con):**\n${game.log.slice(-8).join("\n")}\n\n` +
                    `👑 **Cá to nhất:** ${game.bestCatch ? `${game.bestCatch.name} — \`${money(game.bestCatch.val)}\`` : "—"}\n` +
                    `💰 **Tổng thu về: +${money(game.totalValue)} VND**\n` +
                    `📈 Lãi ròng chuyến đi: **${game.totalValue - ENTRY_FEE >= 0 ? "+" : ""}${money(game.totalValue - ENTRY_FEE)} VND**\n` +
                    `💼 Ví hiện tại: ${vnd(user.money)}`
                )
                .setFooter({ text: "🎣 Gõ /cauca để ra khơi chuyến nữa!" });
            games.delete(interaction.message.id);
            return interaction.update({ embeds: [embed], components: [] });
        }
    },
};

async function updateGameUI(interaction, game, lastActionMsg = "") {
    const zoneData = FISH_DATA[game.zone];
    const breakChance = Math.min(100, zoneData.breakBase + game.fishCount * 2);
    const isAbyssMaxed = game.zone === "abyss" && game.fishCount >= 1;

    // Đồng hồ rủi ro đổi màu theo mức nguy hiểm
    const riskIcon = breakChance >= 50 ? "🟥" : breakChance >= 20 ? "🟧" : "🟩";

    const embed = casinoEmbed({ color: zoneData.color, title: `🎣 ĐANG CÂU TẠI: ${zoneData.emoji} ${zoneData.name.toUpperCase()}` })
        .setDescription(lastActionMsg || "> *Thả mồi thôi nào!*")
        .addFields(
            { name: "🛒 Giỏ cá", value: `**${game.fishCount}** con\n💰 \`${money(game.totalValue)}\``, inline: true },
            { name: "👑 Cá to nhất", value: game.bestCatch ? `${game.bestCatch.name}\n\`${money(game.bestCatch.val)}\`` : "*Chưa có*", inline: true },
            { name: `${riskIcon} Rủi ro đứt dây`, value: `**${breakChance.toFixed(0)}%**\n${bar(breakChance / 100, 8, riskIcon, "⬛")}`, inline: true }
        )
        .setFooter({ text: isAbyssMaxed ? "🕳️ Đáy Vực chỉ cho câu 1 con — thu lưới ngay!" : "💡 Càng câu nhiều rủi ro càng tăng — biết đủ là khôn!" });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cauca_cast_action").setLabel(isAbyssMaxed ? "GIỎ ĐẦY" : "QUĂNG MỒI").setEmoji(isAbyssMaxed ? "🔒" : "🎣").setStyle(isAbyssMaxed ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(isAbyssMaxed),
        new ButtonBuilder().setCustomId("cauca_collect_action").setLabel(`THU LƯỚI (+${money(game.totalValue)})`).setEmoji("🚢").setStyle(ButtonStyle.Primary).setDisabled(game.fishCount === 0)
    );
    return interaction.update({ embeds: [embed], components: [row] });
}