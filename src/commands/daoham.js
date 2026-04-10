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
const MIN_BET = 200000;

/* ======================= */
/* 🎯 TỈ LỆ XẬP THEO TẦNG */
/* ======================= */
function getCrashChance(floor) {
  let base;
  if (floor <= 10) base = 1 + ((floor - 1) * (6 / 9));
  else if (floor <= 20) base = 7 + ((floor - 11) * (9 / 9));
  else base = 16 + ((floor - 21) * (4 / 15));

  return base * 1.3; // tăng 30%
}

/* ======================= */
/* 🎲 TỈ LỆ TẦNG RỖNG */
/* ======================= */
function getEmptyChance(floor) {
  if (floor <= 10) return 25;
  if (floor <= 20) return 20;
  return 15;
}

/* ======================= */
/* 🎨 MÀU THEO ĐỘ NGUY HIỂM */
/* ======================= */
function getColorByFloor(floor) {
  if (floor <= 10) return 0x00ff00; // xanh
  if (floor <= 20) return 0xffcc00; // vàng
  if (floor <= 30) return 0xff8800; // cam
  return 0xff0000; // đỏ
}

/* ======================= */
/* 📈 THANH TIẾN ĐỘ */
/* ======================= */
function getProgressBar(floor) {
  const totalBars = 18;
  const filled = Math.round((floor / MAX_FLOOR) * totalBars);
  const empty = totalBars - filled;

  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${floor}/${MAX_FLOOR}`;
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
  const multiplier = Math.floor(Math.random() * 4) + 2;

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

    if (bet < MIN_BET)
      return interaction.reply({
        content: "❌ Tiền cược tối thiểu là 200.000 VND!",
        flags: 64,
      });

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.money < bet)
      return interaction.reply({
        content: "❌ Bạn không đủ tiền!",
        flags: 64,
      });

    user.money -= bet;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("⛏️ ĐÀO HẦM BẮT ĐẦU")
      .setDescription(
        `💰 Tiền cược: **${bet.toLocaleString("vi-VN")} VND**\n\n` +
        `📍 Tầng: **0**\n` +
        `📈 ${getProgressBar(0)}`
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

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });

    const msg = await interaction.fetchReply();

    games.set(msg.id, {
      userId: interaction.user.id,
      bet,
      floor: 0,
      totalReward: 0,
      crashAt: null,
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
      const emptyChance = getEmptyChance(game.floor);

      if (Math.random() * 100 < crashChance) {
        game.crashAt = game.floor;

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("💥 XẬP HẦM!")
          .setDescription(
            `💀 Xập tại tầng: **${game.crashAt}**\n\n` +
            `💥 Tỉ lệ xập lúc chết: **${crashChance.toFixed(1)}%**\n` +
            `📈 ${getProgressBar(game.floor)}\n\n` +
            `💀 Mất: **${game.bet.toLocaleString("vi-VN")} VND**`
          );

        await interaction.editReply({ embeds: [embed], components: [] });
        games.delete(interaction.message.id);
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("daoham_continue")
          .setLabel("⛏️ ĐÀO TIẾP")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("daoham_cashout")
          .setLabel("💰 RÚT TIỀN")
          .setStyle(ButtonStyle.Primary)
      );

      if (Math.random() * 100 < emptyChance) {
        const embed = new EmbedBuilder()
          .setColor(getColorByFloor(game.floor))
          .setTitle("⛏️ TẦNG RỖNG!")
          .setDescription(
            `📍 Tầng: **${game.floor}**\n` +
            `💥 Tỉ lệ xập: **${crashChance.toFixed(1)}%**\n` +
            `🕳️ Tỉ lệ rỗng: **${emptyChance}%**\n\n` +
            `📈 ${getProgressBar(game.floor)}`
          );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      const ore = getOreByFloor(game.floor);
      game.totalReward += ore.value;

      const embed = new EmbedBuilder()
        .setColor(getColorByFloor(game.floor))
        .setTitle("⛏️ ĐÀO THÀNH CÔNG!")
        .setDescription(
          `📍 Tầng: **${game.floor}**\n` +
          `💥 Tỉ lệ xập: **${crashChance.toFixed(1)}%**\n` +
          `🕳️ Tỉ lệ rỗng: **${emptyChance}%**\n\n` +
          `⛏️ Quặng: **${ore.name}**\n` +
          `✨ x${ore.multiplier}\n` +
          `💰 +${ore.value.toLocaleString("vi-VN")} VND\n\n` +
          `📦 Tổng: **${game.totalReward.toLocaleString("vi-VN")} VND**\n` +
          `📈 ${getProgressBar(game.floor)}`
        );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (interaction.customId === "daoham_cashout") {
      user.money += game.totalReward;
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ffcc)
        .setTitle("💰 RÚT TIỀN THÀNH CÔNG!")
        .setDescription(
          `📍 Dừng tại tầng: **${game.floor}**\n` +
          `📦 Nhận: **${game.totalReward.toLocaleString("vi-VN")} VND**\n\n` +
          `📈 ${getProgressBar(game.floor)}`
        );

      await interaction.editReply({ embeds: [embed], components: [] });
      games.delete(interaction.message.id);
    }
  },
};
