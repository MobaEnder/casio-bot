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
// 🧬 EVOLUTION SYSTEM
//////////////////////////////////////////////////////

const PET_EVOLUTION = {
  fire: [
    { level: 1, image: "https://link-fire-lv1.png" },
    { level: 30, image: "https://link-fire-lv30.png" },
    { level: 60, image: "https://link-fire-lv60.png" },
  ],
  water: [
    { level: 1, image: "https://link-water-lv1.png" },
    { level: 30, image: "https://link-water-lv30.png" },
    { level: 60, image: "https://link-water-lv60.png" },
  ],
  electric: [
    { level: 1, image: "https://link-electric-lv1.png" },
    { level: 30, image: "https://link-electric-lv30.png" },
    { level: 60, image: "https://link-electric-lv60.png" },
  ],
};

function getPetStage(type, level) {
  const stages = PET_EVOLUTION[type];

  if (!stages || stages.length === 0) {
    return { level: 1, image: null };
  }

  let current = stages[0];

  for (const stage of stages) {
    if (level >= stage.level) {
      current = stage;
    }
  }

  return current;
}

//////////////////////////////////////////////////////
// 📈 EXP
//////////////////////////////////////////////////////

function expFormula(level) {
  return 200 + level * level * 50;
}

function createExpBar(current, max) {
  const percent = Math.floor((current / max) * 100);
  const totalBars = 20;
  const filled = Math.round((percent / 100) * totalBars);
  const empty = totalBars - filled;
  return `\`\`\`[${"█".repeat(filled)}${"░".repeat(empty)}] ${percent}%\`\`\``;
}

//////////////////////////////////////////////////////
// 🏪 SHOP
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

  if (Date.now() - shop.lastReset.getTime() > 3600000) {
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
      new ButtonBuilder().setCustomId("pet_choose").setLabel("🥚 Chọn Pet").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("pet_bag").setLabel("🎒 Balo").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("pet_shop").setLabel("🏪 Shop").setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    setTimeout(() => msg.delete().catch(() => {}), 60000);
  },

  //////////////////////////////////////////////////////

  async handleButton(interaction) {
    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    ////////////////////////////////////////////////////
    // CHỌN PET
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_choose") {
      if (user.pet)
        return interaction.reply({ content: "❌ Bạn đã có pet rồi!", flags: 64 });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pet_fire").setLabel("🔥 Rồng Lửa").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("pet_water").setLabel("💧 Rồng Nước").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("pet_electric").setLabel("⚡ Rồng Điện").setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ content: "Chọn 1 loại pet:", components: [row], fetchReply: true });
      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }

    ////////////////////////////////////////////////////
// CHỌN HỆ → MỞ MODAL ĐẶT TÊN
////////////////////////////////////////////////////

if (
  interaction.customId === "pet_fire" ||
  interaction.customId === "pet_water" ||
  interaction.customId === "pet_electric"
) {

  if (user.pet)
    return interaction.reply({
      content: "❌ Bạn đã có pet rồi!",
      flags: 64,
    });

  const type = interaction.customId.split("_")[1];

  const modal = new ModalBuilder()
    .setCustomId(`pet_name_${type}`)
    .setTitle("Đặt tên cho Pet");

  const input = new TextInputBuilder()
    .setCustomId("pet_name_input")
    .setLabel("Nhập tên pet của bạn")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return interaction.showModal(modal);
}

    ////////////////////////////////////////////////////
    // SHOP
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_shop") {
      const shop = await getShop();
      const embed = new EmbedBuilder().setTitle("🏪 Pet Shop");

      const rows = [];
      let currentRow = new ActionRowBuilder();

      shop.items.forEach((item, i) => {
        embed.addFields({
          name: `${i + 1}. ${item.name}`,
          value: `💰 ${item.price.toLocaleString()} | EXP +${item.exp}`,
        });

        const button = new ButtonBuilder()
          .setCustomId(`pet_buy_${i}`)
          .setLabel(`Mua ${i + 1}`)
          .setStyle(ButtonStyle.Secondary);

        if (currentRow.components.length === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }

        currentRow.addComponents(button);
      });

      if (currentRow.components.length > 0) rows.push(currentRow);

      const msg = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });
      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }

    ////////////////////////////////////////////////////
    // BUY
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

        const key = user.pet.element.replace("🔥 ", "").replace("💧 ", "").replace("⚡ ", "").toLowerCase();
        const growth = PET_TYPES[key].growth;

        user.pet.stats.hp += growth.hp;
        user.pet.stats.atk += growth.atk;
        user.pet.stats.def += growth.def;
        user.pet.stats.spd += growth.spd;

        if (user.pet.level === 30 || user.pet.level === 60) {
          await interaction.followUp({
            content: `🌟 PET ĐÃ TIẾN HÓA TẠI LEVEL ${user.pet.level}!`,
          });
        }
      }

      await user.save();

      const embed = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("🎉 GIAO DỊCH THÀNH CÔNG!")
        .setDescription(
          `🛒 Bạn đã mua **${item.name}**\n\n` +
          `💰 Trừ: ${item.price.toLocaleString()} xu\n` +
          `🔥 Nhận: +${item.exp} EXP\n\n` +
          `🐲 Pet hiện tại: Level ${user.pet.level}`
        );

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      setTimeout(() => msg.delete().catch(() => {}), 60000);
      return;
    }

    ////////////////////////////////////////////////////
    // BALO
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_bag") {
      if (!user.pet)
        return interaction.reply({ content: "❌ Bạn chưa có pet!", flags: 64 });

      const p = user.pet;
      const key = p.type;
      const stage = getPetStage(key, p.level);

      const embed = new EmbedBuilder()
        .setTitle(`🐲 ${p.name}`)
        .setThumbnail(stage.image)
        .setDescription(
          `🌟 Hệ: ${p.element}\n` +
          `✨ Buff: ${PET_TYPES[key].buff}\n\n` +
          `📊 Level: ${p.level}\n` +
          `🔥 EXP: ${p.exp}/${p.expNeeded}\n` +
          createExpBar(p.exp, p.expNeeded)
        )
        .addFields(
          { name: "❤️ HP", value: `${p.stats.hp}`, inline: true },
          { name: "⚔️ ATK", value: `${p.stats.atk}`, inline: true },
          { name: "🛡️ DEF", value: `${p.stats.def}`, inline: true },
          { name: "💨 SPD", value: `${p.stats.spd}`, inline: true }
        );

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      setTimeout(() => msg.delete().catch(() => {}), 60000);
    }
  },

  //////////////////////////////////////////////////////

  async handleModal(interaction) {
    if (!interaction.customId.startsWith("pet_name_")) return;

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.pet)
      return interaction.reply({ content: "❌ Bạn đã có pet rồi!", flags: 64 });

    const type = interaction.customId.split("_")[2];
    const name = interaction.fields.getTextInputValue("pet_name_input");
    const config = PET_TYPES[type];

    user.pet = {
      id: config.id,
      name,
      type: type,
      element: config.element,
      race: config.race,
      level: 1,
      exp: 0,
      expNeeded: expFormula(1),
      stats: { ...config.baseStats },
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
