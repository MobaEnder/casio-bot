const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed } = require("../utils/ui");

// Định nghĩa dữ liệu vật phẩm (GIỮ NGUYÊN 100%)
const ITEMS = {
    titles: [
        { id: "t_tap_su", name: "🎰 Con Nghiện Tập Sự", price: 10000000, type: "title" },
        { id: "t_dan_choi", name: "🕶️ Dân Chơi Hệ Tiền", price: 100000000, type: "title" },
        { id: "t_than_bai", name: "🃏 Thần Bài Tái Thế", price: 500000000, type: "title" },
        { id: "t_de_vuong", name: "👑 Đế Vương Casino", price: 1000000000, type: "title" },
        { id: "t_huyen_thoai", name: "🌌 Huyền Thoại Bất Tử", price: 3000000000, type: "title" },
    ],
    guards: [
        { id: "g_low", name: "🛡️ Bảo Vệ Cấp Thấp", price: 1000000, type: "guard", level: 1, desc: "Giảm 10% tỉ lệ bị trộm" },
        { id: "g_mid", name: "🛡️ Bảo Vệ Cấp Trung", price: 50000000, type: "guard", level: 2, desc: "Giảm 25% tỉ lệ bị trộm" },
        { id: "g_high", name: "🛡️ Bảo Vệ Cấp Cao", price: 100000000, type: "guard", level: 3, desc: "Giảm 50% tỉ lệ bị trộm" },
    ],
    charms: [
        { id: "c_luck_s", name: "🍀 Bùa Luck Nhỏ (+5%)", price: 10000000, type: "charm", boost: 0.05, desc: "Tăng 5% tỉ lệ thắng ván sau" },
        { id: "c_luck_m", name: "🍀 Bùa Luck Vừa (+15%)", price: 50000000, type: "charm", boost: 0.15, desc: "Tăng 15% tỉ lệ thắng ván sau" },
        { id: "c_luck_l", name: "🍀 Bùa Luck To (+30%)", price: 200000000, type: "charm", boost: 0.30, desc: "Tăng 30% tỉ lệ thắng ván sau" },
        { id: "c_shield_s", name: "🔰 Khiên Nhỏ (Giảm 20%)", price: 15000000, type: "charm", shield: 0.2, desc: "Giảm 20% tiền mất khi thua" },
        { id: "c_shield_m", name: "🔰 Khiên Vừa (Giảm 50%)", price: 100000000, type: "charm", shield: 0.5, desc: "Giảm 50% tiền mất khi thua" },
        { id: "c_shield_l", name: "🔰 Khiên To (Giảm 80%)", price: 400000000, type: "charm", shield: 0.8, desc: "Giảm 80% tiền mất khi thua" },
    ],
    tower: [
        { id: "tw_att_5", name: "🎫 5 Lượt Đi Tháp", price: 1000000, type: "tower_attempt", amount: 5, desc: "Cộng thêm 5 lượt leo tháp" },
        { id: "tw_att_10", name: "🎫 10 Lượt Đi Tháp", price: 2000000, type: "tower_attempt", amount: 10, desc: "Cộng thêm 10 lượt leo tháp" },
        { id: "tw_att_20", name: "🎫 20 Lượt Đi Tháp", price: 4000000, type: "tower_attempt", amount: 20, desc: "Cộng thêm 20 lượt leo tháp" },
        { id: "tw_att_30", name: "🎫 30 Lượt Đi Tháp", price: 6000000, type: "tower_attempt", amount: 30, desc: "Cộng thêm 30 lượt leo tháp" },
        { id: "tw_buff_10", name: "🔥 Thẻ Buff Tháp (+10%)", price: 1000000, type: "tower_buff", boost: 0.10, desc: "Tăng 10% Lực chiến khi leo tháp" },
        { id: "tw_buff_20", name: "🔥 Thẻ Buff Tháp (+20%)", price: 10000000, type: "tower_buff", boost: 0.20, desc: "Tăng 20% Lực chiến khi leo tháp" },
        { id: "tw_buff_35", name: "🔥 Thẻ Buff Tháp (+35%)", price: 40000000, type: "tower_buff", boost: 0.35, desc: "Tăng 35% Lực chiến khi leo tháp" },
    ],
};

