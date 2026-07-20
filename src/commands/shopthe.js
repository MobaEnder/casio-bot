const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed } = require("../utils/ui");

// Bộ sưu tập 50 thẻ gốc
const BASE_CARDS = [
    // --- HỆ CHIẾN BINH & TANKER ---
    { name: "Lục Đạo Tiên Nhân", hp: 5000, atk: 450, spd: 120, def: 300, mdef: 350, atkSpd: 1.2, critRate: 15, critDmg: 180, price: 250000 },
    { name: "Vua Không Tặc", hp: 4200, atk: 380, spd: 110, def: 250, mdef: 200, atkSpd: 1.1, critRate: 20, critDmg: 200, price: 180000 },
    { name: "Hỏa Long Natsu", hp: 2800, atk: 320, spd: 130, def: 150, mdef: 180, atkSpd: 1.4, critRate: 25, critDmg: 190, price: 120000 },
    { name: "Zoro Tam Kiếm", hp: 3000, atk: 350, spd: 140, def: 180, mdef: 100, atkSpd: 1.5, critRate: 35, critDmg: 220, price: 150000 },
    { name: "Guts Berserker", hp: 4500, atk: 400, spd: 90, def: 350, mdef: 150, atkSpd: 0.9, critRate: 10, critDmg: 250, price: 200000 },
    { name: "All Might (Prime)", hp: 5500, atk: 500, spd: 150, def: 400, mdef: 300, atkSpd: 1.3, critRate: 20, critDmg: 180, price: 300000 },
    { name: "Saber Excalibur", hp: 3200, atk: 340, spd: 130, def: 220, mdef: 250, atkSpd: 1.2, critRate: 15, critDmg: 210, price: 140000 },
    { name: "Erza Giáp Thiên Luân", hp: 3500, atk: 310, spd: 120, def: 280, mdef: 220, atkSpd: 1.2, critRate: 18, critDmg: 170, price: 130000 },
    { name: "Raiden Shogun", hp: 3100, atk: 420, spd: 160, def: 180, mdef: 200, atkSpd: 1.6, critRate: 30, critDmg: 240, price: 220000 },
    { name: "Thạch Sư Alphonse", hp: 4800, atk: 250, spd: 80, def: 450, mdef: 350, atkSpd: 0.8, critRate: 5, critDmg: 150, price: 110000 },
    { name: "Kenpachi Shinigami", hp: 6000, atk: 550, spd: 100, def: 100, mdef: 100, atkSpd: 1.0, critRate: 40, critDmg: 150, price: 280000 },
    { name: "Escanor (The One)", hp: 5000, atk: 600, spd: 110, def: 300, mdef: 250, atkSpd: 1.1, critRate: 20, critDmg: 300, price: 350000 },
    { name: "Whitebeard Râu Trắng", hp: 7000, atk: 480, spd: 70, def: 320, mdef: 280, atkSpd: 0.7, critRate: 15, critDmg: 220, price: 260000 },
    { name: "Goku Bản Năng Vô Cực", hp: 4000, atk: 520, spd: 250, def: 200, mdef: 300, atkSpd: 2.5, critRate: 25, critDmg: 210, price: 400000 },
    { name: "Broly Cuồng Nộ", hp: 8000, atk: 450, spd: 130, def: 250, mdef: 150, atkSpd: 1.1, critRate: 10, critDmg: 190, price: 290000 },
    // --- HỆ SÁT THỦ & XẠ THỦ ---
    { name: "Kirito Hắc Kiếm Sĩ", hp: 1800, atk: 330, spd: 220, def: 90, mdef: 110, atkSpd: 2.2, critRate: 45, critDmg: 210, price: 160000 },
    { name: "Killua Thần Tốc", hp: 1600, atk: 310, spd: 300, def: 70, mdef: 80, atkSpd: 2.8, critRate: 35, critDmg: 190, price: 155000 },
    { name: "Levi Ackerman", hp: 1400, atk: 400, spd: 280, def: 60, mdef: 50, atkSpd: 3.0, critRate: 50, critDmg: 250, price: 210000 },
    { name: "Itachi Uchiha", hp: 1700, atk: 380, spd: 190, def: 100, mdef: 300, atkSpd: 1.5, critRate: 30, critDmg: 230, price: 195000 },
    { name: "Zenitsu Thần Tốc", hp: 1500, atk: 450, spd: 350, def: 50, mdef: 50, atkSpd: 3.5, critRate: 60, critDmg: 300, price: 230000 },
    { name: "Sinbad Thất Hải", hp: 2200, atk: 350, spd: 180, def: 150, mdef: 250, atkSpd: 1.4, critRate: 25, critDmg: 200, price: 180000 },
    { name: "Tatsumaki Bão Vũ Trụ", hp: 1200, atk: 550, spd: 210, def: 40, mdef: 400, atkSpd: 1.2, critRate: 20, critDmg: 280, price: 270000 },
    { name: "Archer (EMIYA)", hp: 2000, atk: 320, spd: 160, def: 120, mdef: 150, atkSpd: 1.8, critRate: 30, critDmg: 240, price: 145000 },
    { name: "Akame Thôn Phệ", hp: 1500, atk: 390, spd: 240, def: 70, mdef: 90, atkSpd: 2.4, critRate: 40, critDmg: 260, price: 175000 },
    { name: "Minato Tia Chớp Vàng", hp: 1800, atk: 300, spd: 400, def: 80, mdef: 120, atkSpd: 3.2, critRate: 35, critDmg: 180, price: 240000 },
    { name: "Dio Brando (The World)", hp: 2500, atk: 350, spd: 260, def: 150, mdef: 150, atkSpd: 2.0, critRate: 25, critDmg: 220, price: 190000 },
    { name: "Saitama (Casual)", hp: 9999, atk: 999, spd: 500, def: 999, mdef: 999, atkSpd: 5.0, critRate: 1, critDmg: 100, price: 100000 },
    { name: "Yato Lang Thang", hp: 1900, atk: 320, spd: 210, def: 110, mdef: 130, atkSpd: 1.9, critRate: 28, critDmg: 190, price: 115000 },
    { name: "Tanjiro Hơi Thở Mặt Trời", hp: 2200, atk: 340, spd: 160, def: 130, mdef: 140, atkSpd: 1.5, critRate: 22, critDmg: 200, price: 135000 },
    { name: "Inuyasha Bán Yêu", hp: 2600, atk: 310, spd: 140, def: 160, mdef: 120, atkSpd: 1.3, critRate: 20, critDmg: 180, price: 105000 },
    // --- HỆ PHÁP SƯ & THẦN THÁNH ---
    { name: "Ainz Ooal Gown", hp: 3500, atk: 500, spd: 100, def: 250, mdef: 600, atkSpd: 1.0, critRate: 15, critDmg: 250, price: 320000 },
    { name: "Rimuru Ma Vương", hp: 4500, atk: 480, spd: 200, def: 300, mdef: 500, atkSpd: 1.6, critRate: 25, critDmg: 220, price: 380000 },
    { name: "Madara Lục Đạo", hp: 5000, atk: 520, spd: 180, def: 300, mdef: 400, atkSpd: 1.4, critRate: 35, critDmg: 260, price: 420000 },
    { name: "Gilgamesh Phế Tích", hp: 2500, atk: 550, spd: 150, def: 150, mdef: 300, atkSpd: 1.2, critRate: 30, critDmg: 300, price: 350000 },
    { name: "Gojo Satoru", hp: 3000, atk: 500, spd: 250, def: 500, mdef: 500, atkSpd: 2.0, critRate: 40, critDmg: 250, price: 500000 },
    { name: "Megumin (Explosion!)", hp: 800, atk: 999, spd: 50, def: 10, mdef: 10, atkSpd: 0.1, critRate: 100, critDmg: 500, price: 200000 },
    { name: "Rizuku Thần Chết", hp: 2100, atk: 340, spd: 160, def: 120, mdef: 180, atkSpd: 1.4, critRate: 25, critDmg: 210, price: 130000 },
    { name: "Julius Ma Pháp Vương", hp: 2800, atk: 420, spd: 300, def: 150, mdef: 350, atkSpd: 2.2, critRate: 20, critDmg: 220, price: 290000 },
    { name: "Muzan Chúa Quỷ", hp: 5500, atk: 410, spd: 190, def: 280, mdef: 320, atkSpd: 1.8, critRate: 15, critDmg: 180, price: 265000 },
    { name: "Meliodas Ma Thần", hp: 4000, atk: 480, spd: 170, def: 220, mdef: 300, atkSpd: 1.5, critRate: 30, critDmg: 240, price: 310000 },
    { name: "Alucard Ma Cà Rồng", hp: 6500, atk: 390, spd: 150, def: 200, mdef: 400, atkSpd: 1.4, critRate: 25, critDmg: 200, price: 275000 },
    { name: "Esdeath Băng Đế", hp: 3200, atk: 430, spd: 160, def: 210, mdef: 250, atkSpd: 1.5, critRate: 28, critDmg: 230, price: 245000 },
    { name: "Luffy Gear 5", hp: 4800, atk: 460, spd: 220, def: 350, mdef: 350, atkSpd: 1.9, critRate: 35, critDmg: 250, price: 450000 },
    { name: "Sukuna Nguyền Vương", hp: 4200, atk: 540, spd: 200, def: 280, mdef: 300, atkSpd: 1.7, critRate: 30, critDmg: 280, price: 430000 },
    { name: "Sesshomaru Đại Yêu", hp: 3800, atk: 400, spd: 180, def: 250, mdef: 280, atkSpd: 1.6, critRate: 25, critDmg: 220, price: 225000 },
    { name: "Natsu Hỏa Long Vương", hp: 3400, atk: 450, spd: 150, def: 200, mdef: 220, atkSpd: 1.4, critRate: 22, critDmg: 240, price: 210000 },
    { name: "Ichigo Mugetsu", hp: 3000, atk: 600, spd: 300, def: 150, mdef: 200, atkSpd: 2.0, critRate: 40, critDmg: 300, price: 480000 },
    { name: "Jiraiya Tiên Nhân", hp: 3200, atk: 330, spd: 140, def: 200, mdef: 260, atkSpd: 1.2, critRate: 20, critDmg: 180, price: 140000 },
    { name: "Todoroki Nghịch Nghịch", hp: 2400, atk: 380, spd: 130, def: 150, mdef: 280, atkSpd: 1.1, critRate: 15, critDmg: 220, price: 135000 },
    { name: "Sung Jin Woo (Shadow)", hp: 5000, atk: 580, spd: 350, def: 300, mdef: 300, atkSpd: 3.0, critRate: 45, critDmg: 280, price: 600000 }
];

