const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();
const abyssCooldowns = new Map();
const ENTRY_FEE = 200000;
const ABYSS_COOLDOWN_MS = 3 * 60 * 60 * 1000; 

const FISH_DATA = {
    shallow: { 
        name: "Nước Nông", 
        color: 0x55cdfc, 
        breakBase: 5, 
        fish: [ 
            { name: "🐟 Cá Rô Đồng", min: 5000, max: 8000 }, 
            { name: "🐠 Cá Bảy Màu", min: 9000, max: 10000 }, 
            { name: "🐡 Cá Nóc Nhỏ", min: 10000, max: 15000 }, 
            { name: "🦀 Cua Đồng", min: 15000, max: 20000 }, 
            { name: "🦐 Tôm Thẻ", min: 20000, max: 25000 } 
        ] 
    },
    mid: { 
        name: "Nước Vừa", 
        color: 0x00a8ff, 
        breakBase: 5, 
        fish: [ 
            { name: "🐟 Cá Chép", min: 30000, max: 35000 }, 
            { name: "🐠 Cá Tai Tượng", min: 40000, max: 45000 }, 
            { name: "🦑 Mực Ống", min: 50000, max: 55000 }, 
            { name: "🐢 Rùa Sen", min: 60000, max: 65000 }, 
            { name: "🐍 Lươn Điện", min: 65000, max: 70000 } 
        ] 
    },
    deep: { 
        name: "Nước Sâu", 
        color: 0x00416a, 
        breakBase: 10, 
        fish: [ 
            { name: "🦈 Cá Mập Con", min: 70000, max: 75000 }, 
            { name: "🐟 Cá Ngừ Đại Dương", min: 80000, max: 85000 }, 
            { name: "🦑 Mực Khổng Lồ", min: 90000, max: 95000 }, 
            { name: "🐡 Cá Mặt Trăng", min: 90000, max: 93000 }, 
            { name: "🦀 Cua Hoàng Đế", min: 93000, max: 96000 } 
        ] 
    },
    abyss: { 
        name: "Đáy Vực", 
        color: 0x1a1a1a, 
        breakBase: 70, 
        fish: [ 
            { name: "🐉 Long Ngư", min: 1000000, max: 1200000 }, 
            { name: "🐙 Quái Vật Kraken", min: 1200000, max: 1500000 }, 
            { name: "💎 Cá Pha Lê", min: 1500000, max: 2000000 }, 
            { name: "🔱 Quy Thần Đáy Biển", min: 2500000, max: 3000000 }, 
            { name: "👑 Cá Hoàng Gia", min: 3500000, max: 4000000 } 
        ] 
    }
};

