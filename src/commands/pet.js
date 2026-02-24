const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const shop = require("./pet/pet_shop");
const buy = require("./pet/pet_buy");
const balo = require("./pet/pet_balo");

module.exports = {

  data: {
    name: "thucung",
    description: "Quản lý thú cưng"
  },

  //////////////////////////////////////////////////////
  // 🚀 SLASH COMMAND
  //////////////////////////////////////////////////////
  async execute(interaction) {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_shop")
        .setLabel("🏪 Shop")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("pet_balo")
        .setLabel("🎒 Balo")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: "🐲 **MENU THÚ CƯNG**",
      components: [row]
    });
  },

  //////////////////////////////////////////////////////
  // 🔘 BUTTON HANDLER
  //////////////////////////////////////////////////////
  async handleButton(interaction) {

    // MỞ SHOP
    if (interaction.customId === "pet_shop")
      return shop.handleButton(interaction);

    // MỞ BALO
    if (interaction.customId === "pet_balo")
      return balo.handleButton(interaction);

    // MỞ MODAL MUA
    if (interaction.customId === "pet_buy_menu")
      return buy.handleButton(interaction);

    // QUAY LẠI MENU
    if (interaction.customId === "pet_menu_back") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pet_shop")
          .setLabel("🏪 Shop")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("pet_balo")
          .setLabel("🎒 Balo")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        content: "🐲 **MENU THÚ CƯNG**",
        components: [row]
      });
    }

  },

  //////////////////////////////////////////////////////
  // 📝 MODAL HANDLER
  //////////////////////////////////////////////////////
  async handleModal(interaction) {

    if (interaction.customId === "pet_buy_confirm")
      return buy.handleModal(interaction);

  }

};
