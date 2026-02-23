const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const User = require("../models/User");

const rooms = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("baicao")
    .setDescription("🃏 Tạo phòng bài cào")
    .addIntegerOption(option =>
      option.setName("songuoi")
        .setDescription("Số người chơi (tối đa 17)")
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName("tien")
        .setDescription("Tiền cược (tối đa 10.000)")
        .setRequired(true)),

  async execute(interaction) {
    const maxPlayers = interaction.options.getInteger("songuoi");
    const bet = interaction.options.getInteger("tien");

    if (maxPlayers < 2 || maxPlayers > 17) {
      return interaction.reply({
        content: "❌ Số người phải từ 2–17!",
        flags: 64,
      });
    }

    if (bet <= 0 || bet > 10000) {
      return interaction.reply({
        content: "❌ Tiền cược tối đa 10.000!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user || user.money < bet) {
      return interaction.reply({
        content: "❌ Bạn không đủ tiền!",
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("🃏 PHÒNG BÀI CÀO")
      .setDescription(
        `👑 Chủ phòng: <@${interaction.user.id}>\n` +
        `👥 Số người: 1/${maxPlayers}\n` +
        `💰 Cược: ${bet.toLocaleString("vi-VN")} VND\n\n` +
        `👉 Nhấn **Tham Gia** để chơi!`
      )
      .setFooter({ text: "HOP-BOT Casino 💎" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("baicao_join")
        .setLabel("🎮 Tham Gia")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true,
    });

    const message = msg.resource.message;

    rooms.set(message.id, {
      host: interaction.user.id,
      maxPlayers,
      bet,
      players: new Set([interaction.user.id]),
      started: false,
    });
  },

  async handleButton(interaction) {
    if (interaction.customId !== "baicao_join") return;

    const room = rooms.get(interaction.message.id);
    if (!room || room.started) return;

    if (room.players.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Bạn đã tham gia rồi!",
        flags: 64,
      });
    }

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user || user.money < room.bet) {
      return interaction.reply({
        content: "❌ Bạn không đủ tiền!",
        flags: 64,
      });
    }

    room.players.add(interaction.user.id);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setDescription(
        `👑 Chủ phòng: <@${room.host}>\n` +
        `👥 Số người: ${room.players.size}/${room.maxPlayers}\n` +
        `💰 Cược: ${room.bet.toLocaleString("vi-VN")} VND\n\n` +
        `👉 Nhấn **Tham Gia** để chơi!`
      );

    await interaction.update({ embeds: [embed] });

    // Đủ người -> bắt đầu
    if (room.players.size >= room.maxPlayers) {
      room.started = true;
      startGame(interaction.message, room);
    }
  },
};

async function startGame(message, room) {
  const channel = message.channel;

  await channel.send("⏳ Đủ người! Bắt đầu sau 10 giây...");

  setTimeout(async () => {
    const deck = createDeck();
    shuffle(deck);

    const results = [];
    let highest = 0;

    for (const playerId of room.players) {
      const cards = [deck.pop(), deck.pop(), deck.pop()];
      const score = calculateScore(cards);

      if (score > highest) highest = score;

      results.push({ playerId, cards, score });
    }

    const winners = results.filter(r => r.score === highest);

    const totalPot = room.bet * room.players.size;
    const winAmount = Math.floor(totalPot / winners.length);

    for (const playerId of room.players) {
      const user = await User.findOne({ userId: playerId });
      if (!user) continue;

      user.money -= room.bet;
      await user.save();
    }

    for (const w of winners) {
      const user = await User.findOne({ userId: w.playerId });
      if (!user) continue;

      user.money += winAmount;
      await user.save();
    }

    const resultText = results.map(r =>
      `<@${r.playerId}> | ${r.cards.join(" ")} | ${r.score} điểm`
    ).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🃏 KẾT QUẢ BÀI CÀO")
      .setDescription(
        `${resultText}\n\n🏆 Người thắng: ${winners.map(w => `<@${w.playerId}>`).join(", ")}`
      );

    await channel.send({ embeds: [embed] });

    rooms.delete(message.id);
    await message.delete().catch(() => {});
  }, 10000);
}

function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const deck = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push(value + suit);
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function calculateScore(cards) {
  let total = 0;

  for (const card of cards) {
    let value = card.slice(0, -1);

    if (["J","Q","K"].includes(value)) total += 10;
    else if (value === "A") total += 1;
    else total += parseInt(value);
  }

  return total % 10;
}
