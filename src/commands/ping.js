const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Test bot hoạt động"),

  async execute(interaction) {
    await interaction.reply("🏓 Pong!");
  },
};
