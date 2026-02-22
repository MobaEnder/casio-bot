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

const games = new Map(); // messageId -> game data

// ===== DATA QUẶNG =====
const ores = [
  { name: "🪨 Đá thường", value: 10000, chance: 30 },
  { name: "🔷 Thạch anh", value: 20000, chance: 25 },
  { name: "💎 Sapphire", value: 50000, chance: 20 },
  { name: "🔶 Ruby", value: 100000, chance: 12 },
  { name: "🟡 Vàng", value: 200000, chance: 8 },
  { name: "💠 Kim Cương", value: 500000, chance: 5 },
];

function getRandomOre() {
  const rand = Math.random() * 100;
  let sum = 0;
  for (const ore of ores) {
    sum += ore.chance;
    if (rand <= sum) return ore;
  }
  return ores[0];
}

function randomMultiplier() {
  return Math.floor(Math.random() * 9) + 1;
}

function getRisk(floor) {
  return Math.min(10 + floor * 2, 75);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daoham")
    .setDescription("⛏️ Đào hầm kiếm tiền mạo hiểm"),

  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id },
      {},
      { upsert: true, new: true }
    );

    if (user.banned) {
      return interaction.reply({
        content: "⛔ Bạn đã bị cấm khỏi hệ thống!",
        flags: 64,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("daoham_invest")
      .setTitle("⛏️ Nhập tiền đầu tư");

    const input = new TextInputBuilder()
      .setCustomId("invest_amount")
      .setLabel("Số tiền bạn muốn đầu tư (VND)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 50000");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (interaction.customId !== "daoham_invest") return;

    const amount = parseInt(
      interaction.fields.getTextInputValue("invest_amount")
    );

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Số tiền không hợp lệ!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    if (user.money < amount) {
      return interaction.reply({
        content: "❌ Bạn không đủ tiền!",
        flags: 64,
      });
    }

    user.money -= amount;
    await user.save();

    const ore = getRandomOre();
    const multi = randomMultiplier();
    const earned = ore.value * multi;

    const floor = 1;
    const total = earned;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("⛏️ ĐÀO HẦM TẦNG 1")
      .setDescription(
        `💰 Đầu tư: **${amount.toLocaleString("vi-VN")} VND**\n\n` +
        `${ore.name} x${multi}\n` +
        `💎 Thu được: **${earned.toLocaleString("vi-VN")} VND**\n\n` +
        `🔥 Tổng hiện tại: **${total.toLocaleString("vi-VN")} VND**`
      )
      .setFooter({ text: "Tiếp tục đào hay rút lui?" })
      .setTimestamp();

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

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      userId: interaction.user.id,
      floor,
      total,
      invested: amount,
    });
  },

  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Game đã kết thúc!",
        flags: 64,
      });
    }

    if (interaction.user.id !== game.userId) {
      return interaction.reply({
        content: "❌ Không phải lượt của bạn!",
        flags: 64,
      });
    }

    if (interaction.customId === "daoham_stop") {
      const user = await User.findOne({ userId: interaction.user.id });
      user.money += game.total;
      await user.save();

      games.delete(interaction.message.id);

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("🏆 RÚT LUI AN TOÀN")
            .setDescription(
              `💰 Bạn mang về **${game.total.toLocaleString(
                "vi-VN"
              )} VND**`
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

        games.delete(interaction.message.id);

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffd700)
              .setTitle("👑 CHINH PHỤC 36 TẦNG!")
              .setDescription(
                `🎉 Nhận thưởng x2: **${(
                  game.total * 2
                ).toLocaleString("vi-VN")} VND**`
              ),
          ],
          components: [],
        });
      }

      const risk = getRisk(game.floor);

      if (Math.random() * 100 < risk) {
        games.delete(interaction.message.id);

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

      const ore = getRandomOre();
      const multi = randomMultiplier();
      const earned = ore.value * multi;

      game.total += earned;

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`⛏️ ĐÀO HẦM TẦNG ${game.floor}`)
        .setDescription(
          `⚠️ Tỷ lệ sập: **${risk}%**\n\n` +
          `${ore.name} x${multi}\n` +
          `💎 Thu được: **${earned.toLocaleString("vi-VN")} VND**\n\n` +
          `🔥 Tổng hiện tại: **${game.total.toLocaleString("vi-VN")} VND**`
        )
        .setTimestamp();

      return interaction.update({
        embeds: [embed],
      });
    }
  },
};
