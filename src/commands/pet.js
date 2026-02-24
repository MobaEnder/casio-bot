const shopHandler = require("./pet_shop");
const baloHandler = require("./pet_balo");
const buyHandler = require("./pet_buy");

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
      return shopHandler(interaction);

    if (interaction.customId === "pet_balo")
      return baloHandler(interaction);

    if (interaction.customId.startsWith("pet_buy_"))
      return buyHandler.handleButton(interaction);

  },

  async handleModal(interaction) {

    if (interaction.customId.startsWith("pet_buy_confirm_"))
      return buyHandler.handleModal(interaction);

  }

};