const CATEGORY_META = {
    titles: { label: "DANH HIỆU", emoji: "🎭", tagline: "Đẳng cấp là mãi mãi — mua để cả server phải nể!" },
    guards: { label: "ĐỘI BẢO VỆ", emoji: "🛡️", tagline: "Thuê vệ sĩ canh nhà, bọn /antrom hết cửa!" },
    charms: { label: "BÙA CHÚ", emoji: "🧿", tagline: "Bùa Luck tăng tỉ lệ thắng • Khiên giảm lỗ khi thua!" },
    tower: { label: "TIỆM ĐỒ THÁP", emoji: "🗼", tagline: "Lượt leo & buff lực chiến cho /leothap!" },
};

function renderCategory(categoryKey, userMoney) {
    const meta = CATEGORY_META[categoryKey];
    const items = ITEMS[categoryKey];

    const list = items.map((item) => {
        const affordable = userMoney >= item.price;
        return `${affordable ? "🟢" : "🔴"} **${item.name}**\n> 💵 \`${money(item.price)} VND\`${item.desc ? ` — *${item.desc}*` : ""}`;
    }).join("\n");

    return casinoEmbed({ color: COLORS.orange, title: `${meta.emoji} QUẦY ${meta.label} ${meta.emoji}` })
        .setDescription(`> *${meta.tagline}*\n> 💼 Ví của bạn: **\`${money(userMoney)} VND\`**\n${"─".repeat(25)}\n${list}`)
        .setFooter({ text: "🟢 đủ tiền • 🔴 thiếu tiền • Chọn món từ menu bên dưới!" });
}

