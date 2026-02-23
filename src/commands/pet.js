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
// 🧬 EVOLUTION
//////////////////////////////////////////////////////

const PET_EVOLUTION = {
  fire: [
    { level: 1, image: "https://cdn.discordapp.com/attachments/919941010304417834/1475528361643085894/image.png" },
    { level: 30, image: "https://cdn.discordapp.com/attachments/1475525093785600122/1475530189575295148/Gemini_Generated_Image_qmg1s0qmg1s0qmg1_1.png" },
    { level: 60, image: "https://cdn.discordapp.com/attachments/1475525093785600122/1475532076466835498/image.png" },
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
  if (!stages) return { level: 1, image: null };

  let current = stages[0];
  for (const stage of stages) {
    if (level >= stage.level) current = stage;
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
      new ButtonBuilder().setCustomId("pet_bag").setLabel("🎒 Balo").setStyle(ButtonStyle.Success)
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

      return interaction.reply({ content: "Chọn 1 loại pet:", components: [row] });
    }

    ////////////////////////////////////////////////////
    // MỞ MODAL
    ////////////////////////////////////////////////////

    if (interaction.customId.startsWith("pet_") && interaction.customId !== "pet_choose") {
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

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    ////////////////////////////////////////////////////
    // BALO
    ////////////////////////////////////////////////////

    if (interaction.customId === "pet_bag") {
      if (!user.pet)
        return interaction.reply({ content: "❌ Bạn chưa có pet!", flags: 64 });

      const p = user.pet;
      const key = p.type || "fire"; // fallback an toàn
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

      return interaction.reply({ embeds: [embed] });
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
      type,
      element: config.element,
      race: config.race,
      level: 1,
      exp: 0,
      expNeeded: expFormula(1),
      stats: { ...config.baseStats },
      createdAt: new Date(),
    };

    await user.save();

    return interaction.reply({
      content: `🎉 Bạn đã nhận pet **${name}** (${config.element})`,
    });
  },
};
