const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const User = require("../models/User");

const games = new Map();
const MAX_FLOOR = 36;
const MIN_BET = 50000;

/* ======================= */
/* 🎯 TỈ LỆ XẬP THEO TẦNG */
/* ======================= */
function getCrashChance(floor) {
  if (floor >= 1 && floor <= 10) {
    return 1 + ((floor - 1) * (6 / 9));
  }
  if (floor >= 11 && floor <= 20) {
    return 7 + ((floor - 11) * (9 / 9));
  }
  if (floor >= 21 && floor <= 36) {
    return 16 + ((floor - 21) * (4 / 15));
  }
  return 20;
}

/* ======================= */
/* 🎲 TỈ LỆ TẦNG RỖNG */
/* ======================= */
function getEmptyChance(floor) {
  if (floor <= 10) return 25;   // 25% không có gì
  if (floor <= 20) return 20;   // 20%
  return 15;                    // 15%
}

/* ======================= */
/* ⛏️ RANDOM QUẶNG */
/* ======================= */
function getOreByFloor(floor) {
  let ores;

  if (floor <= 10) {
    ores = [
      { name: "🪨 Đá Thường", min: 5000, max: 20000 },
      { name: "🟤 Đồng", min: 8000, max: 20000 },
      { name: "⚙️ Sắt", min: 10000, max: 20000 },
      { name: "🔩 Bạc Thô", min: 12000, max: 20000 },
      { name: "💠 Thạch Anh", min: 15000, max: 20000 },
    ];
  } else if (floor <= 20) {
    ores = [
      { name: "🥈 Bạc", min: 30000, max: 50000 },
      { name: "🟡 Vàng", min: 35000, max: 50000 },
      { name: "🔷 Sapphire", min: 40000, max: 50000 },
      { name: "💎 Kim Cương Thô", min: 45000, max: 50000 },
      { name: "🔮 Đá Ma Thuật", min: 30000, max: 50000 },
    ];
  } else {
    ores = [
      { name: "💎 Kim Cương", min: 50000, max: 70000 },
      { name: "🟥 Ruby", min: 55000, max: 70000 },
      { name: "🟦 Ngọc Lam", min: 50000, max: 70000 },
      { name: "🟪 Thạch Tím", min: 60000, max: 70000 },
      { name: "👑 Quặng Huyền Thoại", min: 60000, max: 70000 },
    ];
  }

  const ore = ores[Math.floor(Math.random() * ores.length)];
  const baseValue =
    Math.floor(Math.random() * (ore.max - ore.min + 1)) + ore.min;

  const multiplier = Math.floor(Math.random() * 4) + 2; // x2 - x5

  return {
    name: ore.name,
    value: baseValue * multiplier,
    multiplier,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daoham")
    .setDescription("⛏️ Đào hầm kiếm quặng")
    .addIntegerOption(option =>
      option
        .setName("tien")
        .setDescription("Số tiền cược (tối thiểu 50.000)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger("tien");

    if (bet < MIN_BET) {
      return interaction.reply({
        content: "❌ Tiền cược tối thiểu là 50.000 VND!",
        ephemeral: true,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.money < bet) {
      return interaction.reply({
        content: "❌ Bạn không đủ tiền!",
        ephemeral: true,
      });
    }

    user.money -= bet;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⛏️ ĐÀO HẦM BẮT ĐẦU")
      .setDescription(
        `💰 Tiền cược: **${bet.toLocaleString("vi-VN")} VND**\n\n` +
        `📍 Tầng hiện tại: **0**\n` +
        `👉 Nhấn ĐÀO để bắt đầu!`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("daoham_continue")
        .setLabel("⛏️ ĐÀO")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("daoham_cashout")
        .setLabel("💰 RÚT TIỀN")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    games.set(msg.id, {
      userId: interaction.user.id,
      bet,
      floor: 0,
      totalReward: 0,
    });
  },

  async handleButton(interaction) {
    await interaction.deferUpdate();

    const game = games.get(interaction.message.id);
    if (!game) return;
    if (interaction.user.id !== game.userId) return;

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) return;

    if (interaction.customId === "daoham_continue") {
      game.floor++;

      const crashChance = getCrashChance(game.floor);
      const crash = Math.random() * 100 < crashChance;

      if (crash) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("💥 XẬP HẦM!")
          .setDescription(
            `📍 Bạn chết ở tầng **${game.floor}**\n` +
            `💀 Mất: **${game.bet.toLocaleString("vi-VN")} VND**`
          );

        await interaction.editReply({ embeds: [embed], components: [] });
        games.delete(interaction.message.id);
        return;
      }

      // 🎲 Kiểm tra tầng rỗng
      const emptyChance = getEmptyChance(game.floor);
      const isEmpty = Math.random() * 100 < emptyChance;

      if (isEmpty) {
        const embed = new EmbedBuilder()
          .setColor(0xffff00)
          .setTitle("⛏️ ĐÀO TRÚNG TẦNG RỖNG!")
          .setDescription(
            `📍 Tầng: **${game.floor}**\n` +
            `😢 Không tìm thấy gì...`
          );

        await interaction.editReply({
          embeds: [embed],
          components: new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("daoham_continue")
              .setLabel("⛏️ ĐÀO TIẾP")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("daoham_cashout")
              .setLabel("💰 RÚT TIỀN")
              .setStyle(ButtonStyle.Primary)
          ),
        });

        return;
      }

      const ore = getOreByFloor(game.floor);
      game.totalReward += ore.value;

      const embed = new EmbedBuilder()
        .setColor(0x00ffcc)
        .setTitle("⛏️ ĐÀO THÀNH CÔNG!")
        .setDescription(
          `📍 Tầng: **${game.floor}**\n\n` +
          `⛏️ Tìm thấy: **${ore.name}**\n` +
          `✨ Nhân: x${ore.multiplier}\n` +
          `💰 Giá trị: **${ore.value.toLocaleString("vi-VN")} VND**\n\n` +
          `📦 Tổng quặng: **${game.totalReward.toLocaleString("vi-VN")} VND**`
        );

      await interaction.editReply({
        embeds: [embed],
        components: new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("daoham_continue")
            .setLabel("⛏️ ĐÀO TIẾP")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("daoham_cashout")
            .setLabel("💰 RÚT TIỀN")
            .setStyle(ButtonStyle.Primary)
        ),
      });
    }

    if (interaction.customId === "daoham_cashout") {
      user.money += game.totalReward;
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("💰 RÚT TIỀN THÀNH CÔNG!")
        .setDescription(
          `📍 Dừng ở tầng: **${game.floor}**\n` +
          `📦 Tổng bán quặng: **${game.totalReward.toLocaleString("vi-VN")} VND**`
        );

      await interaction.editReply({ embeds: [embed], components: [] });
      games.delete(interaction.message.id);
    }
  },
};
