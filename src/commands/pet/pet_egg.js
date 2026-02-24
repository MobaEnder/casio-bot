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

//////////////////////////////////////////////////////
// 🎨 PET CONFIG
//////////////////////////////////////////////////////

const PET_CONFIG = {
  fire_dragon: {
    id: "fire_dragon",
    element: "fire",
    icon: "🔥",
    color: 0xff4500,
    stats: { hp: 120, atk: 20, def: 8, spd: 10 },
    images: {
      1: "https://static.wikia.nocookie.net/dragoncity/images/b/b2/Heatwave_Dragon_1.png/revision/latest?cb=20240607143449",
      30: "https://static.wikia.nocookie.net/dragoncity/images/8/8a/Heatwave_Dragon_2.png/revision/latest?cb=20240607143513",
      60: "https://static.wikia.nocookie.net/dragoncity/images/0/03/Burning_Dragon_.png/revision/latest?cb=20140219112656"
    }
  },

  water_dragon: {
    id: "water_dragon",
    element: "water",
    icon: "🌊",
    color: 0x0099ff,
    stats: { hp: 150, atk: 12, def: 18, spd: 8 },
    images: {
      1: "https://static.wikia.nocookie.net/dragoncity/images/b/b9/Elements_Dragon_1.png/revision/latest?cb=20250609023334",
      30: "https://static.wikia.nocookie.net/dragoncity/images/2/2d/Elements_Dragon_2.png/revision/latest?cb=20140610174414",
      60: "https://static.wikia.nocookie.net/dragoncity/images/4/47/Elements_Dragon_3.png/revision/latest?cb=20250609023547"
    }
  },

  electric_dragon: {
    id: "electric_dragon",
    element: "electric",
    icon: "⚡",
    color: 0xffd700,
    stats: { hp: 100, atk: 15, def: 10, spd: 20 },
    images: {
      1: "https://static.wikia.nocookie.net/dragoncity/images/a/ad/Electric_Dragon_1.png/revision/latest?cb=20250120094618",
      30: "https://static.wikia.nocookie.net/dragoncity/images/5/5a/Electric_Dragon_2.png/revision/latest?cb=20250120094651",
      60: "https://static.wikia.nocookie.net/dragoncity/images/f/f0/Electric_Dragon_3.png/revision/latest?cb=20250120094737"
    }
  }
};

//////////////////////////////////////////////////////
// 🥚 HANDLE BUTTON
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
// 🐲 CHỌN HỆ → MODAL ĐẶT TÊN
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
// 🐉 TẠO PET
//////////////////////////////////////////////////////

  async handleModal(interaction) {

    if (!interaction.customId.startsWith("pet_create_")) return;

    const type = interaction.customId.replace("pet_create_", "");
    const config = PET_CONFIG[type];
    const petName = interaction.fields.getTextInputValue("pet_name");

    let user = await User.findOne({ userId: interaction.user.id });

    if (!user) {
      user = await User.create({ userId: interaction.user.id });
    }

    user.pet = {
      id: config.id,
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

    const embed = new EmbedBuilder()
      .setTitle(`${config.icon} ${petName}`)
      .setDescription(`Hệ: **${config.element.toUpperCase()}**\nLevel: 1`)
      .setColor(config.color)
      .setThumbnail(config.images[1]);

    return interaction.reply({ embeds: [embed] });
  }

};