module.exports = {
    data: new SlashCommandBuilder().setName("cauca").setDescription("🎣 Đi câu cá giải trí - Phí 200k"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });
        if (user.money < ENTRY_FEE) return interaction.reply({ content: `❌ Cần **${ENTRY_FEE.toLocaleString()} VND** để đi câu!`, flags: 64 });

        user.money -= ENTRY_FEE;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle("🎣 CHUYẾN ĐI CÂU BẮT ĐẦU")
            .setDescription("Hãy chọn vùng nước bạn muốn thả mồi.");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cauca_select_shallow").setLabel("Nước Nông").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cauca_select_mid").setLabel("Nước Vừa").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("cauca_select_deep").setLabel("Nước Sâu").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("cauca_select_abyss").setLabel("Đáy Vực").setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        games.set(response.id, { userId: interaction.user.id, zone: null, totalValue: 0, fishCount: 0 });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Không phải phiên của bạn!", flags: 64 });

        const [ , action, value] = interaction.customId.split("_");
        let user = await User.findOne({ userId: interaction.user.id });

        // 1. CHỌN VÙNG NƯỚC
        if (action === "select") {
            if (value === "abyss") {
                const lastTime = abyssCooldowns.get(interaction.user.id) || 0;
                if (Date.now() < lastTime + ABYSS_COOLDOWN_MS) {
                    const timeLeft = lastTime + ABYSS_COOLDOWN_MS - Date.now();
                    return interaction.reply({ content: `🌪️ Đáy Vực đang động! Còn **${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}p**.`, flags: 64 });
                }
                abyssCooldowns.set(interaction.user.id, Date.now());
            }
            game.zone = value;
            return updateGameUI(interaction, game);
        }

        // 2. QUĂNG MỒI
        if (action === "cast") {
            const zoneData = FISH_DATA[game.zone];
            let breakChance = zoneData.breakBase + (game.fishCount * 4);
            let luckMsg = "";

            // --- DÙNG BÙA LUCK ---
            if (user.buffs.winRateBoost > 0) {
                const reduction = breakChance * user.buffs.winRateBoost;
                breakChance -= reduction;
                luckMsg = `\n*(🍀 Đã dùng Bùa Luck: -${user.buffs.winRateBoost * 100}% tỉ lệ đứt)*`;
                user.buffs.winRateBoost = 0;
                await user.save();
            }

            if (Math.random() * 100 < breakChance) {
                let shieldMsg = "";
                let lostValue = game.totalValue;

                // --- DÙNG KHIÊN BẢO VỆ ---
                if (user.buffs.shield > 0) {
                    const saved = Math.floor(game.totalValue * user.buffs.shield);
                    user.money += saved;
                    lostValue -= saved;
                    shieldMsg = `\n🔰 **Khiên bảo vệ đã giữ lại ${saved.toLocaleString()} VND!**`;
                    user.buffs.shield = 0;
                    await user.save();
                }

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("💥 ĐỨT DÂY CÂU!!!")
                    .setDescription(`Dây câu bị đứt tại **${zoneData.name}**! Mất trắng **${lostValue.toLocaleString()} VND** cá.` + luckMsg + shieldMsg);
                
                games.delete(interaction.message.id);
                return interaction.update({ embeds: [embed], components: [] });
            }

            // TÍNH TOÁN CÁ CÂU ĐƯỢC
            const caught = zoneData.fish[Math.floor(Math.random() * zoneData.fish.length)];
            const fishVal = Math.floor(Math.random() * (caught.max - caught.min + 1)) + caught.min;
            
            game.fishCount++;
            game.totalValue += fishVal;

            return updateGameUI(interaction, game, `✨ Bạn vừa câu được: **${caught.name}** (+${fishVal.toLocaleString()} VND)${luckMsg}`);
        }

        // 3. THU LƯỚI
        if (action === "collect") {
            user.money += game.totalValue;
            await user.save();
            const embed = new EmbedBuilder()
                .setColor(0xffcc00)
                .setTitle("🚢 THU LƯỚI TRỞ VỀ")
                .setDescription(`💰 Tổng tiền thu về: **${game.totalValue.toLocaleString()} VND**`);
            games.delete(interaction.message.id);
            return interaction.update({ embeds: [embed], components: [] });
        }
    }
};

async function updateGameUI(interaction, game, lastActionMsg = "") {
    const zoneData = FISH_DATA[game.zone];
    const breakChance = zoneData.breakBase + (game.fishCount * 4);
    const isAbyssMaxed = game.zone === "abyss" && game.fishCount >= 1;

    const embed = new EmbedBuilder()
        .setColor(zoneData.color)
        .setTitle(`🎣 ĐANG CÂU TẠI: ${zoneData.name.toUpperCase()}`)
        .setDescription(`${lastActionMsg ? lastActionMsg + "\n\n" : ""}🛒 Giỏ cá: **${game.fishCount}** con\n💰 Trị giá: **${game.totalValue.toLocaleString()} VND**\n⚠️ Tỉ lệ đứt tiếp: **${breakChance.toFixed(0)}%**`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cauca_cast_action").setLabel(isAbyssMaxed ? "🔒 GIỎ ĐẦY" : "🎣 QUĂNG MỒI").setStyle(isAbyssMaxed ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(isAbyssMaxed),
        new ButtonBuilder().setCustomId("cauca_collect_action").setLabel("🚢 THU LƯỚI").setStyle(ButtonStyle.Primary).setDisabled(game.fishCount === 0)
    );
    return interaction.update({ embeds: [embed], components: [row] });
}