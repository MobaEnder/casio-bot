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

const EMOJIS = {
  nai: "🦌",
  bau: "🎃",
  ga: "🐔",
  ca: "🐟",
  cua: "🦀",
  tom: "🦐",
};

const FACES = Object.keys(EMOJIS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("baucua")
    .setDescription("🎲 Tạo bàn Bầu Cua"),

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
      .setColor(0xff8800)
      .setTitle("🎲 BÀN BẦU CUA")
      .setDescription(
        "👉 Chọn **Nai, Bầu, Gà, Cá, Cua hoặc Tôm** để đặt cược!\n" +
        "⏳ Bàn sẽ lắc sau **30 giây**..."
      )
      .setFooter({ text: "BOT Casino 💎" })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("baucua_nai")
        .setLabel("🦌 Nai")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("baucua_bau")
        .setLabel("🎃 Bầu")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("baucua_ga")
        .setLabel("🐔 Gà")
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("baucua_ca")
        .setLabel("🐟 Cá")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("baucua_cua")
        .setLabel("🦀 Cua")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("baucua_tom")
        .setLabel("🦐 Tôm")
        .setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      withResponse: true,
    });

    const message = msg.resource.message;

    games.set(message.id, {
      bets: new Map(), // userId -> { face, amount }
      endsAt: Date.now() + 30000,
      channelId: interaction.channelId,
      messageId: message.id,
    });

    // ⏳ Kết thúc sau 30s
    setTimeout(async () => {
      const game = games.get(message.id);
      if (!game) return;

      // 🎲 LOGIC NÂNG CẤP TỈ LỆ 40% THẮNG - 60% THUA
      let rolls = [];
      
      // Lấy danh sách các mặt mà người chơi đã đặt cược
      const betFaces = Array.from(new Set(Array.from(game.bets.values()).map(b => b.face)));

      // Nếu không có ai cược, hoặc người chơi cược rải đều cả 6 mặt (không thể ép thua 100%) thì random bình thường
      if (betFaces.length === 0 || betFaces.length === FACES.length) {
        rolls = Array.from({ length: 3 }, () => FACES[Math.floor(Math.random() * FACES.length)]);
      } else {
        const isWin = Math.random() < 0.40; // 40% Thắng, 60% Thua

        if (isWin) {
          // Người chơi Thắng (40%): Đảm bảo ra ít nhất 1 mặt có người cược
          const winningFace = betFaces[Math.floor(Math.random() * betFaces.length)];
          rolls.push(winningFace); 
          // 2 viên còn lại random ngẫu nhiên
          rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
          rolls.push(FACES[Math.floor(Math.random() * FACES.length)]);
          
          // Trộn ngẫu nhiên thứ tự 3 xúc xắc
          rolls.sort(() => Math.random() - 0.5);
        } else {
          // Người chơi Thua (60%): Xúc xắc CHỈ ra các mặt mà KHÔNG AI CƯỢC
          const loseFaces = FACES.filter(f => !betFaces.includes(f));
          rolls = Array.from({ length: 3 }, () => loseFaces[Math.floor(Math.random() * loseFaces.length)]);
        }
      }

      const counts = {};
      for (const r of rolls) counts[r] = (counts[r] || 0) + 1;

      let winList = "";
      let loseList = "";

      for (const [userId, bet] of game.bets.entries()) {
        let user = await User.findOne({ userId });
        if (!user) continue;

        const hit = counts[bet.face] || 0;

        if (hit > 0) {
          const multiplier = hit + 0.5; // 🎯 1 con = x2 | 2 con = x3 | 3 con = x4
          const winAmount = bet.amount * multiplier;

          user.money += winAmount;
          user.stats.win++;

          winList += `✅ <@${userId}> +${winAmount.toLocaleString("vi-VN")} VND (${EMOJIS[bet.face]} x${multiplier})\n`;
        } else {
          user.money -= bet.amount;
          user.stats.lose++;

          loseList += `❌ <@${userId}> -${bet.amount.toLocaleString("vi-VN")} VND (${EMOJIS[bet.face]})\n`;
        }

        user.stats.gamblePlayed++;
        await user.save();
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("🎉 KẾT QUẢ BẦU CUA")
        .setDescription(
          `🎲 Kết quả: ${rolls.map(r => EMOJIS[r]).join(" ")}\n\n` +
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
    }, 30000);
  },

  async handleButton(interaction) {
    const game = games.get(interaction.message.id);
    if (!game) {
      return interaction.reply({
        content: "❌ Bàn này đã kết thúc!",
        flags: 64,
      });
    }

    const face = interaction.customId.split("_")[1];

    const modal = new ModalBuilder()
      .setCustomId(`baucua_modal_${face}`)
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
    const face = interaction.customId.split("_")[2];
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

    game.bets.set(interaction.user.id, { face, amount });

    await interaction.reply({
      content: `✅ Bạn đã đặt **${amount.toLocaleString("vi-VN")} VND** vào **${EMOJIS[face]} ${face.toUpperCase()}**`,
      flags: 64,
    });
  },
};
