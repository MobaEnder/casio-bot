const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const mongoose = require("mongoose");

//////////////////////////////////////////////////
// ===== MONGOOSE MODEL =====
//////////////////////////////////////////////////

const petSchema = new mongoose.Schema({
  userId: String,
  pet: String,
  exp: { type: Number, default: 0 },
  coins: { type: Number, default: 5000 }
});

const Pet = mongoose.models.Pet || mongoose.model("Pet", petSchema);

//////////////////////////////////////////////////
// ===== PET DATA =====
//////////////////////////////////////////////////

const PET_TYPES = {
  fire: { name: "🔥 Fire", buff: "+10% ATK | 5% Crit" },
  water: { name: "💧 Water", buff: "+15% HP | +10% DEF" },
  electric: { name: "⚡ Electric", buff: "+15% SPD | 10% Dodge" }
};

function getLevel(exp) {
  return Math.floor(exp / 1000) + 1;
}

function expBar(exp) {
  const current = exp % 1000;
  const percent = Math.floor((current / 1000) * 10);
  return "█".repeat(percent) + "░".repeat(10 - percent);
}

function embedColor(level) {
  if (level >= 90) return 0xFFD700;
  if (level >= 60) return 0x9B59B6;
  if (level >= 30) return 0x3498DB;
  return 0x2ECC71;
}

//////////////////////////////////////////////////
// ===== SHARED SHOP (RAM MEMORY) =====
//////////////////////////////////////////////////

let shop = null;

function generateShop() {
  const items = [];
  for (let i = 1; i <= 6; i++) {
    items.push({
      id: i,
      name: `Item ${i}`,
      price: 500 + Math.floor(Math.random() * 500),
      exp: 200 + Math.floor(Math.random() * 300),
      stock: Math.random() > 0.5 ? 2 : 3
    });
  }

  shop = {
    items,
    reset: Date.now() + 3600000
  };
}

function getShop() {
  if (!shop || Date.now() > shop.reset) {
    generateShop();
  }
  return shop;
}

//////////////////////////////////////////////////
// ===== COMMAND EXPORT =====
//////////////////////////////////////////////////

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pet")
    .setDescription("Hệ thống pet")
    .addSubcommand(s =>
      s.setName("chon").setDescription("Chọn pet")
    )
    .addSubcommand(s =>
      s.setName("balo")
        .setDescription("Xem balo")
        .addUserOption(o =>
          o.setName("user").setDescription("Xem người khác")
        )
    )
    .addSubcommand(s =>
      s.setName("shop").setDescription("Xem shop")
    ),

  //////////////////////////////////////////////////
  // EXECUTE
  //////////////////////////////////////////////////

  async execute(interaction) {

    const sub = interaction.options.getSubcommand();

    // ===== CHỌN PET =====
    if (sub === "chon") {

      const exist = await Pet.findOne({ userId: interaction.user.id });
      if (exist)
        return interaction.reply({ content: "Bạn đã có pet rồi!", flags: 64 });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pet_choose_fire")
          .setLabel("🔥 Fire")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("pet_choose_water")
          .setLabel("💧 Water")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("pet_choose_electric")
          .setLabel("⚡ Electric")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({
        content: "Chọn hệ pet:",
        components: [row]
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }

    // ===== BALO =====
    if (sub === "balo") {

      const target =
        interaction.options.getUser("user") || interaction.user;

      const user = await Pet.findOne({ userId: target.id });
      if (!user)
        return interaction.reply({ content: "Người này chưa có pet!", flags: 64 });

      const level = getLevel(user.exp);

      const embed = new EmbedBuilder()
        .setTitle(`Balo của ${target.username}`)
        .setColor(embedColor(level))
        .addFields(
          { name: "Hệ", value: PET_TYPES[user.pet].name },
          { name: "Buff", value: PET_TYPES[user.pet].buff },
          { name: "Level", value: level.toString() },
          { name: "EXP", value: `${user.exp}\n${expBar(user.exp)}` },
          { name: "Coins", value: user.coins.toString() }
        );

      await interaction.reply({ embeds: [embed] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }

    // ===== SHOP =====
    if (sub === "shop") {

      const currentShop = getShop();

      const embed = new EmbedBuilder()
        .setTitle("🏪 SHOP CHUNG")
        .setColor(0xF1C40F);

      currentShop.items.forEach(i => {
        embed.addFields({
          name: `${i.id}. ${i.name} (x${i.stock})`,
          value: `Giá: ${i.price} | EXP: +${i.exp}`
        });
      });

      const row = new ActionRowBuilder();

      currentShop.items.forEach(i => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pet_buy_${i.id}`)
            .setLabel(`Mua ${i.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(i.stock <= 0)
        );
      });

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }
  },

  //////////////////////////////////////////////////
  // HANDLE BUTTON
  //////////////////////////////////////////////////

  async handleButton(interaction) {

    // ===== CHOOSE =====
    if (interaction.customId.startsWith("pet_choose_")) {

      const type = interaction.customId.split("_")[2];

      const exist = await Pet.findOne({ userId: interaction.user.id });
      if (exist)
        return interaction.reply({ content: "Bạn đã có pet rồi!", flags: 64 });

      await Pet.create({
        userId: interaction.user.id,
        pet: type
      });

      await interaction.update({
        content: `Bạn đã chọn hệ ${PET_TYPES[type].name}`,
        components: []
      });
    }

    // ===== BUY =====
    if (interaction.customId.startsWith("pet_buy_")) {

      const id = Number(interaction.customId.split("_")[2]);
      const currentShop = getShop();
      const item = currentShop.items.find(i => i.id === id);

      if (!item || item.stock <= 0)
        return interaction.reply({ content: "Hết hàng!", flags: 64 });

      const user = await Pet.findOne({ userId: interaction.user.id });
      if (!user)
        return interaction.reply({ content: "Bạn chưa có pet!", flags: 64 });

      if (user.coins < item.price)
        return interaction.reply({ content: "Không đủ tiền!", flags: 64 });

      user.coins -= item.price;
      user.exp += item.exp;
      item.stock--;

      await user.save();

      const level = getLevel(user.exp);

      await interaction.reply({
        content: `Mua thành công! +${item.exp} EXP`
      });

      if ([30, 60, 90].includes(level)) {
        interaction.channel.send(
          `🔥 ${interaction.user.username} đã đạt level ${level}!`
        );
      }

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }
  }
};
