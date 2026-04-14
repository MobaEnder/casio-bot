const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();
const abyssCooldowns = new Map(); // ⏳ Bộ nhớ tạm lưu cooldown Đáy Vực
const ENTRY_FEE = 200000;
const ABYSS_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 tiếng tính bằng milliseconds

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
                { name: "⬛ Đáy Vực", value: "1 con/3 tiếng", inline: true }
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

        const parts = interaction.customId.split("_");
        const action = parts[1]; // "select", "cast", "collect"
        const value = parts[2];  // "shallow", "mid", "deep", "abyss"

        // 1. CHỌN VÙNG NƯỚC
        if (action === "select") {
            // ⏳ Kiểm tra cooldown nếu chọn Đáy Vực
            if (value === "abyss") {
                const lastTime = abyssCooldowns.get(interaction.user.id) || 0;
                const now = Date.now();

                if (now < lastTime + ABYSS_COOLDOWN_MS) {
                    const timeLeft = lastTime + ABYSS_COOLDOWN_MS - now;
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    
                    return interaction.reply({ 
                        content: `🌪️ Biển động dữ dội! Bạn phải chờ **${hours} giờ ${minutes} phút** nữa mới có thể vào Đáy Vực.`, 
                        flags: 64 
                    });
                }
                
                // Nếu đủ điều kiện, ghi nhận thời gian bắt đầu cooldown
                abyssCooldowns.set(interaction.user.id, now);
            }

            game.zone = value;
            return updateGameUI(interaction, game);
        }

        // 2. CÂU TIẾP
        if (action === "cast") {
            const zoneData = FISH_DATA[game.zone];
            const breakChance = zoneData.breakBase + (game.fishCount * 2); 

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
    
    // 🛑 Kiểm tra xem người chơi có đang ở Đáy vực và đã câu được cá chưa
    const isAbyssMaxed = game.zone === "abyss" && game.fishCount >= 1;

    const embed = new EmbedBuilder()
        .setColor(zoneData.color)
        .setTitle(`🎣 ĐANG CÂU TẠI: ${zoneData.name.toUpperCase()}`)
        .setDescription(
            `${lastActionMsg ? lastActionMsg + "\n\n" : ""}` +
            `🛒 Giỏ cá: **${game.fishCount}** con ${isAbyssMaxed ? "(Đã đầy)" : ""}\n` +
            `💰 Tổng trị giá: **${game.totalValue.toLocaleString()} VND**\n` +
            `⚠️ Tỉ lệ đứt dây tiếp theo: **${breakChance.toFixed(0)}%**`
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("cauca_cast_action")
            .setLabel(isAbyssMaxed ? "🔒 KHÔNG THỂ CÂU THÊM" : "🎣 QUĂNG MỒI TIẾP")
            .setStyle(isAbyssMaxed ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(isAbyssMaxed), // Khóa nút nếu ở đáy vực và đã có 1 con
        new ButtonBuilder()
            .setCustomId("cauca_collect_action")
            .setLabel("🚢 THU LƯỚI VỀ")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(game.fishCount === 0)
    );

    return interaction.update({ embeds: [embed], components: [row] });
}