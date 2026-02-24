const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const User = require("../../models/User");
const PetEvolution = require("../../models/PetEvolution");

//////////////////////////////////////////////////////
// 🎯 LẤY LEVEL EVOLUTION
//////////////////////////////////////////////////////

function getEvolutionLevel(level) {
  if (level >= 60) return 60;
  if (level >= 30) return 30;
  return 1;
}

//////////////////////////////////////////////////////
// 🎒 HANDLE BUTTON
//////////////////////////////////////////////////////

module.exports = {

  async handleButton(interaction) {

    const user = await User.findOne({ userId: interaction.user.id });

    if (!user?.pet?.id) {
      return interaction.reply({
        content: "❌ Bạn chưa có pet!",
        flags: 64
      });
    }

    const evoLevel = getEvolutionLevel(user.pet.level);

    const evo = await PetEvolution.findOne({
      petId: user.pet.id,
      level: evoLevel
    });

    const embed = new EmbedBuilder()
      .setTitle(`🐲 ${user.pet.name}`)
      .setDescription(
        `Hệ: **${user.pet.element.toUpperCase()}**\n` +
        `Level: **${user.pet.level}**\n` +
        `EXP: ${user.pet.exp}/${user.pet.expNeeded}\n\n` +
        `❤️ HP: ${user.pet.stats.hp}\n` +
        `⚔ ATK: ${user.pet.stats.atk}\n` +
        `🛡 DEF: ${user.pet.stats.def}\n` +
        `💨 SPD: ${user.pet.stats.spd}`
      )
      .setColor(0xffffff);

    if (evo?.image) embed.setThumbnail(evo.image);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pet_menu_back")
        .setLabel("⬅ Quay lại")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64
    });
  }

};