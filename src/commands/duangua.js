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
const TRACK_LENGTH = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("duangua")
    .setDescription("🐎 Đua ngựa - Chọn ngựa từ 1 tới 10 và đặt cược!"),

  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id },
      {},
      { upsert: true, new: true }
    );

    if (user.banned) {
      return interaction.reply({
        content: "⛔ Bạn đã bị cấm vĩnh viễn khỏi hệ thống cược!",
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("🐎 TRƯỜNG ĐUA NGỰA")
      .setDescription(
        "🎯 Chọn **ngựa số 1 → 10** để đặt cược!\n" +
        "⏳ Cuộc đua sẽ bắt đầu sau **40 giây**...\n\n" +
        "🐎 Danh sách ngựa:\n" +
        "1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣\n" +
        "6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟"
      )
      .setFooter({ text: "BOT Casino 💎" })
      .setTimestamp();

    const rows = [];
    let row = new ActionRowBuilder();

    for (let i = 1; i <= 10; i++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`duangua_${i}`)
          .setLabel(`🐎 ${i}`)
          .setStyle(ButtonStyle.Primary)
      );

      if (i % 5 === 0 || i === 10) {
        rows.push(row);
        row = new ActionRowBuilder();
      }
    }

    const msg = await interaction.reply({
      embeds: [embed],
      components: rows,
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      bets: new Map(), // userId -> { horse, amount }
      channelId: interaction.channelId,
      messageId: message.id,
      endsAt: Date.now() + 40000,
    });

    // 🐎 BẮT ĐẦU ĐUA SAU 40s
    setTimeout(async () => startRace(message), 40000);
  },

  // ================= BUTTON =================
  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Cuộc đua này đã kết thúc!",
        flags: 64,
      });
    }

    const horse = Number(interaction.customId.split("_")[1]);

    const modal = new ModalBuilder()
      .setCustomId(`duangua_modal_${horse}`)
      .setTitle(`🐎 Đặt cược ngựa số ${horse}`);

    const input = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel("Số tiền cược (VND)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 5000");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  // ================= MODAL =================
  async handleModal(interaction) {
    const horse = Number(interaction.customId.split("_")[2]);
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
        content: "❌ Cuộc đua này đã kết thúc!",
        flags: 64,
      });
    }

    game.bets.set(interaction.user.id, {
      horse,
      amount,
    });

    await interaction.reply({
      content: `✅ Bạn đã đặt **${amount.toLocaleString("vi-VN")} VND** vào 🐎 **Ngựa số ${horse}**`,
      flags: 64,
    });
  },
};

// ================= RACE ENGINE =================
async function startRace(message) {
  const game = games.get(message.id);
  if (!game) return;

  const positions = Array(10).fill(0);
  let finished = false;

  const render = () => {
    let track = "";
    for (let i = 0; i < 10; i++) {
      const pos = positions[i];
      const bar = "━".repeat(pos) + "🐎" + " ".repeat(TRACK_LENGTH - pos);
      track += `**${i + 1}** |${bar}|🏁\n`;
    }
    return track;
  };

  const embed = new EmbedBuilder()
    .setColor(0x00ff99)
    .setTitle("🐎 CUỘC ĐUA ĐANG DIỄN RA!")
    .setDescription(render())
    .setFooter({ text: "BOT Casino 💎" })
    .setTimestamp();

  await message.edit({
    embeds: [embed],
    components: [],
  });

  const interval = setInterval(async () => {
    if (finished) return;

    for (let i = 0; i < 10; i++) {
      positions[i] += Math.random() < 0.6 ? 1 : 0;
      if (positions[i] >= TRACK_LENGTH) {
        finished = true;
      }
    }

    const leader = positions.indexOf(Math.max(...positions));
    embed.setDescription(render());
    await message.edit({ embeds: [embed] });

    if (finished) {
      clearInterval(interval);
      const winner = leader + 1;
      await finishRace(message, winner);
    }
  }, 2000); // cập nhật mỗi 2s → ~40s tổng
}

async function finishRace(message, winnerHorse) {
  const game = games.get(message.id);
  if (!game) return;

  let winList = "";
  let loseList = "";

  for (const [userId, bet] of game.bets.entries()) {
    const user = await User.findOne({ userId });
    if (!user) continue;

    if (bet.horse === winnerHorse) {
      const winAmount = bet.amount * 10;
      user.money += winAmount;
      user.stats.win++;
      winList += `✅ <@${userId}> +${winAmount.toLocaleString("vi-VN")} VND (🐎 ${winnerHorse})\n`;
    } else {
      user.money -= bet.amount;
      user.stats.lose++;
      loseList += `❌ <@${userId}> -${bet.amount.toLocaleString("vi-VN")} VND (🐎 ${bet.horse})\n`;
    }

    user.stats.gamblePlayed++;
    await user.save();
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(0xff8800)
    .setTitle("🏁 KẾT QUẢ ĐUA NGỰA")
    .setDescription(
      `🥇 **Ngựa thắng:** 🐎 ${winnerHorse}\n\n` +
      `🏆 **Người thắng:**\n${winList || "Không ai 😢"}\n` +
      `💀 **Người thua:**\n${loseList || "Không ai 😎"}`
    )
    .setFooter({ text: "BOT Casino 💎" })
    .setTimestamp();

  await message.edit({
    embeds: [resultEmbed],
    components: [],
  });

  games.delete(message.id);
}
