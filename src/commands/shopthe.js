const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../models/User");

// Bộ sưu tập 50 thẻ gốc
const BASE_CARDS = [
    // --- HỆ CHIẾN BINH & TANKER ---
    { name: "Lục Đạo Tiên Nhân", hp: 5000, atk: 450, spd: 120, def: 300, mdef: 350, atkSpd: 1.2, critRate: 15, critDmg: 180, price: 2500000 },
    { name: "Vua Không Tặc", hp: 4200, atk: 380, spd: 110, def: 250, mdef: 200, atkSpd: 1.1, critRate: 20, critDmg: 200, price: 1800000 },
    { name: "Hỏa Long Natsu", hp: 2800, atk: 320, spd: 130, def: 150, mdef: 180, atkSpd: 1.4, critRate: 25, critDmg: 190, price: 1200000 },
    { name: "Zoro Tam Kiếm", hp: 3000, atk: 350, spd: 140, def: 180, mdef: 100, atkSpd: 1.5, critRate: 35, critDmg: 220, price: 1500000 },
    { name: "Guts Berserker", hp: 4500, atk: 400, spd: 90, def: 350, mdef: 150, atkSpd: 0.9, critRate: 10, critDmg: 250, price: 2000000 },
    { name: "All Might (Prime)", hp: 5500, atk: 500, spd: 150, def: 400, mdef: 300, atkSpd: 1.3, critRate: 20, critDmg: 180, price: 3000000 },
    { name: "Saber Excalibur", hp: 3200, atk: 340, spd: 130, def: 220, mdef: 250, atkSpd: 1.2, critRate: 15, critDmg: 210, price: 1400000 },
    { name: "Erza Giáp Thiên Luân", hp: 3500, atk: 310, spd: 120, def: 280, mdef: 220, atkSpd: 1.2, critRate: 18, critDmg: 170, price: 1300000 },
    { name: "Raiden Shogun", hp: 3100, atk: 420, spd: 160, def: 180, mdef: 200, atkSpd: 1.6, critRate: 30, critDmg: 240, price: 2200000 },
    { name: "Thạch Sư Alphonse", hp: 4800, atk: 250, spd: 80, def: 450, mdef: 350, atkSpd: 0.8, critRate: 5, critDmg: 150, price: 1100000 },
    { name: "Kenpachi Shinigami", hp: 6000, atk: 550, spd: 100, def: 100, mdef: 100, atkSpd: 1.0, critRate: 40, critDmg: 150, price: 2800000 },
    { name: "Escanor (The One)", hp: 5000, atk: 600, spd: 110, def: 300, mdef: 250, atkSpd: 1.1, critRate: 20, critDmg: 300, price: 3500000 },
    { name: "Whitebeard Râu Trắng", hp: 7000, atk: 480, spd: 70, def: 320, mdef: 280, atkSpd: 0.7, critRate: 15, critDmg: 220, price: 2600000 },
    { name: "Goku Bản Năng Vô Cực", hp: 4000, atk: 520, spd: 250, def: 200, mdef: 300, atkSpd: 2.5, critRate: 25, critDmg: 210, price: 4000000 },
    { name: "Broly Cuồng Nộ", hp: 8000, atk: 450, spd: 130, def: 250, mdef: 150, atkSpd: 1.1, critRate: 10, critDmg: 190, price: 2900000 },
    // --- HỆ SÁT THỦ & XẠ THỦ ---
    { name: "Kirito Hắc Kiếm Sĩ", hp: 1800, atk: 330, spd: 220, def: 90, mdef: 110, atkSpd: 2.2, critRate: 45, critDmg: 210, price: 1600000 },
    { name: "Killua Thần Tốc", hp: 1600, atk: 310, spd: 300, def: 70, mdef: 80, atkSpd: 2.8, critRate: 35, critDmg: 190, price: 1550000 },
    { name: "Levi Ackerman", hp: 1400, atk: 400, spd: 280, def: 60, mdef: 50, atkSpd: 3.0, critRate: 50, critDmg: 250, price: 2100000 },
    { name: "Itachi Uchiha", hp: 1700, atk: 380, spd: 190, def: 100, mdef: 300, atkSpd: 1.5, critRate: 30, critDmg: 230, price: 1950000 },
    { name: "Zenitsu Thần Tốc", hp: 1500, atk: 450, spd: 350, def: 50, mdef: 50, atkSpd: 3.5, critRate: 60, critDmg: 300, price: 2300000 },
    { name: "Sinbad Thất Hải", hp: 2200, atk: 350, spd: 180, def: 150, mdef: 250, atkSpd: 1.4, critRate: 25, critDmg: 200, price: 1800000 },
    { name: "Tatsumaki Bão Vũ Trụ", hp: 1200, atk: 550, spd: 210, def: 40, mdef: 400, atkSpd: 1.2, critRate: 20, critDmg: 280, price: 2700000 },
    { name: "Archer (EMIYA)", hp: 2000, atk: 320, spd: 160, def: 120, mdef: 150, atkSpd: 1.8, critRate: 30, critDmg: 240, price: 1450000 },
    { name: "Akame Thôn Phệ", hp: 1500, atk: 390, spd: 240, def: 70, mdef: 90, atkSpd: 2.4, critRate: 40, critDmg: 260, price: 1750000 },
    { name: "Minato Tia Chớp Vàng", hp: 1800, atk: 300, spd: 400, def: 80, mdef: 120, atkSpd: 3.2, critRate: 35, critDmg: 180, price: 2400000 },
    { name: "Dio Brando (The World)", hp: 2500, atk: 350, spd: 260, def: 150, mdef: 150, atkSpd: 2.0, critRate: 25, critDmg: 220, price: 1900000 },
    { name: "Saitama (Casual)", hp: 9999, atk: 999, spd: 500, def: 999, mdef: 999, atkSpd: 5.0, critRate: 1, critDmg: 100, price: 1000000 },
    { name: "Yato Lang Thang", hp: 1900, atk: 320, spd: 210, def: 110, mdef: 130, atkSpd: 1.9, critRate: 28, critDmg: 190, price: 1150000 },
    { name: "Tanjiro Hơi Thở Mặt Trời", hp: 2200, atk: 340, spd: 160, def: 130, mdef: 140, atkSpd: 1.5, critRate: 22, critDmg: 200, price: 1350000 },
    { name: "Inuyasha Bán Yêu", hp: 2600, atk: 310, spd: 140, def: 160, mdef: 120, atkSpd: 1.3, critRate: 20, critDmg: 180, price: 1050000 },
    // --- HỆ PHÁP SƯ & THẦN THÁNH ---
    { name: "Ainz Ooal Gown", hp: 3500, atk: 500, spd: 100, def: 250, mdef: 600, atkSpd: 1.0, critRate: 15, critDmg: 250, price: 3200000 },
    { name: "Rimuru Ma Vương", hp: 4500, atk: 480, spd: 200, def: 300, mdef: 500, atkSpd: 1.6, critRate: 25, critDmg: 220, price: 3800000 },
    { name: "Madara Lục Đạo", hp: 5000, atk: 520, spd: 180, def: 300, mdef: 400, atkSpd: 1.4, critRate: 35, critDmg: 260, price: 4200000 },
    { name: "Gilgamesh Phế Tích", hp: 2500, atk: 550, spd: 150, def: 150, mdef: 300, atkSpd: 1.2, critRate: 30, critDmg: 300, price: 3500000 },
    { name: "Gojo Satoru", hp: 3000, atk: 500, spd: 250, def: 500, mdef: 500, atkSpd: 2.0, critRate: 40, critDmg: 250, price: 5000000 },
    { name: "Megumin (Explosion!)", hp: 800, atk: 999, spd: 50, def: 10, mdef: 10, atkSpd: 0.1, critRate: 100, critDmg: 500, price: 2000000 },
    { name: "Rizuku Thần Chết", hp: 2100, atk: 340, spd: 160, def: 120, mdef: 180, atkSpd: 1.4, critRate: 25, critDmg: 210, price: 1300000 },
    { name: "Julius Ma Pháp Vương", hp: 2800, atk: 420, spd: 300, def: 150, mdef: 350, atkSpd: 2.2, critRate: 20, critDmg: 220, price: 2900000 },
    { name: "Muzan Chúa Quỷ", hp: 5500, atk: 410, spd: 190, def: 280, mdef: 320, atkSpd: 1.8, critRate: 15, critDmg: 180, price: 2650000 },
    { name: "Meliodas Ma Thần", hp: 4000, atk: 480, spd: 170, def: 220, mdef: 300, atkSpd: 1.5, critRate: 30, critDmg: 240, price: 3100000 },
    { name: "Alucard Ma Cà Rồng", hp: 6500, atk: 390, spd: 150, def: 200, mdef: 400, atkSpd: 1.4, critRate: 25, critDmg: 200, price: 2750000 },
    { name: "Esdeath Băng Đế", hp: 3200, atk: 430, spd: 160, def: 210, mdef: 250, atkSpd: 1.5, critRate: 28, critDmg: 230, price: 2450000 },
    { name: "Luffy Gear 5", hp: 4800, atk: 460, spd: 220, def: 350, mdef: 350, atkSpd: 1.9, critRate: 35, critDmg: 250, price: 4500000 },
    { name: "Sukuna Nguyền Vương", hp: 4200, atk: 540, spd: 200, def: 280, mdef: 300, atkSpd: 1.7, critRate: 30, critDmg: 280, price: 4300000 },
    { name: "Sesshomaru Đại Yêu", hp: 3800, atk: 400, spd: 180, def: 250, mdef: 280, atkSpd: 1.6, critRate: 25, critDmg: 220, price: 2250000 },
    { name: "Natsu Hỏa Long Vương", hp: 3400, atk: 450, spd: 150, def: 200, mdef: 220, atkSpd: 1.4, critRate: 22, critDmg: 240, price: 2100000 },
    { name: "Ichigo Mugetsu", hp: 3000, atk: 600, spd: 300, def: 150, mdef: 200, atkSpd: 2.0, critRate: 40, critDmg: 300, price: 4800000 },
    { name: "Jiraiya Tiên Nhân", hp: 3200, atk: 330, spd: 140, def: 200, mdef: 260, atkSpd: 1.2, critRate: 20, critDmg: 180, price: 1400000 },
    { name: "Todoroki Nghịch Nghịch", hp: 2400, atk: 380, spd: 130, def: 150, mdef: 280, atkSpd: 1.1, critRate: 15, critDmg: 220, price: 1350000 },
    { name: "Sung Jin Woo (Shadow)", hp: 5000, atk: 580, spd: 350, def: 300, mdef: 300, atkSpd: 3.0, critRate: 45, critDmg: 280, price: 6000000 }
];

