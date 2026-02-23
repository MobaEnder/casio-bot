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

// 🎯 TÍNH % XẬP THEO TẦNG
function getCrashChance(floor) {
  if (floor >= 1 && floor <= 10) {
    return 1 + ((floor - 1) * (6 / 9)); // 1% -> 7%
  }

  if (floor >= 11 && floor <= 20) {
    return 7 + ((floor - 11) * (9 / 9)); // 7% -> 16%
  }

  if (floor >= 21 && floor <= 36) {
    return 16 + ((floor - 21) * (4 / 15)); // 16% -> 20%
  }

  return 20;
}

// 💰 TÍNH HỆ SỐ NHÂN THEO TẦNG
function getMultiplier(floor) {
  return 1 + floor * 0.25;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daoham")
    .setDescription("⛏️ Đào hầm kiếm tiền")
    .addIntegerOption(option =>
      option
        .setName("tien")
        .setDescription("Số tiền cược")
        .setRequired(true)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger("tien");

    if (bet <= 0) {
      return interaction.reply({
        content: "❌ Số tiền không hợp lệ!",
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
        `📍 Đang ở tầng: **0**\n` +
        `👉 Nhấn **ĐÀO** để bắt đầu!`
      )
      .setFooter({ text: "BOT Casino 💎" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("dao_continue")
        .setLabel("⛏️ ĐÀO")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("dao_cashout")
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
    });
  },

  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) return;

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        content: "❌ Không phải lượt của bạn!",
        ephemeral: true,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) return;

    // ⛏️ ĐÀO
    if (interaction.customId === "dao_continue") {
      game.floor++;

      const crashChance = getCrashChance(game.floor);
      const crash = Math.random() * 100 < crashChance;

      if (crash) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("💥 XẬP HẦM!")
          .setDescription(
            `📍 Bạn đã chết ở tầng **${game.floor}**\n` +
            `💀 Mất toàn bộ: **${game.bet.toLocaleString("vi-VN")} VND**\n` +
            `🎯 Tỉ lệ xập tầng này: **${crashChance.toFixed(2)}%**`
          )
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: [],
        });

        games.delete(interaction.message.id);
        return;
      }

      if (game.floor >= MAX_FLOOR) {
        const reward = Math.floor(game.bet * getMultiplier(game.floor));
        user.money += reward;
        await user.save();

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🏆 ĐÀO TỚI ĐÁY HẦM!")
          .setDescription(
            `📍 Tầng: **${game.floor}**\n` +
            `💰 Nhận: **${reward.toLocaleString("vi-VN")} VND**`
          )
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: [],
        });

        games.delete(interaction.message.id);
        return;
      }

      const multiplier = getMultiplier(game.floor);
      const currentWin = Math.floor(game.bet * multiplier);

      const embed = new EmbedBuilder()
        .setColor(0x00ffcc)
        .setTitle("⛏️ ĐÀO THÀNH CÔNG!")
        .setDescription(
          `📍 Tầng hiện tại: **${game.floor}**\n` +
          `🎯 Tỉ lệ xập: **${crashChance.toFixed(2)}%**\n` +
          `💰 Nếu rút bây giờ: **${currentWin.toLocaleString("vi-VN")} VND**`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dao_continue")
          .setLabel("⛏️ ĐÀO TIẾP")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("dao_cashout")
          .setLabel("💰 RÚT TIỀN")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.update({
        embeds: [embed],
        components: [row],
      });
    }

    // 💰 RÚT TIỀN
    if (interaction.customId === "dao_cashout") {
      const multiplier = getMultiplier(game.floor);
      const reward = Math.floor(game.bet * multiplier);

      user.money += reward;
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("💰 RÚT TIỀN THÀNH CÔNG!")
        .setDescription(
          `📍 Dừng ở tầng: **${game.floor}**\n` +
          `💵 Nhận: **${reward.toLocaleString("vi-VN")} VND**`
        )
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: [],
      });

      games.delete(interaction.message.id);
    }
  },
};
