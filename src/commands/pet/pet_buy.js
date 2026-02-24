const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const { SHOP_ITEMS } = require("./pet_shop");

module.exports = {

  async handleButton(interaction) {

    if (interaction.customId === "pet_buy_menu") {

      const modal = new ModalBuilder()
        .setCustomId("pet_buy_confirm")
        .setTitle("Mua Item");

      const itemInput = new TextInputBuilder()
        .setCustomId("item_index")
        .setLabel("Nhập số thứ tự item")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const quantityInput = new TextInputBuilder()
        .setCustomId("quantity")
        .setLabel("Số lượng")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(itemInput),
        new ActionRowBuilder().addComponents(quantityInput)
      );

      return interaction.showModal(modal);
    }

  },

  async handleModal(interaction) {

    if (interaction.customId !== "pet_buy_confirm") return;

    const index = parseInt(interaction.fields.getTextInputValue("item_index")) - 1;
    const quantity = parseInt(interaction.fields.getTextInputValue("quantity"));

    if (!SHOP_ITEMS[index] || quantity <= 0)
      return interaction.reply({ content: "❌ Dữ liệu không hợp lệ!", flags: 64 });

    const item = SHOP_ITEMS[index];
    const total = item.price * quantity;

    return interaction.reply({
      content: `🛒 Bạn đã mua **${quantity} ${item.name}**\n💰 Tổng tiền: ${total.toLocaleString()}\n⭐ Nhận: ${item.exp * quantity} EXP`,
      flags: 64
    });
  }

};