let currentShop = [];
let shopExpireTime = 0;

function refreshShop() {
    currentShop = [];
    const shuffled = [...BASE_CARDS].sort(() => 0.5 - Math.random());
    for (let i = 0; i < 5; i++) currentShop.push(shuffled[i]);
    shopExpireTime = Date.now() + 3600000;
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
            )
            .setFooter({ text: "Tin nhắn tự hủy sau 60s nếu không tương tác" });

        const row = new ActionRowBuilder();
        currentShop.forEach((card, i) => {
            row.addComponents(new ButtonBuilder().setCustomId(`shopthe_buy_${i}`).setLabel(`Mua Thẻ ${i + 1}`).setStyle(ButtonStyle.Primary));
        });

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Tự động xóa sau 60s nếu không ai nhấn
        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.deleteReply().catch(() => {});
            } else {
                // Vô hiệu hóa nút sau khi hết hạn để tránh spam shop cũ
                const disabledRow = new ActionRowBuilder();
                row.components.forEach(btn => disabledRow.addComponents(ButtonBuilder.from(btn).setDisabled(true)));
                interaction.editReply({ components: [disabledRow] }).catch(() => {});
            }
        });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user) return interaction.reply({ content: "❌ Không tìm thấy dữ liệu!", flags: 64 });

        if (action === "buy") {
            const shopIndex = parseInt(parts[2]);
            const cardToBuy = currentShop[shopIndex];
            if (user.money < cardToBuy.price) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });

            if (user.cards && user.cards.length >= 5) {
                const fullEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("🎒 TÚI ĐỒ ĐÃ ĐẦY (5/5)!")
                    .setDescription(`Bạn muốn mua **${cardToBuy.name}**.\nChọn 1 thẻ để vứt bỏ:`);
                
                const replaceRow = new ActionRowBuilder();
                user.cards.forEach((c, i) => {
                    replaceRow.addComponents(new ButtonBuilder().setCustomId(`shopthe_replace_${shopIndex}_${i}`).setLabel(`Bỏ ${c.name}`).setStyle(ButtonStyle.Danger));
                });
                const cancelRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("shopthe_cancel").setLabel("Hủy").setStyle(ButtonStyle.Secondary));

                return interaction.reply({ embeds: [fullEmbed], components: [replaceRow, cancelRow], flags: 64 });
            }

            user.money -= cardToBuy.price;
            user.cards.push({ ...cardToBuy });
            await user.save();
            return interaction.reply({ content: `✅ Đã mua **${cardToBuy.name}**!`, flags: 64 });
        }

        if (action === "replace") {
            const shopIndex = parseInt(parts[2]);
            const userCardIndex = parseInt(parts[3]);
            const cardToBuy = currentShop[shopIndex];

            if (user.money < cardToBuy.price) return interaction.update({ content: "❌ Hết tiền rồi!", embeds: [], components: [] });

            const oldName = user.cards[userCardIndex].name;
            user.money -= cardToBuy.price;
            user.cards[userCardIndex] = { ...cardToBuy };
            user.markModified('cards');
            await user.save();

            return interaction.update({ content: `✅ Đã thay **${oldName}** bằng **${cardToBuy.name}**!`, embeds: [], components: [] });
        }

        if (action === "cancel") return interaction.update({ content: "✅ Đã hủy.", embeds: [], components: [] });
    }
};