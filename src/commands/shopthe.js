const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../models/User");

// Bộ sưu tập thẻ gốc để Random
const BASE_CARDS = [
    { name: "Saber Khởi Nguyên", hp: 2000, atk: 150, spd: 80, def: 100, mdef: 80, atkSpd: 1.2, critRate: 15, critDmg: 150, price: 50000 },
    { name: "Cung Thủ Gió", hp: 1200, atk: 220, spd: 150, def: 60, mdef: 50, atkSpd: 1.8, critRate: 30, critDmg: 200, price: 60000 },
    { name: "Kẻ Thủ Phá", hp: 3500, atk: 90, spd: 50, def: 200, mdef: 150, atkSpd: 0.8, critRate: 5, critDmg: 120, price: 45000 },
    { name: "Pháp Sư Tinh Tú", hp: 1000, atk: 300, spd: 100, def: 40, mdef: 180, atkSpd: 1.0, critRate: 10, critDmg: 250, price: 70000 },
    { name: "Sát Thủ Bóng Đêm", hp: 1500, atk: 250, spd: 200, def: 50, mdef: 50, atkSpd: 2.0, critRate: 40, critDmg: 180, price: 80000 },
    { name: "Hiệp Sĩ Bàn Tròn", hp: 2500, atk: 120, spd: 90, def: 150, mdef: 120, atkSpd: 1.1, critRate: 20, critDmg: 140, price: 55000 },
    { name: "Đại Sư Võ Thuật", hp: 1800, atk: 180, spd: 130, def: 90, mdef: 90, atkSpd: 1.5, critRate: 25, critDmg: 160, price: 65000 }
];

// Biến lưu trạng thái Shop Global
let currentShop = [];
let shopExpireTime = 0;

function refreshShop() {
    currentShop = [];
    const shuffled = BASE_CARDS.sort(() => 0.5 - Math.random());
    for (let i = 0; i < 5; i++) currentShop.push(shuffled[i]);
    shopExpireTime = Date.now() + 3600000; // 1 giờ
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shopthe")
        .setDescription("🃏 Cửa hàng Thẻ Bài Gacha (Làm mới mỗi giờ)"),

    async execute(interaction) {
        if (Date.now() > shopExpireTime) refreshShop();

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("🏪 SHOP THẺ BÀI GACHA")
            .setDescription(`⏳ Shop sẽ làm mới sau: <t:${Math.floor(shopExpireTime / 1000)}:R>\n\n` + 
                currentShop.map((card, i) => `**${i + 1}. ${card.name}** - 💰 ${card.price.toLocaleString()} VND\n` +
                `*❤️ HP: ${card.hp} | ⚔️ ATK: ${card.atk} | 🛡️ DEF: ${card.def}*`).join("\n\n")
            );

        const row = new ActionRowBuilder();
        currentShop.forEach((card, i) => {
            row.addComponents(new ButtonBuilder().setCustomId(`shopthe_buy_${i}`).setLabel(`Mua Thẻ ${i + 1}`).setStyle(ButtonStyle.Primary));
        });

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        
        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return interaction.reply({ content: "❌ Không tìm thấy dữ liệu người dùng!", flags: 64 });

        // --- XỬ LÝ NÚT MUA THẺ ---
        if (action === "buy") {
            const shopIndex = parseInt(parts[2]);
            const cardToBuy = currentShop[shopIndex];

            if (user.money < cardToBuy.price) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });

            // Kiểm tra túi đồ đầy
            if (user.cards && user.cards.length >= 5) {
                const fullEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("🎒 TÚI ĐỒ ĐÃ ĐẦY (5/5)!")
                    .setDescription(`Bạn đang muốn mua **${cardToBuy.name}**.\nHãy chọn một thẻ cũ bên dưới để **VỨT BỎ**, hoặc hủy giao dịch.`);
                
                const replaceRow = new ActionRowBuilder();
                user.cards.forEach((c, i) => {
                    replaceRow.addComponents(new ButtonBuilder().setCustomId(`shopthe_replace_${shopIndex}_${i}`).setLabel(`Bỏ ${c.name}`).setStyle(ButtonStyle.Danger));
                });
                const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("shopthe_cancel").setLabel("Hủy Giao Dịch").setStyle(ButtonStyle.Secondary));

                return interaction.reply({ embeds: [fullEmbed], components: [replaceRow, cancelRow], flags: 64 });
            }

            // Nếu túi còn chỗ -> Mua luôn
            user.money -= cardToBuy.price;
            user.cards.push({ ...cardToBuy }); // Clone object
            await user.save();

            return interaction.reply({ content: `✅ Bạn đã mua thành công **${cardToBuy.name}**! Hãy dùng \`/tuido\` để xem.`, flags: 64 });
        }

        // --- XỬ LÝ NÚT THAY THẾ (KHI TÚI ĐẦY) ---
        if (action === "replace") {
            const shopIndex = parseInt(parts[2]);
            const userCardIndex = parseInt(parts[3]);
            const cardToBuy = currentShop[shopIndex];

            if (user.money < cardToBuy.price) return interaction.update({ content: "❌ Bạn không đủ tiền!", embeds: [], components: [] });

            const oldCardName = user.cards[userCardIndex].name;
            user.money -= cardToBuy.price;
            user.cards[userCardIndex] = { ...cardToBuy }; // Ghi đè thẻ mới
            await user.save();

            return interaction.update({ content: `✅ Bạn đã vứt bỏ **${oldCardName}** và thay bằng **${cardToBuy.name}**!`, embeds: [], components: [] });
        }

        // --- XỬ LÝ NÚT HỦY ---
        if (action === "cancel") {
            return interaction.update({ content: "✅ Đã hủy giao dịch.", embeds: [], components: [] });
        }
    }
};