const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const shop = require("./pet/pet_shop");
const balo = require("./pet/pet_balo");
const main = require("./pet/pet_main");

module.exports = {

  data: {
    name: "thucung",
    description: "Quản lý thú cưng"
  },

  async execute(interaction) {

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_shop")
        .setLabel("Shop")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("pet_balo")
        .setLabel("Balo")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: "🐲 Menu Thú Cưng",
      components: [row]
    });
  },

  async handleButton(interaction) {

    if (interaction.customId === "pet_shop")
      return shop.handleButton(interaction);

    if (interaction.customId === "pet_balo")
      return balo.handleButton(interaction);

  },

  async handleModal(interaction) {

    if (interaction.customId.startsWith("pet_buy_confirm_"))
      return shop.handleModal(interaction);

  }

};
