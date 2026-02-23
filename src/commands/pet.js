const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const User = require("../models/User");
const PetShop = require("../models/PetShop");

//////////////////////////////////////////////////////
// 🔥 PET CONFIG
//////////////////////////////////////////////////////

const PET_TYPES = {
  fire: {
    id: "fire_dragon",
    race: "dragon",
    element: "fire",
    baseStats: { hp: 100, atk: 20, def: 10, spd: 15 },
    growth: { hp: 8, atk: 4, def: 2, spd: 2 },
  },
  water: {
    id: "water_dragon",
    race: "dragon",
    element: "water",
    baseStats: { hp: 130, atk: 15, def: 20, spd: 10 },
    growth: { hp: 12, atk: 2, def: 4, spd: 1 },
  },
  electric: {
    id: "electric_dragon",
    race: "dragon",
    element: "electric",
    baseStats: { hp: 90, atk: 18, def: 10, spd: 25 },
    growth: { hp: 7, atk: 3, def: 2, spd: 4 },
  },
};

//////////////////////////////////////////////////////
// 🏪 SHOP ITEMS (20 ITEM)
//////////////////////////////////////////////////////

const SHOP_ITEMS = [
  { name: "Cỏ Ánh Sáng", price: 1_000_000, exp: 300 },
  { name: "Trái Đỏ Ma Thuật", price: 2_000_000, exp: 500 },
  { name: "Hạt Năng Lượng", price: 3_000_000, exp: 700 },
  { name: "Thịt Thú Nhỏ", price: 4_000_000, exp: 900 },
  { name: "Mật Ong Hoang Dã", price: 5_000_000, exp: 1200 },

  { name: "Thịt Quái Trung Cấp", price: 10_000_000, exp: 2500 },
  { name: "Tinh Thạch Lam", price: 12_000_000, exp: 3000 },
  { name: "Linh Thảo Cổ", price: 15_000_000, exp: 3500 },
  { name: "Nước Suối Thần", price: 18_000_000, exp: 4000 },
  { name: "Lõi Thú Hộ Vệ", price: 20_000_000, exp: 5000 },

  { name: "Lõi Ma Năng", price: 30_000_000, exp: 8000 },
  { name: "Tim Thú Lớn", price: 35_000_000, exp: 9000 },
  { name: "Ngọc Linh Hỏa", price: 40_000_000, exp: 11000 },
  { name: "Huyết Tinh", price: 45_000_000, exp: 13000 },
  { name: "Viên Tinh Hoa", price: 50_000_000, exp: 15000 },

  { name: "Tim Rồng Non", price: 60_000_000, exp: 20000 },
  { name: "Linh Hồn Cổ Đại", price: 70_000_000, exp: 23000 },
  { name: "Trứng Ma Thú", price: 80_000_000, exp: 26000 },
  { name: "Ngọc Vương Giả", price: 90_000_000, exp: 30000 },
  { name: "Tim Rồng Cổ Đại", price: 100_000_000, exp: 35000 },
];

//////////////////////////////////////////////////////
// 📈 EXP FORMULA
//////////////////////////////////////////////////////

function expFormula(level) {
  return 100 + level * level * 20;
}

//////////////////////////////////////////////////////
// 🎲 RANDOM SHOP
//////////////////////////////////////////////////////

async function getShop() {
  let shop = await PetShop.findOne();

  if (!shop) {
    shop = await PetShop.create({
      items: [],
      lastReset: new Date(0),
    });
  }

  const now = Date.now();
  const diff = now - shop.lastReset.getTime();

  if (diff > 60 * 60 * 1000) {
    const shuffled = SHOP_ITEMS.sort(() => 0.5 - Math.random());
    shop.items = shuffled.slice(0, 6);
    shop.lastReset = new Date();
    await shop.save();
  }

  return shop;
}

//////////////////////////////////////////////////////
// 🎮 COMMAND
//////////////////////////////////////////////////////

