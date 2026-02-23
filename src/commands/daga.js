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

const games = new Map(); // messageId -> game
const FIGHT_TIME = 10000;
const BET_TIME = 30000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daga")
    .setDescription("🐔 Đá gà - Chọn Gà Đỏ hoặc Gà Đen để đặt cược!"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle("🐔 SÀN ĐẤU GÀ")
      .setDescription(
        "🎯 Chọn phe để đặt cược:\n\n" +
        "🔴 **GÀ ĐỎ**\n⚫ **GÀ ĐEN**\n\n" +
        "⏳ Thời gian đặt cược: **30 giây**"
      )
      .setFooter({ text: "BOT Casino 💎" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("daga_red")
        .setLabel("🔴 Gà Đỏ")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("daga_black")
        .setLabel("⚫ Gà Đen")
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      bets: new Map(), // userId -> { side, amount }
      channelId: interaction.channelId,
      messageId: message.id,
      endsAt: Date.now() + BET_TIME,
    });

    setTimeout(() => startFight(message), BET_TIME);
  },

  // ================= BUTTON =================
  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Trận đấu này đã kết thúc!",
        flags: 64,
      });
    }

    const side = interaction.customId === "daga_red" ? "red" : "black";

    const modal = new ModalBuilder()
      .setCustomId(`daga_modal_${side}`)
      .setTitle(`🐔 Đặt cược Gà ${side === "red" ? "Đỏ" : "Đen"}`);

    const input = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel("Số tiền cược")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 10000");

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },

  // ================= MODAL =================
  async handleModal(interaction) {
    const side = interaction.customId.split("_")[2];
    const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));

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

    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Trận đấu đã kết thúc!",
        flags: 64,
      });
    }

    game.bets.set(interaction.user.id, {
      side,
      amount,
    });

    await interaction.reply({
      content: `✅ Bạn đã đặt **${amount.toLocaleString("vi-VN")} VND** cho 🐔 **Gà ${side === "red" ? "Đỏ" : "Đen"}**`,
      flags: 64,
    });
  },
};

// ================= FIGHT ENGINE =================
async function startFight(message) {
  const game = games.get(message.id);
  if (!game) return;

  const frames = [
    "🐔🔴  ⚔️  ⚫🐔",
    "🐔🔴  💥  ⚫🐔",
    "🐔🔴💨     ⚫🐔",
    "🐔🔴   💥  ⚫🐔",
    "🐔🔴  ⚔️  ⚫🐔",
    "🐔🔴💥     ⚫🐔",
  ];

  const embed = new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle("🐔 TRẬN ĐẤU ĐANG DIỄN RA!")
    .setDescription(frames[0])
    .setFooter({ text: "HOP-BOT Casino 💎" })
    .setTimestamp();

  await message.edit({
    embeds: [embed],
    components: [],
  });

  let i = 0;
  const interval = setInterval(async () => {
    i++;
    embed.setDescription(frames[i % frames.length]);
    await message.edit({ embeds: [embed] });
  }, 1500);

  setTimeout(async () => {
    clearInterval(interval);
    const winner = Math.random() < 0.5 ? "red" : "black";
    await finishFight(message, winner);
  }, FIGHT_TIME);
}

async function finishFight(message, winnerSide) {
  const game = games.get(message.id);
  if (!game) return;

  let winPool = 0;
  let winners = [];

  for (const [userId, bet] of game.bets.entries()) {
    if (bet.side !== winnerSide) winPool += bet.amount;
  }

  for (const [userId, bet] of game.bets.entries()) {
    const user = await User.findOne({ userId });
    if (!user) continue;

    if (bet.side === winnerSide) {
      const share = Math.floor(winPool / [...game.bets.values()].filter(b => b.side === winnerSide).length);
      user.money += bet.amount + share;
      user.stats.win++;
      winners.push(`<@${userId}> +${(bet.amount + share).toLocaleString("vi-VN")} VND`);
    } else {
      user.money -= bet.amount;
      user.stats.lose++;
    }

    user.stats.gamblePlayed++;
    await user.save();
  }

  const embed = new EmbedBuilder()
    .setColor(winnerSide === "red" ? 0xff0000 : 0x000000)
    .setTitle("🏆 KẾT QUẢ ĐÁ GÀ")
    .setDescription(
      `🥇 **Gà thắng:** 🐔 ${winnerSide === "red" ? "Gà Đỏ 🔴" : "Gà Đen ⚫"}\n\n` +
      `💰 **Người thắng:**\n${winners.join("\n") || "Không ai 😭"}`
    )
    .setFooter({ text: "BOT Casino 💎" })
    .setTimestamp();

  await message.edit({
    embeds: [embed],
    components: [],
  });

  games.delete(message.id);
}
