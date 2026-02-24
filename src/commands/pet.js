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
    { level: 1, image: "https://static.wikia.nocookie.net/dragoncity/images/e/e0/Heat_Dragon_1.png/revision/latest?cb=20150914144922" },
    { level: 30, image: "https://static.wikia.nocookie.net/dragoncity/images/3/37/Heat_Dragon_2.png/revision/latest?cb=20150914144933" },
    { level: 60, image: "https://static.wikia.nocookie.net/dragoncity/images/0/0b/Heat_Dragon_3.png/revision/latest?cb=20150914144946" },
  ],
  water: [
    { level: 1, image: "https://static.wikia.nocookie.net/dragoncity/images/a/ad/Waterfall_Dragon_1.png/revision/latest?cb=20250117154515" },
    { level: 30, image: "https://static.wikia.nocookie.net/dragoncity/images/6/6d/Waterfall_Dragon_2.png/revision/latest?cb=20250117154543" },
    { level: 60, image: "https://static.wikia.nocookie.net/dragoncity/images/a/a2/Waterfall_Dragon_3.png/revision/latest?cb=20250117154630" },
  ],
  electric: [
    { level: 1, image: "https://static.wikia.nocookie.net/dragoncity/images/a/ad/Electric_Dragon_1.png/revision/latest?cb=20250120094618" },
    { level: 30, image: "https://static.wikia.nocookie.net/dragoncity/images/5/5a/Electric_Dragon_2.png/revision/latest?cb=20250120094651" },
    { level: 60, image: "https://static.wikia.nocookie.net/dragoncity/images/f/f0/Electric_Dragon_3.png/revision/latest?cb=20250120094737" },
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
  // ⭐ Item gốc
  { name: "Cỏ Ánh Sáng", price: 1_000_000, exp: 300 },
  { name: "Trái Ma Thuật", price: 2_000_000, exp: 600 },
  { name: "Tinh Thạch", price: 5_000_000, exp: 1500 },
  { name: "Lõi Thú", price: 10_000_000, exp: 3000 },
  { name: "Ngọc Hỏa", price: 20_000_000, exp: 6000 },
  { name: "Tim Rồng", price: 50_000_000, exp: 15000 },

  // 🔥 10 item mới (không trùng giá, <= 100m)
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

  async handleButton(interaction, client) {
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
          value: `💰 ${item.price.toLocaleString("vi-VN")} ₫ | EXP +${item.exp}`,
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

  ////////////////////////////////////////////////////////
  // BUTTON
  ////////////////////////////////////////////////////////

  if (interaction.isButton()) {

    if (!interaction.customId.startsWith("pet_buy_")) return;

    const parts = interaction.customId.split("_");
    if (parts.length < 3) return;

    const index = parseInt(parts[2]);
    if (isNaN(index)) return;

    const modal = new ModalBuilder()
      .setCustomId(`pet_buy_confirm_${index}`)
      .setTitle("🛒 Nhập số lượng muốn mua");

    const quantityInput = new TextInputBuilder()
      .setCustomId("buy_quantity")
      .setLabel("Bạn muốn mua bao nhiêu?")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 5");

    const row = new ActionRowBuilder().addComponents(quantityInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  ////////////////////////////////////////////////////////
  // MODAL SUBMIT
  ////////////////////////////////////////////////////////

  if (interaction.isModalSubmit()) {

    if (!interaction.customId.startsWith("pet_buy_confirm_")) return;

    await interaction.deferReply({ ephemeral: false });

    try {

      const parts = interaction.customId.split("_");
      if (parts.length < 4)
        return interaction.editReply("❌ Lỗi dữ liệu!");

      const index = parseInt(parts[3]);
      if (isNaN(index))
        return interaction.editReply("❌ Lỗi dữ liệu!");

      const quantityRaw = interaction.fields.getTextInputValue("buy_quantity");
      const quantity = parseInt(quantityRaw);

      if (isNaN(quantity) || quantity <= 0)
        return interaction.editReply("❌ Số lượng không hợp lệ!");

      const user = await User.findOne({ userId: interaction.user.id });
      if (!user)
        return interaction.editReply("❌ Không tìm thấy user.");

      const shop = await getShop();
      if (!shop || !shop.items || !shop.items[index])
        return interaction.editReply("❌ Item không tồn tại!");

      const item = shop.items[index];

      if (!user.pet)
        return interaction.editReply("❌ Bạn chưa có pet!");

      const totalPrice = item.price * quantity;
      const totalExp = item.exp * quantity;

      if (!user.money || user.money < totalPrice)
        return interaction.editReply("❌ Không đủ tiền!");

      ////////////////////////////////////////////////////////
      // TRỪ TIỀN + CỘNG EXP
      ////////////////////////////////////////////////////////

      user.money -= totalPrice;
      user.pet.exp += totalExp;

      let levelUpLog = "";
      let levelUpCount = 0;

      while (user.pet.exp >= user.pet.expNeeded) {

        user.pet.exp -= user.pet.expNeeded;
        user.pet.level++;
        levelUpCount++;

        user.pet.expNeeded = expFormula(user.pet.level);

        const rand = () => Math.floor(Math.random() * 3) + 1;

        const hpUp = rand();
        const atkUp = rand();
        const defUp = rand();
        const spdUp = rand();

        user.pet.stats.hp += hpUp;
        user.pet.stats.atk += atkUp;
        user.pet.stats.def += defUp;
        user.pet.stats.spd += spdUp;

        levelUpLog +=
          `\nLevel ${user.pet.level} → ❤️ +${hpUp} | ⚔️ +${atkUp} | 🛡️ +${defUp} | 💨 +${spdUp}`;
      }

      await user.save();

      ////////////////////////////////////////////////////////
      // EMBED KẾT QUẢ
      ////////////////////////////////////////////////////////

      const embed = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("🎉 GIAO DỊCH THÀNH CÔNG!")
        .setDescription(
          `🛒 Mua: **${item.name} x${quantity}**\n` +
          `💰 Tổng trừ: ${totalPrice.toLocaleString("vi-VN")} ₫\n` +
          `💳 Số dư: ${user.money.toLocaleString("vi-VN")} ₫\n\n` +
          `🔥 Nhận: +${totalExp.toLocaleString("vi-VN")} EXP\n\n` +
          `🐲 Level hiện tại: ${user.pet.level}`
        )
        .addFields({
          name: levelUpCount > 0
            ? `✨ LÊN ${levelUpCount} LEVEL`
            : "📊 Không lên cấp",
          value: levelUpCount > 0
            ? levelUpLog
            : "Pet chưa đủ EXP",
        });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error("PET BUY ERROR:", err);
      return interaction.editReply("❌ Lỗi hệ thống!");
    }
  }

    ////////////////////////////////////////////////////
    // BALO
    ////////////////////////////////////////////////////

if (interaction.customId === "pet_bag") {
  if (!user.pet)
    return interaction.reply({ content: "❌ Bạn chưa có pet!", flags: 64 });

const p = user.pet;
let key = p.id;

// 🔥 Nếu id chứa _dragon thì cắt bỏ
if (key && key.includes("_")) {
  key = key.split("_")[0];
}

if (!PET_TYPES[key]) {
  console.log("INVALID PET ID:", p.id);
  return interaction.reply({
    content: "❌ Pet bị lỗi dữ liệu (id không tồn tại trong PET_TYPES).",
    flags: 64,
  });
}

  const stage = getPetStage(key, p.level);

  const embed = new EmbedBuilder()
    .setTitle(`🐲 ${p.name}`)
    .setThumbnail(stage?.image || stage?.imageUrl || PET_TYPES[key]?.image || null)
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

  async handleModal(interaction, client) {
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
