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
// 🔥 PET CONFIG (BUFF RIÊNG KHÔNG TRÙNG)
//////////////////////////////////////////////////////

const PET_TYPES = {
  fire: {
    id: "fire_dragon",
    race: "Dragon",
    element: "🔥 Lửa",
    buff: "+15% ATK",
    baseStats: { hp: 100, atk: 25, def: 10, spd: 15 },
    growth: { hp: 8, atk: 5, def: 2, spd: 2 },
  },
  water: {
    id: "water_dragon",
    race: "Dragon",
    element: "💧 Nước",
    buff: "+20% HP",
    baseStats: { hp: 140, atk: 18, def: 20, spd: 10 },
    growth: { hp: 12, atk: 3, def: 4, spd: 1 },
  },
  electric: {
    id: "electric_dragon",
    race: "Dragon",
    element: "⚡ Điện",
    buff: "+20% SPD",
    baseStats: { hp: 90, atk: 20, def: 10, spd: 28 },
    growth: { hp: 7, atk: 4, def: 2, spd: 5 },
  },
};

//////////////////////////////////////////////////////
// 📈 EXP FORMULA
//////////////////////////////////////////////////////

function expFormula(level) {
  return 200 + level * level * 50;
}

//////////////////////////////////////////////////////
// 🏪 RANDOM SHOP RESET 1H
//////////////////////////////////////////////////////

const SHOP_ITEMS = [
  { name: "Cỏ Ánh Sáng", price: 1_000_000, exp: 300 },
  { name: "Trái Ma Thuật", price: 2_000_000, exp: 600 },
  { name: "Tinh Thạch", price: 5_000_000, exp: 1500 },
  { name: "Lõi Thú", price: 10_000_000, exp: 3000 },
  { name: "Ngọc Hỏa", price: 20_000_000, exp: 6000 },
  { name: "Tim Rồng", price: 50_000_000, exp: 15000 },
];

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
    shop.items = SHOP_ITEMS.sort(() => 0.5 - Math.random()).slice(0, 6);
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
      .setDescription("Chọn hành động bên dưới");

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

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    setTimeout(() => msg.delete().catch(() => {}), 60000);
  },

  //////////////////////////////////////////////////////
  // BUTTON
  //////////////////////////////////////////////////////

  async handleButton(interaction) {

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    ////////////////////////////////////////////////////
    // CHỌN PET (FIX CHỌN 1 LẦN)
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_choose") {

      if (user.pet) {
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

      const msg = await interaction.reply({
        content: "Chọn 1 loại pet:",
        components: [row],
        fetchReply: true,
      });

      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }

    ////////////////////////////////////////////////////
    // MUA SHOP (THÊM NÚT)
    ////////////////////////////////////////////////////

if (interaction.customId === "pet_shop") {

  const shop = await getShop();

  const embed = new EmbedBuilder()
    .setTitle("🏪 Pet Shop")
    .setDescription("Shop chung toàn server • Reset mỗi 1 giờ");

  const rows = [];
  let currentRow = new ActionRowBuilder();

  shop.items.forEach((item, i) => {

    embed.addFields({
      name: `${i + 1}. ${item.name}`,
      value: `💰 ${item.price.toLocaleString()} | EXP +${item.exp}`
    });

    const button = new ButtonBuilder()
      .setCustomId(`pet_buy_${i}`)
      .setLabel(`Mua ${i + 1}`)
      .setStyle(ButtonStyle.Secondary);

    // nếu đủ 5 button thì tạo row mới
    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    currentRow.addComponents(button);
  });

  // push row cuối
  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  const msg = await interaction.reply({
    embeds: [embed],
    components: rows,
    fetchReply: true,
  });

  setTimeout(() => msg.delete().catch(() => {}), 60000);
  return;
}
    ////////////////////////////////////////////////////
    // BUY ITEM
    ////////////////////////////////////////////////////

    if (interaction.customId.startsWith("pet_buy_")) {

      const index = Number(interaction.customId.split("_")[2]);
      const shop = await getShop();
      const item = shop.items[index];

      if (!user.pet)
        return interaction.reply({ content: "❌ Bạn chưa có pet!", flags: 64 });

      if (user.money < item.price)
        return interaction.reply({ content: "❌ Không đủ tiền!", flags: 64 });

      user.money -= item.price;
      user.pet.exp += item.exp;

      while (user.pet.exp >= user.pet.expNeeded) {
        user.pet.exp -= user.pet.expNeeded;
        user.pet.level++;
        user.pet.expNeeded = expFormula(user.pet.level);

        const growth = PET_TYPES[user.pet.element.replace("🔥 ","").replace("💧 ","").replace("⚡ ","").toLowerCase()]?.growth;

        if (growth) {
          user.pet.stats.hp += growth.hp;
          user.pet.stats.atk += growth.atk;
          user.pet.stats.def += growth.def;
          user.pet.stats.spd += growth.spd;
        }
      }

      await user.save();

      const msg = await interaction.reply({
        content: `✅ Mua thành công +${item.exp} EXP`,
        fetchReply: true,
      });

      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }

    ////////////////////////////////////////////////////
    // BALO (PUBLIC)
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_bag") {

      if (!user.pet)
        return interaction.reply({ content: "❌ Bạn chưa có pet!", flags: 64 });

      const p = user.pet;

      const embed = new EmbedBuilder()
        .setTitle(`🐲 ${p.name}`)
        .setDescription(
          `Hệ: ${p.element}\nBuff: ${PET_TYPES[p.element.replace("🔥 ","").replace("💧 ","").replace("⚡ ","").toLowerCase()].buff}`
        )
        .addFields(
          { name: "Level", value: `${p.level}`, inline: true },
          { name: "EXP", value: `${p.exp}/${p.expNeeded}`, inline: true },
          { name: "HP", value: `${p.stats.hp}`, inline: true },
          { name: "ATK", value: `${p.stats.atk}`, inline: true },
          { name: "DEF", value: `${p.stats.def}`, inline: true },
          { name: "SPD", value: `${p.stats.spd}`, inline: true }
        );

      const msg = await interaction.reply({
        embeds: [embed],
        fetchReply: true,
      });

      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }
  },

  //////////////////////////////////////////////////////
  // MODAL (FIX CHẶN CHỌN NHIỀU PET)
  //////////////////////////////////////////////////////

  async handleModal(interaction) {

    if (!interaction.customId.startsWith("pet_name_")) return;

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.pet)
      return interaction.reply({
        content: "❌ Bạn đã có pet rồi!",
        flags: 64,
      });

    const type = interaction.customId.split("_")[2];
    const name = interaction.fields.getTextInputValue("pet_name_input");

    const config = PET_TYPES[type];

    user.pet = {
      id: config.id,
      name,
      element: config.element,
      race: config.race,
      level: 1,
      exp: 0,
      expNeeded: expFormula(1),
      stats: config.baseStats,
      createdAt: new Date(),
    };

    await user.save();

    const msg = await interaction.reply({
      content: `🎉 Bạn đã nhận pet **${name}** (${config.element})`,
      fetchReply: true,
    });

    setTimeout(() => msg.delete().catch(() => {}), 60000);
  },
};
