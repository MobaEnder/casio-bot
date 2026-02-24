const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const User = require("../../models/User");
const PetEvolution = require("../../models/PetEvolution");

//////////////////////////////////////////////////////
// 🎨 PET BASE CONFIG (KHÔNG LƯU ẢNH Ở ĐÂY)
//////////////////////////////////////////////////////

const PET_BASE = {
  fire_dragon: {
    element: "fire",
    icon: "🔥",
    color: 0xff4500,
    stats: { hp: 120, atk: 20, def: 8, spd: 10 }
  },
  water_dragon: {
    element: "water",
    icon: "🌊",
    color: 0x0099ff,
    stats: { hp: 150, atk: 12, def: 18, spd: 8 }
  },
  electric_dragon: {
    element: "electric",
    icon: "⚡",
    color: 0xffd700,
    stats: { hp: 100, atk: 15, def: 10, spd: 20 }
  }
};

//////////////////////////////////////////////////////
// 🥚 BUTTON CHỌN PET
//////////////////////////////////////////////////////

module.exports = {

  async handleButton(interaction) {

    const user = await User.findOne({ userId: interaction.user.id });

    if (user?.pet?.id) {
      return interaction.reply({
        content: "❌ Bạn đã có pet rồi!",
        flags: 64
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_choose_fire_dragon")
        .setLabel("🔥 Fire Dragon")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("pet_choose_water_dragon")
        .setLabel("🌊 Water Dragon")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("pet_choose_electric_dragon")
        .setLabel("⚡ Electric Dragon")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: "🥚 Hãy chọn hệ rồng của bạn:",
      components: [row],
      flags: 64
    });
  },

//////////////////////////////////////////////////////
// 🐲 CHỌN HỆ → MODAL
//////////////////////////////////////////////////////

  async handleChoose(interaction) {

    const type = interaction.customId.replace("pet_choose_", "");

    const modal = new ModalBuilder()
      .setCustomId(`pet_create_${type}`)
      .setTitle("Đặt tên cho rồng của bạn");

    const nameInput = new TextInputBuilder()
      .setCustomId("pet_name")
      .setLabel("Tên rồng")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(20)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput)
    );

    return interaction.showModal(modal);
  },

//////////////////////////////////////////////////////
// 🐉 TẠO PET + LẤY ẢNH TỪ PetEvolution
//////////////////////////////////////////////////////

  async handleModal(interaction) {

    if (!interaction.customId.startsWith("pet_create_")) return;

    const type = interaction.customId.replace("pet_create_", "");
    const config = PET_BASE[type];
    const petName = interaction.fields.getTextInputValue("pet_name");

    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      user = await User.create({ userId: interaction.user.id });
    }

    user.pet = {
      id: type,
      name: petName,
      element: config.element,
      race: "dragon",
      level: 1,
      exp: 0,
      expNeeded: 120,
      evolution: 0,
      stats: config.stats,
      createdAt: new Date()
    };

    await user.save();

    // 🔥 LẤY ẢNH LV1 TỪ DB
    const evo = await PetEvolution.findOne({
      petId: type,
      level: 1
    });

    const embed = new EmbedBuilder()
      .setTitle(`${config.icon} ${petName}`)
      .setDescription(`Hệ: **${config.element.toUpperCase()}**\nLevel: 1`)
      .setColor(config.color);

    if (evo?.image) embed.setThumbnail(evo.image);

    return interaction.reply({ embeds: [embed] });
  }

};