module.exports = {
    data: new SlashCommandBuilder().setName("shop").setDescription("Mở cửa hàng vật phẩm Casino & Tháp"),

    async execute(interaction) {
        const shopper = await User.findOne({ userId: interaction.user.id });

        const mainEmbed = casinoEmbed({ color: COLORS.blue, title: "🏪 ✦ TRUNG TÂM THƯƠNG MẠI CASINO ✦ 🏪" })
            .setDescription(
                `Chào quý khách **${interaction.user.username}**! 🤵\n` +
                `> 💼 Ví của bạn: **\`${money(shopper?.money || 0)} VND\`**\n\nChọn quầy hàng muốn ghé thăm:`
            )
            .addFields(
                { name: "🎭 Danh Hiệu", value: "Thể hiện đẳng cấp", inline: true },
                { name: "🛡️ Bảo Vệ", value: "Chống trộm tài sản", inline: true },
                { name: "🧿 Bùa Chú", value: "Luck & Khiên hộ thân", inline: true },
                { name: "🗼 Shop Tháp", value: "Lượt đi & Buff DPS", inline: true }
            )
            .setFooter({ text: "🚪 Cửa hàng tự đóng sau 60 giây không tương tác" });

        const categoryRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("shop_titles").setLabel("Danh Hiệu").setStyle(ButtonStyle.Primary).setEmoji("🎭"),
            new ButtonBuilder().setCustomId("shop_guards").setLabel("Bảo Vệ").setStyle(ButtonStyle.Success).setEmoji("🛡️"),
            new ButtonBuilder().setCustomId("shop_charms").setLabel("Bùa Chú").setStyle(ButtonStyle.Secondary).setEmoji("🧿"),
            new ButtonBuilder().setCustomId("shop_tower").setLabel("Shop Tháp").setStyle(ButtonStyle.Danger).setEmoji("🗼")
        );

        await interaction.reply({ embeds: [mainEmbed], components: [categoryRow] });
        const response = await interaction.fetchReply();

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on("collect", async (i) => {
          try {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "❌ Menu này không dành cho bạn! Gõ /shop để mở cửa hàng riêng.", flags: 64 });

            // CHỌN DANH MỤC
            if (i.isButton()) {
                const categoryKey = i.customId.replace("shop_", "");
                const items = ITEMS[categoryKey];
                const u = await User.findOne({ userId: i.user.id });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("shop_buy_item")
                    .setPlaceholder("🛒 Bấm vào đây để chọn món đồ...")
                    .addOptions(items.map((item) => ({
                        label: item.name.slice(0, 100),
                        description: `Giá: ${money(item.price)} VND`,
                        value: item.id,
                    })));

                const menuRow = new ActionRowBuilder().addComponents(selectMenu);
                await i.update({ embeds: [renderCategory(categoryKey, u?.money || 0)], components: [menuRow, categoryRow] });
            }

            // MUA VẬT PHẨM (logic GIỮ NGUYÊN)
            if (i.isStringSelectMenu()) {
                const itemId = i.values[0];
                const allItems = [...ITEMS.titles, ...ITEMS.guards, ...ITEMS.charms, ...ITEMS.tower];
                const item = allItems.find((it) => it.id === itemId);

                let user = await User.findOne({ userId: i.user.id });

                if (user.money < item.price) {
                    return i.reply({ content: `❌ Bạn nghèo quá! Cần thêm **${money(item.price - user.money)} VND** để mua món này.`, flags: 64 });
                }

                let successMsg = "";

                if (item.type === "title") {
                    if (user.titles.owned.includes(item.name)) return i.reply({ content: "❌ Bạn đã có danh hiệu này rồi!", flags: 64 });
                    user.titles.owned.push(item.name);
                    user.titles.active = item.name;
                    successMsg = `🎭 Danh hiệu **${item.name}** đã được đeo lên hồ sơ!`;
                } else if (item.type === "guard") {
                    if (user.securityLevel >= item.level) return i.reply({ content: "❌ Bạn đã có cấp độ bảo vệ tương đương hoặc cao hơn!", flags: 64 });
                    user.securityLevel = item.level;
                    successMsg = `🛡️ Đội bảo vệ đã nâng cấp: **${item.name}** — bọn trộm khóc thét!`;
                } else if (item.type === "charm") {
                    if (!user.buffs) user.buffs = {};
                    if (item.boost) {
                        user.buffs.winRateBoost = item.boost;
                        successMsg = `🍀 **${item.name}** đã kích hoạt — ván tới thắng dễ hơn!`;
                    }
                    if (item.shield) {
                        user.buffs.shield = item.shield;
                        successMsg = `🔰 **${item.name}** đã kích hoạt — thua ván tới được giảm lỗ!`;
                    }
                } else if (item.type === "tower_attempt") {
                    user.towerAttempts = (user.towerAttempts || 0) + item.amount;
                    successMsg = `🎫 +**${item.amount} lượt leo tháp**! Tổng lượt: **${user.towerAttempts}**`;
                } else if (item.type === "tower_buff") {
                    if (!user.buffs) user.buffs = {};
                    user.buffs.towerDpsBoost = item.boost;
                    user.markModified("buffs");
                    successMsg = `🔥 **${item.name}** kích hoạt — /leothap ngay cho nóng!`;
                }

                user.money -= item.price;
                await user.save();

                await i.reply({
                    embeds: [casinoEmbed({ color: COLORS.green, title: "🧾 HÓA ĐƠN MUA HÀNG" })
                        .setDescription(
                            `${successMsg}\n${"─".repeat(25)}\n` +
                            `> 🛒 Món hàng: **${item.name}**\n` +
                            `> 💵 Thanh toán: \`-${money(item.price)} VND\`\n` +
                            `> 💼 Ví còn lại: ${vnd(user.money)}`
                        )
                        .setFooter({ text: "🏪 Cảm ơn quý khách, hẹn gặp lại! 🤝" })],
                    flags: 64,
                });
            }

            collector.resetTimer();
          } catch (err) {
            console.error("❌ [shop] Lỗi giao dịch:", err);
          }
        });

        // TỰ ĐÓNG SAU 60s
        collector.on("end", async (collected, reason) => {
            if (reason === "time") {
                try {
                    await interaction.editReply({
                        embeds: [casinoEmbed({ color: COLORS.dark, title: "🏪 CỬA HÀNG ĐÃ ĐÓNG CỬA", description: "> 🌙 Hết giờ làm việc! Gõ `/shop` để mở lại bất cứ lúc nào." })],
                        components: [],
                    });
                } catch (e) {}
            }
        });
    },
};