let currentShop = [];
let shopExpireTime = 0;

function refreshShop() {
    currentShop = [];
    const shuffled = [...BASE_CARDS].sort(() => 0.5 - Math.random());
    for (let i = 0; i < 5; i++) currentShop.push(shuffled[i]);
    shopExpireTime = Date.now() + 3600000;
}

// Độ hiếm theo giá thẻ
function rarity(price) {
    if (price >= 450000) return { tag: "🌈 SSR", stars: "⭐⭐⭐⭐⭐" };
    if (price >= 300000) return { tag: "🟣 SR", stars: "⭐⭐⭐⭐" };
    if (price >= 200000) return { tag: "🔵 R", stars: "⭐⭐⭐" };
    if (price >= 130000) return { tag: "🟢 UC", stars: "⭐⭐" };
    return { tag: "⚪ C", stars: "⭐" };
}

// Ước tính DPS gốc của thẻ (cùng công thức /tuido, level 1)
function previewDPS(card) {
    const base = card.hp * 0.1 + card.atk * 2 + card.def * 1.5 + card.mdef * 1.5 + card.spd * 5;
    const offensive = card.atkSpd * 100 * (1 + (card.critRate / 100) * (card.critDmg / 100));
    return Math.floor(base + offensive);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shopthe")
        .setDescription("🃏 Cửa hàng Thẻ Bài Gacha (Làm mới mỗi giờ)"),

    async execute(interaction) {
        if (Date.now() > shopExpireTime) refreshShop();

        const user = await User.findOne({ userId: interaction.user.id });
        const wallet = user?.money || 0;

        const list = currentShop.map((card, i) => {
            const r = rarity(card.price);
            const affordable = wallet >= card.price;
            return (
                `${affordable ? "🟢" : "🔴"} **${i + 1}. ${card.name}** ${r.tag} ${r.stars}\n` +
                `> 💰 \`${money(card.price)} VND\` • 🔥 DPS gốc: \`${money(previewDPS(card))}\`\n` +
                `> ❤️ ${card.hp} | ⚔️ ${card.atk} | 🛡️ ${card.def} | 👟 ${card.spd} | 🎯 ${card.critRate}%`
            );
        }).join("\n\n");

        const embed = casinoEmbed({ color: COLORS.purple, title: "🏪 ✦ TIỆM THẺ BÀI GACHA ✦ 🃏" })
            .setDescription(
                `> 💼 Ví của bạn: **\`${money(wallet)} VND\`** • 🎒 Túi tối đa **5 thẻ**\n` +
                `> 🔄 Shop làm mới ${countdown(shopExpireTime)}\n${"─".repeat(25)}\n${list}`
            )
            .setFooter({ text: "🟢 đủ tiền • 🔴 thiếu tiền • Tin nhắn tự hủy sau 60s nếu không tương tác" });

        const row = new ActionRowBuilder();
        currentShop.forEach((card, i) => {
            row.addComponents(
                new ButtonBuilder().setCustomId(`shopthe_buy_${i}`).setLabel(`Mua Thẻ ${i + 1}`).setEmoji("🃏").setStyle(ButtonStyle.Primary)
            );
        });

        await interaction.reply({ embeds: [embed], components: [row] });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.deleteReply().catch(() => {});
            } else {
                const disabledRow = new ActionRowBuilder();
                row.components.forEach((btn) => disabledRow.addComponents(ButtonBuilder.from(btn).setDisabled(true)));
                interaction.editReply({ components: [disabledRow] }).catch(() => {});
            }
        });
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user) return interaction.reply({ content: "❌ Không tìm thấy dữ liệu! Dùng /daily để khởi tạo tài khoản.", flags: 64 });

        // --- MUA THẺ (logic GIỮ NGUYÊN) ---
        if (action === "buy") {
            const shopIndex = parseInt(parts[2]);
            const cardToBuy = currentShop[shopIndex];
            if (!cardToBuy) return interaction.reply({ content: "❌ Shop đã làm mới, thẻ này không còn nữa! Gõ /shopthe để xem đợt mới.", flags: 64 });
            if (user.money < cardToBuy.price) {
                return interaction.reply({ content: `❌ Thiếu **${money(cardToBuy.price - user.money)} VND** nữa mới rước được **${cardToBuy.name}**!`, flags: 64 });
            }

            // Túi đầy → chọn thẻ vứt
            if (user.cards && user.cards.length >= 5) {
                const r = rarity(cardToBuy.price);
                const fullEmbed = casinoEmbed({ color: COLORS.red, title: "🎒 TÚI ĐỒ ĐÃ ĐẦY (5/5)!" })
                    .setDescription(
                        `Bạn muốn rước **${cardToBuy.name}** ${r.tag} về đội.\n` +
                        `⚠️ Hãy chọn 1 thẻ để **vứt bỏ vĩnh viễn** (cẩn thận kẻo tiếc):`
                    );

                const replaceRow = new ActionRowBuilder();
                user.cards.forEach((c, i) => {
                    replaceRow.addComponents(
                        new ButtonBuilder().setCustomId(`shopthe_replace_${shopIndex}_${i}`).setLabel(`Bỏ [Lv.${c.level || 1}] ${c.name}`.slice(0, 80)).setStyle(ButtonStyle.Danger)
                    );
                });
                const cancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("shopthe_cancel").setLabel("Hủy — giữ nguyên đội hình").setEmoji("↩️").setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({ embeds: [fullEmbed], components: [replaceRow, cancelRow], flags: 64 });
            }

            user.money -= cardToBuy.price;
            user.cards.push({ ...cardToBuy });
            await user.save();

            const r = rarity(cardToBuy.price);
            return interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.green, title: "🧾 RƯỚC THẺ THÀNH CÔNG!" })
                    .setDescription(
                        `# 🃏 ${cardToBuy.name}\n` +
                        `> ${r.tag} ${r.stars} • 🔥 DPS gốc: \`${money(previewDPS(cardToBuy))}\`\n` +
                        `> 💵 Thanh toán: \`-${money(cardToBuy.price)} VND\` • Ví còn: ${vnd(user.money)}\n` +
                        `> 🎒 Túi đồ: **${user.cards.length}/5** thẻ\n\n` +
                        `💡 *Gõ /tuido để nâng cấp, /leothap để đưa thẻ đi chinh chiến!*`
                    )],
                flags: 64,
            });
        }

        // --- THAY THẺ (logic GIỮ NGUYÊN) ---
        if (action === "replace") {
            const shopIndex = parseInt(parts[2]);
            const userCardIndex = parseInt(parts[3]);
            const cardToBuy = currentShop[shopIndex];
            if (!cardToBuy) return interaction.update({ content: "❌ Shop đã làm mới, thẻ không còn!", embeds: [], components: [] });

            if (user.money < cardToBuy.price) return interaction.update({ content: "❌ Hết tiền rồi!", embeds: [], components: [] });

            const oldName = user.cards[userCardIndex].name;
            user.money -= cardToBuy.price;
            user.cards[userCardIndex] = { ...cardToBuy };
            user.markModified("cards");
            await user.save();

            return interaction.update({
                content: `✅ Đã tiễn **${oldName}** ra đảo và chào đón **${cardToBuy.name}** ${rarity(cardToBuy.price).tag} về đội!\n💼 Ví còn: ${vnd(user.money)}`,
                embeds: [],
                components: [],
            });
        }

        if (action === "cancel") return interaction.update({ content: "↩️ Đã hủy — đội hình giữ nguyên.", embeds: [], components: [] });
    },
};