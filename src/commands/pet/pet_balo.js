module.exports = {

  async handleButton(interaction) {

    return interaction.update({
      content: "🎒 Balo hiện đang trống (chưa kết nối database).",
      components: []
    });

  }

};