module.exports = {
  data: new SlashCommandBuilder()
    .setName("thucung")
    .setDescription("Hệ thống thú cưng"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🐲 Hệ thống Thú Cưng")
      .setDescription("Chọn hành động bên dưới:");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_choose")
        .setLabel("🥚 Chọn Pet")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pet_bag")
        .setLabel("🎒 Balo")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pet_shop")
        .setLabel("🏪 Shop")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  //////////////////////////////////////////////////////
  // BUTTON
  //////////////////////////////////////////////////////

  async handleButton(interaction) {
    const user = await User.findOne({ userId: interaction.user.id });

    /////////////////////////////////////////////////
    // CHỌN PET
    /////////////////////////////////////////////////

    if (interaction.customId === "pet_choose") {
      if (user?.pet) {
        return interaction.reply({
          content: "❌ Bạn đã có pet rồi!",
          flags: 64,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pet_fire")
          .setLabel("🔥 Rồng Lửa")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("pet_water")
          .setLabel("💧 Rồng Nước")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pet_electric")
          .setLabel("⚡ Rồng Điện")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        content: "Chọn 1 loại pet:",
        components: [row],
      });
    }

    /////////////////////////////////////////////////
    // TẠO PET
    /////////////////////////////////////////////////

    if (interaction.customId.startsWith("pet_") &&
        ["pet_fire", "pet_water", "pet_electric"].includes(interaction.customId)) {

      const type = interaction.customId.split("_")[1];
      const modal = new ModalBuilder()
        .setCustomId(`pet_name_${type}`)
        .setTitle("Đặt tên cho pet");

      const input = new TextInputBuilder()
        .setCustomId("pet_name_input")
        .setLabel("Tên pet")
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(15)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    /////////////////////////////////////////////////
    // BALO
    /////////////////////////////////////////////////

    if (interaction.customId === "pet_bag") {
      if (!user?.pet) {
        return interaction.reply({
          content: "❌ Bạn chưa có pet!",
          flags: 64,
        });
      }

      const p = user.pet;

      const embed = new EmbedBuilder()
        .setTitle(`🐲 ${p.name}`)
        .setDescription(
          `Level: ${p.level}\nEXP: ${p.exp}/${p.expNeeded}\nHệ: ${p.element}`
        )
        .addFields(
          { name: "HP", value: `${p.stats.hp}`, inline: true },
          { name: "ATK", value: `${p.stats.atk}`, inline: true },
          { name: "DEF", value: `${p.stats.def}`, inline: true },
          { name: "SPD", value: `${p.stats.spd}`, inline: true }
        );

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    /////////////////////////////////////////////////
    // SHOP
    /////////////////////////////////////////////////

    if (interaction.customId === "pet_shop") {
      const shop = await getShop();

      const embed = new EmbedBuilder()
        .setTitle("🏪 Pet Shop (Random 6 items)");

      shop.items.forEach((item, i) => {
        embed.addFields({
          name: `${i + 1}. ${item.name}`,
          value: `💰 ${item.price.toLocaleString()} | EXP +${item.exp}`,
        });
      });

      return interaction.reply({ embeds: [embed] });
    }
  },

  //////////////////////////////////////////////////////
  // MODAL
  //////////////////////////////////////////////////////

  async handleModal(interaction) {
    if (!interaction.customId.startsWith("pet_name_")) return;

    const type = interaction.customId.split("_")[2];
    const name = interaction.fields.getTextInputValue("pet_name_input");

    const config = PET_TYPES[type];
    if (!config) return;

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) {
      user = await User.create({ userId: interaction.user.id });
    }

    user.pet = {
      id: config.id,
      name,
      element: config.element,
      race: config.race,
      level: 1,
      exp: 0,
      expNeeded: expFormula(1),
      evolution: 0,
      stats: config.baseStats,
      createdAt: new Date(),
    };

    await user.save();

    await interaction.reply({
      content: `🎉 Bạn đã nhận pet **${name}** (${config.element})`,
    });
  },
};
