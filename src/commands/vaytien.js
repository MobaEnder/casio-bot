const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vaytien")
    .setDescription("🏦 Yêu cầu vay tiền từ người khác")
    .addUserOption(opt =>
      opt.setName("nguoi").setDescription("Người bạn muốn vay").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("sotien").setDescription("Số tiền muốn vay").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName("thoihan")
        .setDescription("Thời hạn trả (giờ) — 1 đến 24")
        .setMinValue(1)
        .setMaxValue(24)
        .setRequired(true)
    ),

  async execute(interaction) {
    const borrower = interaction.user;
    const lender = interaction.options.getUser("nguoi");
    const amount = interaction.options.getInteger("sotien");
    const hours = interaction.options.getInteger("thoihan");

    if (lender.id === borrower.id)
      return interaction.reply({ content: "❌ Không thể vay chính mình.", flags: 64 });

    if (amount <= 0)
      return interaction.reply({ content: "❌ Số tiền không hợp lệ.", flags: 64 });

    const borrowerData = await User.findOneAndUpdate(
      { userId: borrower.id },
      {},
      { upsert: true, new: true }
    );

    if (borrowerData.loan.active) {
      return interaction.reply({
        content: "❌ Bạn đang có khoản vay chưa trả!",
        flags: 64,
      });
    }

    const lenderData = await User.findOneAndUpdate(
      { userId: lender.id },
      {},
      { upsert: true, new: true }
    );

    if (lenderData.money < amount) {
      return interaction.reply({
        content: "❌ Người này không đủ tiền để cho vay.",
        flags: 64,
      });
    }

    const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("📜 HỢP ĐỒNG VAY TIỀN")
      .setDescription(
        `👤 **Người vay:** ${borrower}\n` +
        `💸 **Số tiền:** ${amount.toLocaleString()} VND\n` +
        `⏳ **Thời hạn:** ${hours} giờ\n\n` +
        `⛔ **Cảnh báo:** Không trả đúng hạn sẽ bị **CẤM VĨNH VIỄN** khỏi hệ thống cược!`
      )
      .setFooter({ text: "HOP BOT • Loan System" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vaytien:accept:${borrower.id}:${lender.id}:${amount}:${dueAt.getTime()}`)
        .setLabel("✅ Đồng ý")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`vaytien:decline:${borrower.id}:${lender.id}`)
        .setLabel("❌ Từ chối")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      content: `${lender}, bạn có đồng ý cho ${borrower} vay không?`,
      embeds: [embed],
      components: [row],
    });
  },

  // ================= BUTTON HANDLER =================
  async handleButton(interaction) {
    const [cmd, action, borrowerId, lenderId, amount, dueAt] =
      interaction.customId.split(":");

    if (cmd !== "vaytien") return;

    if (interaction.user.id !== lenderId) {
      return interaction.reply({
        content: "❌ Chỉ **người cho vay** mới có thể bấm nút này!",
        flags: 64,
      });
    }

    const borrower = await User.findOne({ userId: borrowerId });
    const lender = await User.findOne({ userId: lenderId });

    if (!borrower || !lender)
      return interaction.reply({ content: "❌ Không tìm thấy dữ liệu.", flags: 64 });

    if (borrower.loan.active) {
      return interaction.reply({
        content: "❌ Người này đã có khoản vay khác!",
        flags: 64,
      });
    }

    if (action === "decline") {
      return interaction.update({
        content: "❌ Hợp đồng vay đã bị từ chối.",
        embeds: [],
        components: [],
      });
    }

    if (action === "accept") {
      const amt = Number(amount);

      if (lender.money < amt) {
        return interaction.reply({
          content: "❌ Bạn không còn đủ tiền để cho vay.",
          flags: 64,
        });
      }

      // Trừ tiền người cho vay
      lender.money -= amt;
      await lender.save();

      // Cộng tiền người vay + tạo khoản vay
      borrower.money += amt;
      borrower.loan = {
        active: true,
        from: lenderId,
        amount: amt,
        dueAt: new Date(Number(dueAt)),
      };
      await borrower.save();

      return interaction.update({
        content: "✅ **Hợp đồng vay đã được ký kết!**",
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle("💰 VAY TIỀN THÀNH CÔNG")
            .setDescription(
              `👤 <@${borrowerId}> đã vay **${amt.toLocaleString()} VND**\n` +
              `⏳ Hạn trả: <t:${Math.floor(Number(dueAt) / 1000)}:R>\n\n` +
              `⚠️ Không trả đúng hạn → **CẤM VĨNH VIỄN khỏi hệ thống cược!**`
            )
            .setFooter({ text: "HOP BOT • Loan System" })
            .setTimestamp(),
        ],
        components: [],
      });
    }
  },
};
