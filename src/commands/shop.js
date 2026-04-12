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
        { id: "t_de_vuong", name: "Đế Vương", price: 1000000000, type: "title" },
        { id: "t_dan_choi", name: "Dân Chơi", price: 100000000, type: "title" },
        { id: "t_than_bai", name: "Thần Bài", price: 500000000, type: "title" }
    ],
    guards: [
        { id: "g_low", name: "Bảo Vệ Cấp Thấp", price: 50000, type: "guard", level: 1, desc: "Giảm 10% tỉ lệ bị trộm" },
        { id: "g_high", name: "Bảo Vệ Cấp Cao", price: 200000, type: "guard", level: 2, desc: "Giảm 25% tỉ lệ bị trộm" }
    ],
    charms: [
        { id: "c_luck", name: "Bùa May Mắn (+10%)", price: 50000000, type: "charm", boost: 0.10, desc: "Tăng 10% tỉ lệ thắng ván sau" },
        { id: "c_shield", name: "Bùa Hộ Thân", price: 100000000, type: "charm", shield: 0.5, desc: "Giảm 50% tiền mất khi thua" }
    ]
};

module.exports = {
    data: new SlashCommandBuilder().setName("shop").setDescription("Mở cửa hàng đa năng"),

    async execute(interaction) {
        // 1. Giao diện chính (Category Selection)
        const mainEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("🏪 HỆ THỐNG CỬA HÀNG CASINO")
            .setDescription("Chọn một danh mục để xem các mặt hàng đang bán:")
            .addFields(
                { name: "🎭 Danh Hiệu", value: "Dùng để hiển thị độ sang chảnh.", inline: true },
                { name: "🛡️ Bảo Vệ", value: "Chống lại quân trộm cắp.", inline: true },
                { name: "🧿 Bùa Chú", value: "Tăng tỉ lệ thắng cược.", inline: true }
            );

        const categoryRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("open_titles").setLabel("🎭 Shop Danh Hiệu").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("open_guards").setLabel("🛡️ Shop Bảo Vệ").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("open_charms").setLabel("🧿 Shop Bùa Chú").setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ embeds: [mainEmbed], components: [categoryRow] });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "Bạn không thể dùng menu này!", flags: 64 });

            // XỬ LÝ KHI NHẤN NÚT CHỌN DANH MỤC
            if (i.isButton()) {
                let categoryKey = i.customId.replace("open_", "");
                let items = ITEMS[categoryKey];

                const shopEmbed = new EmbedBuilder()
                    .setTitle(`🛒 CỬA HÀNG: ${categoryKey.toUpperCase()}`)
                    .setColor(0xFFA500)
                    .setDescription("Chọn vật phẩm từ menu bên dưới để mua:");

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId("buy_item")
                    .setPlaceholder("Chọn món đồ muốn mua...")
                    .addOptions(items.map(item => ({
                        label: item.name,
                        description: `Giá: ${item.price.toLocaleString()} VND`,
                        value: item.id
                    })));

                const menuRow = new ActionRowBuilder().addComponents(selectMenu);
                await i.update({ embeds: [shopEmbed], components: [menuRow, categoryRow] });
            }

            // XỬ LÝ KHI CHỌN VẬT PHẨM ĐỂ MUA
            if (i.isStringSelectMenu()) {
                const itemId = i.values[0];
                const allItems = [...ITEMS.titles, ...ITEMS.guards, ...ITEMS.charms];
                const item = allItems.find(it => it.id === itemId);

                let user = await User.findOne({ userId: i.user.id });

                // Kiểm tra tiền
                if (user.money < item.price) {
                    return i.reply({ content: `❌ Bạn không đủ tiền! Cần thêm **${(item.price - user.money).toLocaleString()} VND** nữa.`, flags: 64 });
                }

                // LOGIC CẤP VẬT PHẨM THEO LOẠI
                if (item.type === "title") {
                    if (user.titles.owned.includes(item.name)) return i.reply({ content: "Bạn đã sở hữu danh hiệu này rồi!", flags: 64 });
                    user.titles.owned.push(item.name);
                    user.titles.active = item.name; // Tự động đeo luôn
                } 
                else if (item.type === "guard") {
                    user.securityLevel = item.level; // Nâng cấp cấp độ bảo vệ
                }
                else if (item.type === "charm") {
                    if (item.boost) user.buffs.winRateBoost = item.boost;
                    // Bạn có thể thêm các loại buff khác ở đây
                }

                // Trừ tiền và lưu
                user.money -= item.price;
                await user.save();

                await i.reply({ 
                    content: `🎉 Chúc mừng! Bạn đã mua thành công **${item.name}** với giá **${item.price.toLocaleString()} VND**!`,
                    flags: 64 
                });
            }
        });
    }
};