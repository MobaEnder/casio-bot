const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const PetShop = require("../../models/PetShop"); // sửa path nếu cần

//////////////////////////////////////////////////////
// 🏪 SHOP DATA (FULL POOL)
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
// 🎲 RANDOM 6 ITEM
//////////////////////////////////////////////////////

function getRandomItems() {
  const shuffled = [...SHOP_ITEMS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6);
}

//////////////////////////////////////////////////////
// 🏪 GET SHOP (RESET SAU 1 TIẾNG)
//////////////////////////////////////////////////////

async function getShop() {
  let shop = await PetShop.findOne();

  const ONE_HOUR = 60 * 60 * 1000;

  if (!shop) {
    shop = await PetShop.create({
      items: getRandomItems(),
      lastReset: new Date()
    });
    return shop;
  }

  const now = Date.now();
  const diff = now - new Date(shop.lastReset).getTime();

  if (diff >= ONE_HOUR) {
    shop.items = getRandomItems();
    shop.lastReset = new Date();
    await shop.save();
  }

  return shop;
}

//////////////////////////////////////////////////////
// 🏪 HANDLE BUTTON
//////////////////////////////////////////////////////

module.exports = {

  async handleButton(interaction) {

    const shop = await getShop();

    const remaining =
      60 * 60 -
      Math.floor((Date.now() - new Date(shop.lastReset)) / 1000);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    const embed = new EmbedBuilder()
      .setTitle("🏪 SHOP THÚ CƯNG")
      .setDescription("✨ Reset mỗi 1 giờ")
      .setColor(0xff9900)
      .addFields(
        shop.items.map((item, index) => ({
          name: `🛒 ${index + 1}. ${item.name}`,
          value: `💰 ${item.price.toLocaleString()} | ⭐ ${item.exp} EXP`,
          inline: false
        }))
      )
      .setFooter({
        text: `⏳ Reset sau: ${minutes}m ${seconds}s`
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
      embeds: [embed],
      components: [row]
    });
  }
};