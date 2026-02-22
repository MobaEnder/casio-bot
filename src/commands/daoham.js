const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const User = require("../models/User");

const games = new Map();

// ===== QUẶNG THEO TẦNG =====
const lowOres = [
  { name: "🪨 Đá thường", value: 10000 },
  { name: "🔹 Đá vôi", value: 15000 },
  { name: "🔷 Thạch anh", value: 20000 },
];

const midOres = [
  { name: "💎 Sapphire", value: 50000 },
  { name: "🔶 Ruby", value: 80000 },
  { name: "🟡 Vàng", value: 120000 },
];

const rareOres = [
  { name: "💠 Kim Cương", value: 250000 },
  { name: "👑 Ngọc Lục Bảo", value: 350000 },
  { name: "🔥 Hồng Ngọc Thượng Hạng", value: 500000 },
];

// ===== RANDOM QUẶNG =====
function getOreByFloor(floor) {
  if (floor <= 10)
    return lowOres[Math.floor(Math.random() * lowOres.length)];

  if (floor <= 20)
    return midOres[Math.floor(Math.random() * midOres.length)];

  return rareOres[Math.floor(Math.random() * rareOres.length)];
}

// ===== MULTIPLIER THEO TẦNG =====
function getMultiplier(floor) {
  if (floor <= 10)
    return Math.floor(Math.random() * 3) + 1; // x1-x3

  if (floor <= 20)
    return Math.floor(Math.random() * 5) + 2; // x2-x6

  return Math.floor(Math.random() * 6) + 4; // x4-x9
}

// ===== TỶ LỆ SẬP =====
function getRisk(floor) {
  if (floor <= 10)
    return 5 + floor; // 6% -> 15%

  if (floor <= 20)
    return 15 + (floor - 10) * 2; // 17% -> 35%

  return 35 + (floor - 20) * 2; // 37% -> ~67%
}

// ===== MÀU EMBED =====
function getColorByFloor(floor) {
  if (floor <= 10) return 0x2ecc71;
  if (floor <= 20) return 0xf1c40f;
  return 0xe74c3c;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daoham")
    .setDescription("⛏️ Đào hầm mạo hiểm 36 tầng"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("daoham_modal_invest")
      .setTitle("⛏️ Nhập tiền đầu tư");

    const input = new TextInputBuilder()
      .setCustomId("invest_amount")
      .setLabel("Số tiền bạn muốn đầu tư (VND)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (!interaction.customId.startsWith("daoham_modal_")) return;

    await interaction.deferReply();

    const amount = parseInt(
      interaction.fields.getTextInputValue("invest_amount")
    );

    if (isNaN(amount) || amount <= 0)
      return interaction.editReply("❌ Số tiền không hợp lệ!");

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.money < amount)
      return interaction.editReply("❌ Bạn không đủ tiền!");

    user.money -= amount;
    await user.save();

    const floor = 1;
    const ore = getOreByFloor(floor);
    const multi = getMultiplier(floor);
    const earned = ore.value * multi;

    games.set(interaction.user.id, {
      floor,
      total: earned,
      invested: amount,
    });

    const embed = new EmbedBuilder()
      .setColor(getColorByFloor(floor))
      .setTitle("⛏️ TẦNG 1")
      .setDescription(
        `💰 Đầu tư: **${amount.toLocaleString("vi-VN")} VND**\n\n` +
        `${ore.name} x${multi}\n` +
        `💎 Thu được: **${earned.toLocaleString("vi-VN")} VND**\n\n` +
        `🔥 Tổng hiện tại: **${earned.toLocaleString("vi-VN")} VND**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("daoham_continue")
        .setLabel("⛏️ Đào tiếp")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("daoham_stop")
        .setLabel("🏃 Rút lui")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  async handleButton(interaction) {
    const game = games.get(interaction.user.id);
    if (!game)
      return interaction.reply({ content: "❌ Game đã kết thúc!", flags: 64 });

    if (interaction.customId === "daoham_stop") {
      const user = await User.findOne({ userId: interaction.user.id });
      user.money += game.total;
      await user.save();

      games.delete(interaction.user.id);

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("🏆 RÚT LUI AN TOÀN")
            .setDescription(
              `💰 Bạn mang về **${game.total.toLocaleString("vi-VN")} VND**`
            ),
        ],
        components: [],
      });
    }

    if (interaction.customId === "daoham_continue") {
      game.floor++;

      if (game.floor > 36) {
        const user = await User.findOne({ userId: interaction.user.id });
        user.money += game.total * 2;
        await user.save();

        games.delete(interaction.user.id);

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffd700)
              .setTitle("👑 CHINH PHỤC 36 TẦNG!")
              .setDescription(
                `🎉 Thưởng x2: **${(game.total * 2).toLocaleString(
                  "vi-VN"
                )} VND**`
              ),
          ],
          components: [],
        });
      }

      const risk = getRisk(game.floor);

      if (Math.random() * 100 < risk) {
        games.delete(interaction.user.id);

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("💥 SẬP HẦM!")
              .setDescription(
                `❌ Bạn mất toàn bộ **${game.total.toLocaleString(
                  "vi-VN"
                )} VND**`
              ),
          ],
          components: [],
        });
      }

      const ore = getOreByFloor(game.floor);
      const multi = getMultiplier(game.floor);
      const earned = ore.value * multi;

      game.total += earned;

      const embed = new EmbedBuilder()
        .setColor(getColorByFloor(game.floor))
        .setTitle(`⛏️ TẦNG ${game.floor}`)
        .setDescription(
          `⚠️ Tỷ lệ sập: **${risk}%**\n\n` +
          `${ore.name} x${multi}\n` +
          `💎 Thu được: **${earned.toLocaleString("vi-VN")} VND**\n\n` +
          `🔥 Tổng hiện tại: **${game.total.toLocaleString("vi-VN")} VND**`
        );

      return interaction.update({ embeds: [embed] });
    }
  },
};
