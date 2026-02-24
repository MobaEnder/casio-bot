const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require("discord.js");

const shop = require("./pet/pet_shop");
const buy = require("./pet/pet_buy");
const balo = require("./pet/pet_balo");
const egg = require("./pet/pet_egg");

module.exports = {

  data: new SlashCommandBuilder()
    .setName("thucung")
    .setDescription("Quản lý thú cưng"),

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

        new ButtonBuilder()
  .setCustomId("pet_egg")
  .setLabel("🥚 Nhận Pet")
  .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: "🐲 **MENU THÚ CƯNG**",
      components: [row]
    });
  },

  //////////////////////////////////////////////////////
  // 🔘 BUTTON
  //////////////////////////////////////////////////////
  async handleButton(interaction) {

    if (interaction.customId === "pet_shop")
      return shop.handleButton(interaction);

    if (interaction.customId === "pet_balo")
      return balo.handleButton(interaction);

    if (interaction.customId === "pet_buy_menu")
      return buy.handleButton(interaction);
    
    if (interaction.customId === "pet_egg")
  return egg.handleButton(interaction);

if (interaction.customId.startsWith("pet_choose_"))
  return egg.handleChoose(interaction);

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
  // 📝 MODAL
  //////////////////////////////////////////////////////
  async handleModal(interaction) {

    if (interaction.customId === "pet_buy_confirm")
      return buy.handleModal(interaction);

    if (interaction.customId.startsWith("pet_create_"))
  return egg.handleModal(interaction);

  }

};
