const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tratien")
    .setDescription("💸 Trả tiền vay cho người khác"),

  async execute(interaction) {
    const borrowerId = interaction.user.id;

    const borrower = await User.findOne({ userId: borrowerId });
    if (!borrower || !borrower.loan.active) {
      return interaction.reply({
        content: "❌ Bạn hiện không có khoản vay nào!",
        flags: 64,
      });
    }

    const lenderId = borrower.loan.from;
    const amount = borrower.loan.amount;

    if (borrower.money < amount) {
      return interaction.reply({
        content: `❌ Bạn không đủ tiền để trả nợ! Cần **${amount.toLocaleString()} VND**`,
        flags: 64,
      });
    }

    const lender = await User.findOneAndUpdate(
      { userId: lenderId },
      { $inc: { money: amount } },
      { upsert: true, new: true }
    );

    borrower.money -= amount;
    borrower.loan = {
      active: false,
      from: null,
      amount: 0,
      dueAt: null,
    };
    borrower.banned = false;

    await borrower.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("✅ TRẢ NỢ THÀNH CÔNG")
      .setDescription(
        `💸 Bạn đã trả **${amount.toLocaleString()} VND** cho <@${lenderId}>`
      )
      .setFooter({ text: "HOP-BOT Casino 💎" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
