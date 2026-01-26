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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("taixiu")
    .setDescription("🎲 Tạo bàn Tài Xỉu"),

  async execute(interaction) {
    const user = await User.findOneAndUpdate(
  { userId: interaction.user.id },
  {},
  { upsert: true, new: true }
);

if (user.banned) {
  return interaction.reply({
    content: "⛔ Bạn đã bị cấm vĩnh viễn khỏi hệ thống cược do không trả nợ!",
    flags: 64,
  });
}

    const embed = new EmbedBuilder()
      .setColor(0x00bfff)
      .setTitle("🎲 BÀN TÀI XỈU")
      .setDescription(
        "👉 Chọn **TÀI** hoặc **XỈU** để tham gia!\n" +
        "⏳ Bàn sẽ mở trong **20 giây**..."
      )
      .setFooter({ text: "HOP-BOT Casino 💎" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("taixiu_tai")
        .setLabel("🔥 TÀI")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("taixiu_xiu")
        .setLabel("❄️ XỈU")
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row],
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      bets: new Map(), // userId -> { choice, amount }
      endsAt: Date.now() + 20000,
      channelId: interaction.channelId,
      messageId: message.id,
    });

    // ⏳ Kết thúc sau 20s
    setTimeout(async () => {
      const game = games.get(message.id);
      if (!game) return;

      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const dice3 = Math.floor(Math.random() * 6) + 1;
      const sum = dice1 + dice2 + dice3;
      const result = sum >= 11 ? "tai" : "xiu";

      let winList = "";
      let loseList = "";

      for (const [userId, bet] of game.bets.entries()) {
        let user = await User.findOne({ userId });
        if (!user) continue;

        if (bet.choice === result) {
          user.money += bet.amount;
          user.stats.win++;
          winList += `✅ <@${userId}> +${bet.amount.toLocaleString("vi-VN")} VND\n`;
        } else {
          user.money -= bet.amount;
          user.stats.lose++;
          loseList += `❌ <@${userId}> -${bet.amount.toLocaleString("vi-VN")} VND\n`;
        }

        user.stats.gamblePlayed++;
        await user.save();
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(result === "tai" ? 0x00ff00 : 0x3399ff)
        .setTitle("🎉 KẾT QUẢ TÀI XỈU")
        .setDescription(
          `🎲 Xúc xắc: **${dice1} - ${dice2} - ${dice3}**\n` +
          `🔢 Tổng: **${sum}** → **${result === "tai" ? "🔥 TÀI" : "❄️ XỈU"}**\n\n` +
          `🏆 **Người thắng:**\n${winList || "Không ai 😢"}\n` +
          `💀 **Người thua:**\n${loseList || "Không ai 😎"}`
        )
        .setFooter({ text: "HOP-BOT Casino 💎" })
        .setTimestamp();

      await message.edit({
        embeds: [resultEmbed],
        components: [],
      });

      games.delete(message.id);
    }, 20000);
  },

  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Bàn này đã kết thúc!",
        flags: 64,
      });
    }

    const choice = interaction.customId === "taixiu_tai" ? "tai" : "xiu";

    const modal = new ModalBuilder()
      .setCustomId(`taixiu_modal_${choice}`)
      .setTitle("💰 Nhập số tiền cược");

    const input = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel("Số tiền bạn muốn cược (VND)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ví dụ: 1000");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const choice = interaction.customId.endsWith("tai") ? "tai" : "xiu";
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
        content: "❌ Bạn không đủ tiền để cược!",
        flags: 64,
      });
    }

    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Bàn này đã kết thúc!",
        flags: 64,
      });
    }

    game.bets.set(interaction.user.id, { choice, amount });

    await interaction.reply({
      content: `✅ Bạn đã đặt **${amount.toLocaleString("vi-VN")} VND** vào **${choice === "tai" ? "🔥 TÀI" : "❄️ XỈU"}**`,
      flags: 64,
    });
  },
};
