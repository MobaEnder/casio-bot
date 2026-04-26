const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require("discord.js");
const User = require("../models/User");

// Định nghĩa dữ liệu vật phẩm chi tiết
const ITEMS = {
    titles: [
        { id: "t_tap_su", name: "🎰 Con Nghiện Tập Sự", price: 10000000, type: "title" },
        { id: "t_dan_choi", name: "🕶️ Dân Chơi Hệ Tiền", price: 100000000, type: "title" },
        { id: "t_than_bai", name: "🃏 Thần Bài Tái Thế", price: 500000000, type: "title" },
        { id: "t_de_vuong", name: "👑 Đế Vương Casino", price: 1000000000, type: "title" },
        { id: "t_huyen_thoai", name: "🌌 Huyền Thoại Bất Tử", price: 3000000000, type: "title" }
    ],
    guards: [
        { id: "g_low", name: "🛡️ Bảo Vệ Cấp Thấp", price: 1000000, type: "guard", level: 1, desc: "Giảm 10% tỉ lệ bị trộm" },
        { id: "g_mid", name: "🛡️ Bảo Vệ Cấp Trung", price: 50000000, type: "guard", level: 2, desc: "Giảm 25% tỉ lệ bị trộm" },
        { id: "g_high", name: "🛡️ Bảo Vệ Cấp Cao", price: 100000000, type: "guard", level: 3, desc: "Giảm 50% tỉ lệ bị trộm" }
    ],
    charms: [
        // Bùa May Mắn (Luck)
        { id: "c_luck_s", name: "🍀 Bùa Luck Nhỏ (+5%)", price: 10000000, type: "charm", boost: 0.05, desc: "Tăng 5% tỉ lệ thắng ván sau" },
        { id: "c_luck_m", name: "🍀 Bùa Luck Vừa (+15%)", price: 50000000, type: "charm", boost: 0.15, desc: "Tăng 15% tỉ lệ thắng ván sau" },
        { id: "c_luck_l", name: "🍀 Bùa Luck To (+30%)", price: 200000000, type: "charm", boost: 0.30, desc: "Tăng 30% tỉ lệ thắng ván sau" },
        // Bùa Hộ Thân (Shield)
        { id: "c_shield_s", name: "🔰 Khiên Nhỏ (Giảm 20%)", price: 15000000, type: "charm", shield: 0.2, desc: "Giảm 20% tiền mất khi thua" },
        { id: "c_shield_m", name: "🔰 Khiên Vừa (Giảm 50%)", price: 100000000, type: "charm", shield: 0.5, desc: "Giảm 50% tiền mất khi thua" },
        { id: "c_shield_l", name: "🔰 Khiên To (Giảm 80%)", price: 400000000, type: "charm", shield: 0.8, desc: "Giảm 80% tiền mất khi thua" }
    ],
    tower: [
        // Lượt đi tháp
        { id: "tw_att_5", name: "🎫 5 Lượt Đi Tháp", price: 1000000, type: "tower_attempt", amount: 5, desc: "Cộng thêm 5 lượt leo tháp" },
        { id: "tw_att_10", name: "🎫 10 Lượt Đi Tháp", price: 2000000, type: "tower_attempt", amount: 10, desc: "Cộng thêm 10 lượt leo tháp" },
        { id: "tw_att_20", name: "🎫 20 Lượt Đi Tháp", price: 4000000, type: "tower_attempt", amount: 20, desc: "Cộng thêm 20 lượt leo tháp" },
        { id: "tw_att_30", name: "🎫 30 Lượt Đi Tháp", price: 6000000, type: "tower_attempt", amount: 30, desc: "Cộng thêm 30 lượt leo tháp" },
        // Buff lực chiến (DPS)
        { id: "tw_buff_10", name: "🔥 Thẻ Buff Tháp (+10%)", price: 1000000, type: "tower_buff", boost: 0.10, desc: "Tăng 10% Lực chiến khi leo tháp" },
        { id: "tw_buff_20", name: "🔥 Thẻ Buff Tháp (+20%)", price: 10000000, type: "tower_buff", boost: 0.20, desc: "Tăng 20% Lực chiến khi leo tháp" },
        { id: "tw_buff_35", name: "🔥 Thẻ Buff Tháp (+35%)", price: 40000000, type: "tower_buff", boost: 0.35, desc: "Tăng 35% Lực chiến khi leo tháp" }
    ]
};

