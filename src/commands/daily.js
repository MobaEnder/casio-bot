const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("🎁 Nhận tiền thưởng mỗi ngày"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const now = new Date();
    const cooldown = 24 * 60 * 60 * 1000;

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    // 🛡️ Fix lỗi date object cũ
    if (user.lastDaily && !(user.lastDaily instanceof Date)) {
      user.lastDaily = new Date(user.lastDaily);
    }

    if (user.lastDaily && now - user.lastDaily < cooldown) {
      const remain = cooldown - (now - user.lastDaily);
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setTitle("⏳ Daily chưa sẵn sàng!")
            .setDescription(`Quay lại sau **${h}h ${m}p** nữa nhé!`)
            .setFooter({ text: "HOP BOT • Daily Reward" }),
        ],
        flags: 64,
      });
    }

    // 🎁 Reward random
    const reward = Math.floor(Math.random() * 150001) + 50000; // 50k → 200k

    user.money += reward;
    user.lastDaily = now;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🎉 DAILY REWARD!")
      .setDescription(
        `💸 Bạn nhận được **${reward.toLocaleString("vi-VN")} VND**\n💰 Số dư: **${user.money.toLocaleString("vi-VN")} VND**`
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/10384/10384161.png")
      .setFooter({ text: "HOP BOT • Daily System" })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], withResponse: true });
    setTimeout(() => msg.resource.message.delete().catch(() => {}), 15000);
  },
};
