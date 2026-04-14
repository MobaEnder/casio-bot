const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();
const ENTRY_FEE = 200000;

const FISH_DATA = {
    shallow: { name: "Nước Nông", color: 0x55cdfc, breakBase: 5, fish: [ { name: "🐟 Cá Rô Đồng", min: 15000, max: 25000 }, { name: "🐠 Cá Bảy Màu", min: 10000, max: 20000 }, { name: "🐡 Cá Nóc Nhỏ", min: 20000, max: 35000 }, { name: "🦀 Cua Đồng", min: 25000, max: 40000 }, { name: "🦐 Tôm Thẻ", min: 18000, max: 28000 } ] },
    mid: { name: "Nước Vừa", color: 0x00a8ff, breakBase: 10, fish: [ { name: "🐟 Cá Chép", min: 40000, max: 70000 }, { name: "🐠 Cá Tai Tượng", min: 50000, max: 90000 }, { name: "🦑 Mực Ống", min: 70000, max: 110000 }, { name: "🐢 Rùa Sen", min: 100000, max: 150000 }, { name: "🐍 Lươn Điện", min: 120000, max: 180000 } ] },
    deep: { name: "Nước Sâu", color: 0x00416a, breakBase: 18, fish: [ { name: "🦈 Cá Mập Con", min: 150000, max: 250000 }, { name: "🐟 Cá Ngừ Đại Dương", min: 200000, max: 350000 }, { name: "🦑 Mực Khổng Lồ", min: 300000, max: 500000 }, { name: "🐡 Cá Mặt Trăng", min: 400000, max: 650000 }, { name: "🦀 Cua Hoàng Đế", min: 500000, max: 800000 } ] },
    abyss: { name: "Đáy Vực", color: 0x1a1a1a, breakBase: 25, fish: [ { name: "🐉 Long Ngư", min: 800000, max: 1500000 }, { name: "🐙 Quái Vật Kraken", min: 1500000, max: 2500000 }, { name: "💎 Cá Pha Lê", min: 2500000, max: 4000000 }, { name: "🔱 Quy Thần Đáy Biển", min: 4000000, max: 6000000 }, { name: "👑 Cá Hoàng Gia", min: 6000000, max: 10000000 } ] }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cauca")
        .setDescription("🎣 Đi câu cá giải trí - Phí vào cổng 200k"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (user.money < ENTRY_FEE) {
            return interaction.reply({ content: `❌ Bạn không đủ **${ENTRY_FEE.toLocaleString()} VND** để mua mồi câu!`, flags: 64 });
        }

        user.money -= ENTRY_FEE;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle("🎣 CHUYẾN ĐI CÂU BẮT ĐẦU")
            .setDescription("Hãy chọn vùng nước bạn muốn thả mồi. Vùng càng sâu, cá càng quý nhưng dây câu càng dễ đứt!")
            .addFields(
                { name: "🌊 Nước Nông", value: "An toàn", inline: true },
                { name: "💧 Nước Vừa", value: "Rủi ro thấp", inline: true },
                { name: "🟦 Nước Sâu", value: "Rủi ro cao", inline: true },
                { name: "⬛ Đáy Vực", value: "Nguy hiểm", inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cauca_select_shallow").setLabel("Nước Nông").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cauca_select_mid").setLabel("Nước Vừa").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("cauca_select_deep").setLabel("Nước Sâu").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("cauca_select_abyss").setLabel("Đáy Vực").setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], withResponse: true });
        const msg = response.resource.message;

        games.set(msg.id, {
            userId: interaction.user.id,
            zone: null,
            basket: [],
            totalValue: 0,
            fishCount: 0
        });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || interaction.user.id !== game.userId) {
            return interaction.reply({ content: "❌ Phiên này không thuộc về bạn!", flags: 64 });
        }

        // 🛠️ FIX: Tách ID chuẩn hơn
        const parts = interaction.customId.split("_");
        const action = parts[1]; // "select", "cast", "collect"
        const value = parts[2];  // "shallow", "mid", "deep", "abyss"

        // 1. CHỌN VÙNG NƯỚC
        if (action === "select") {
            game.zone = value;
            return updateGameUI(interaction, game);
        }

        // 2. CÂU TIẾP
        if (action === "cast") {
            const zoneData = FISH_DATA[game.zone];
            const breakChance = zoneData.breakBase + (game.fishCount * 4); 

            if (Math.random() * 100 < breakChance) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 ĐỨT DÂY CÂU!!!")
                    .setDescription(`💔 Ôi không! Một con cá quá lớn đã kéo đứt dây câu của bạn tại **${zoneData.name}**.\n\n` +
                                    `🗑️ Bạn đã mất trắng **${game.totalValue.toLocaleString()} VND**!`);
                
                games.delete(interaction.message.id);
                return interaction.update({ embeds: [embed], components: [] });
            }

            const fishList = zoneData.fish;
            const caught = fishList[Math.floor(Math.random() * fishList.length)];
            const fishVal = Math.floor(Math.random() * (caught.max - caught.min + 1)) + caught.min;

            game.basket.push(caught.name);
            game.totalValue += fishVal;
            game.fishCount++;

            return updateGameUI(interaction, game, `✨ Bạn vừa câu được: **${caught.name}** (+${fishVal.toLocaleString()} VND)`);
        }

        // 3. THU LƯỚI
        if (action === "collect") {
            let user = await User.findOne({ userId: interaction.user.id });
            user.money += game.totalValue;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setTitle("🚢 THU LƯỚI TRỞ VỀ")
                .setDescription(`Bạn đã kết thúc chuyến câu tại **${FISH_DATA[game.zone].name}**.\n\n` +
                                `🎒 Tổng số cá: **${game.fishCount} con**\n` +
                                `💰 Tổng tiền thu về: **${game.totalValue.toLocaleString()} VND**`);

            games.delete(interaction.message.id);
            return interaction.update({ embeds: [embed], components: [] });
        }
    }
};

async function updateGameUI(interaction, game, lastActionMsg = "") {
    const zoneData = FISH_DATA[game.zone];
    const breakChance = zoneData.breakBase + (game.fishCount * 4);

    const embed = new EmbedBuilder()
        .setColor(zoneData.color)
        .setTitle(`🎣 ĐANG CÂU TẠI: ${zoneData.name.toUpperCase()}`)
        .setDescription(
            `${lastActionMsg ? lastActionMsg + "\n\n" : ""}` +
            `🛒 Giỏ cá: **${game.fishCount}** con\n` +
            `💰 Tổng trị giá: **${game.totalValue.toLocaleString()} VND**\n` +
            `⚠️ Tỉ lệ đứt dây tiếp theo: **${breakChance.toFixed(0)}%**`
        );

    // 🛠️ FIX: Đồng bộ lại customId cho các nút ở màn hình câu cá
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cauca_cast_action").setLabel("🎣 QUĂNG MỒI TIẾP").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cauca_collect_action").setLabel("🚢 THU LƯỚI VỀ").setStyle(ButtonStyle.Primary).setDisabled(game.fishCount === 0)
    );

    return interaction.update({ embeds: [embed], components: [row] });
}