module.exports = {
    data: new SlashCommandBuilder().setName("shop").setDescription("Mở cửa hàng vật phẩm Casino & Tháp"),

    async execute(interaction) {
        // 1. Giao diện chính
        const mainEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("🏪 HỆ THỐNG CỬA HÀNG CASINO")
            .setDescription("Chào mừng bạn! Hãy chọn danh mục vật phẩm muốn xem:")
            .addFields(
                { name: "🎭 Danh Hiệu", value: "Thể hiện đẳng cấp của bạn.", inline: true },
                { name: "🛡️ Bảo Vệ", value: "Chống trộm cắp tài sản.", inline: true },
                { name: "🧿 Bùa Chú", value: "Tăng may mắn & giảm rủi ro.", inline: true },
                { name: "🗼 Shop Tháp", value: "Lượt đi & Buff lực chiến.", inline: true }
            )
            .setFooter({ text: "Hệ thống sẽ tự đóng sau 60 giây không tương tác." });

        const categoryRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("shop_titles").setLabel("Shop Danh Hiệu").setStyle(ButtonStyle.Primary).setEmoji("🎭"),
            new ButtonBuilder().setCustomId("shop_guards").setLabel("Shop Bảo Vệ").setStyle(ButtonStyle.Success).setEmoji("🛡️"),
            new ButtonBuilder().setCustomId("shop_charms").setLabel("Shop Bùa Chú").setStyle(ButtonStyle.Secondary).setEmoji("🧿"),
            new ButtonBuilder().setCustomId("shop_tower").setLabel("Shop Tháp").setStyle(ButtonStyle.Danger).setEmoji("🗼")
        );

        const response = await interaction.reply({ 
            embeds: [mainEmbed], 
            components: [categoryRow],
            fetchReply: true 
        });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "Menu này không dành cho bạn!", flags: 64 });

            // XỬ LÝ CHỌN DANH MỤC (Nút bấm)
            if (i.isButton()) {
                let categoryKey = i.customId.replace("shop_", "");
                let items = ITEMS[categoryKey];

                const shopEmbed = new EmbedBuilder()
                    .setTitle(`🛒 CỬA HÀNG: ${categoryKey.toUpperCase()}`)
                    .setColor(0xFFA500)
                    .setDescription("Chọn vật phẩm từ danh sách phía dưới:");

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("shop_buy_item")
                    .setPlaceholder("Bấm vào đây để chọn món đồ...")
                    .addOptions(items.map(item => ({
                        label: item.name,
                        description: `Giá: ${item.price.toLocaleString()} VND - ${item.desc || 'Vật phẩm trang trí'}`,
                        value: item.id
                    })));

                const menuRow = new ActionRowBuilder().addComponents(selectMenu);
                await i.update({ embeds: [shopEmbed], components: [menuRow, categoryRow] });
            }

            // XỬ LÝ MUA VẬT PHẨM (Select Menu)
            if (i.isStringSelectMenu()) {
                const itemId = i.values[0];
                const allItems = [...ITEMS.titles, ...ITEMS.guards, ...ITEMS.charms, ...ITEMS.tower];
                const item = allItems.find(it => it.id === itemId);

                let user = await User.findOne({ userId: i.user.id });

                if (user.money < item.price) {
                    return i.reply({ content: `❌ Bạn nghèo quá! Cần thêm **${(item.price - user.money).toLocaleString()} VND** để mua món này.`, flags: 64 });
                }

                let successMsg = "";

                if (item.type === "title") {
                    if (user.titles.owned.includes(item.name)) return i.reply({ content: "Bạn đã có danh hiệu này rồi!", flags: 64 });
                    user.titles.owned.push(item.name);
                    user.titles.active = item.name;
                    successMsg = `Bạn đã sở hữu danh hiệu **${item.name}**!`;
                } 
                else if (item.type === "guard") {
                    if (user.securityLevel >= item.level) return i.reply({ content: "Bạn đã có cấp độ bảo vệ tương đương hoặc cao hơn!", flags: 64 });
                    user.securityLevel = item.level;
                    successMsg = `Hệ thống bảo vệ đã được nâng cấp lên: **${item.name}**!`;
                }
                else if (item.type === "charm") {
                    if (!user.buffs) user.buffs = {}; // Đảm bảo object buffs tồn tại
                    if (item.boost) {
                        user.buffs.winRateBoost = item.boost;
                        successMsg = `Đã kích hoạt **${item.name}**. Tỉ lệ thắng ván tới sẽ tăng thêm!`;
                    }
                    if (item.shield) {
                        user.buffs.shield = item.shield;
                        successMsg = `Đã kích hoạt **${item.name}**. Nếu thua ván tới sẽ được giảm lỗ!`;
                    }
                }
                else if (item.type === "tower_attempt") {
                    user.towerAttempts = (user.towerAttempts || 0) + item.amount;
                    successMsg = `Bạn vừa mua thành công **${item.amount} lượt leo tháp**. Tổng lượt hiện tại: **${user.towerAttempts}**!`;
                }
                else if (item.type === "tower_buff") {
                    if (!user.buffs) user.buffs = {};
                    // Nếu đã có buff cũ, ghi đè bằng buff mới mua
                    user.buffs.towerDpsBoost = item.boost;
                    user.markModified('buffs');
                    successMsg = `Đã kích hoạt **${item.name}**. Lực chiến thẻ bài sẽ được buff khi bạn dùng lệnh /leothap!`;
                }

                user.money -= item.price;
                await user.save();

                await i.reply({ 
                    content: `🎉 **GIAO DỊCH THÀNH CÔNG!**\n${successMsg}\n💰 Còn lại: **${user.money.toLocaleString()} VND**`,
                    flags: 64 
                });
            }
            
            // Reset thời gian chờ mỗi khi có tương tác
            collector.resetTimer();
        });

        // TỰ ĐỘNG DỌN DẸP KHI HẾT HẠN (60s)
        collector.on("end", async (collected, reason) => {
            if (reason === "time") {
                try {
                    const closedEmbed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                        .setTitle("🏪 CỬA HÀNG ĐÃ ĐÓNG")
                        .setDescription("Phiên làm việc đã hết hạn. Hãy dùng lại lệnh `/shop` nếu muốn tiếp tục mua sắm.");

                    await interaction.editReply({ embeds: [closedEmbed], components: [] });
                } catch (e) {
                    // Tránh lỗi nếu tin nhắn gốc đã bị xóa
                }
            }
        });
    }
};