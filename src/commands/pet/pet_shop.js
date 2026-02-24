const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

//////////////////////////////////////////////////////
// 🏪 SHOP DATA
//////////////////////////////////////////////////////

const SHOP_ITEMS = [
  { name: "Cỏ Ánh Sáng", price: 1_000_000, exp: 300 },
  { name: "Trái Ma Thuật", price: 2_000_000, exp: 600 },
  { name: "Tinh Thạch", price: 5_000_000, exp: 1500 },
  { name: "Lõi Thú", price: 10_000_000, exp: 3000 },
  { name: "Ngọc Hỏa", price: 20_000_000, exp: 6000 },
  { name: "Tim Rồng", price: 50_000_000, exp: 15000 },

  { name: "Hoa Linh Hồn", price: 3_000_000, exp: 900 },
  { name: "Mảnh Ngọc Cổ", price: 7_000_000, exp: 2100 },
  { name: "Hạch Năng Lượng", price: 12_000_000, exp: 3600 },
  { name: "Tinh Hoa Lửa", price: 15_000_000, exp: 4500 },
  { name: "Ngọc Thiên Nhiên", price: 25_000_000, exp: 7500 },
  { name: "Hồn Thạch Nhỏ", price: 30_000_000, exp: 9000 },
  { name: "Mảnh Vỡ Ma Thú", price: 40_000_000, exp: 12000 },
  { name: "Tinh Phách Lửa", price: 60_000_000, exp: 18000 },
  { name: "Huyết Tinh Nhỏ", price: 75_000_000, exp: 22500 },
  { name: "Tinh Hạch Cổ Đại", price: 90_000_000, exp: 27000 },
];

//////////////////////////////////////////////////////
// 🏪 HANDLE SHOP BUTTON
//////////////////////////////////////////////////////

module.exports = {

  async handleButton(interaction) {

    let content = "🏪 **SHOP THÚ CƯNG**\n\n";

    SHOP_ITEMS.forEach((item, index) => {
      content += `**${index + 1}. ${item.name}**\n💰 ${item.price.toLocaleString()} | ⭐ ${item.exp} EXP\n\n`;
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_buy_menu")
        .setLabel("Mua Item")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("pet_menu_back")
        .setLabel("Quay Lại")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      content,
      components: [row]
    });
  },

  SHOP_ITEMS
};
