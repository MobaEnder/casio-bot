module.exports = {
    data: new SlashCommandBuilder()
        .setName("steal")
        .setDescription("Ăn trộm tiền của người khác")
        .addUserOption(opt => opt.setName("target").setDescription("Người bạn muốn trộm").setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("target");
        if (targetUser.id === interaction.user.id) return interaction.reply("Bạn không thể tự trộm chính mình!");

        const thief = await User.findOne({ userId: interaction.user.id });
        const victim = await User.findOne({ userId: targetUser.id });

        if (!victim || victim.money < 1000) return interaction.reply("Đối tượng quá nghèo, không đáng để trộm!");

        // ⏳ Kiểm tra Cooldown 2 tiếng
        const cooldown = 2 * 60 * 60 * 1000;
        if (thief.lastThief && Date.now() - thief.lastThief < cooldown) {
            const remain = Math.ceil((cooldown - (Date.now() - thief.lastThief)) / 60000);
            return interaction.reply(`⏳ Bạn đang bị cảnh sát theo dõi! Quay lại sau **${remain} phút**.`);
        }

        // 🎲 Tính toán tỉ lệ thắng
        let winChance = 0.30; // 30% gốc
        // Nếu nạn nhân có bảo vệ (ví dụ guard_2 giảm 25% -> 0.25)
        if (victim.securityLevel === 2) winChance -= 0.25; 
        else if (victim.securityLevel === 1) winChance -= 0.10;

        if (winChance < 0.05) winChance = 0.05; // Tỉ lệ tối thiểu luôn là 5%

        const isSuccess = Math.random() < winChance;
        thief.lastThief = Date.now();

        if (isSuccess) {
            const stolenAmount = Math.floor(victim.money * 0.09);
            victim.money -= stolenAmount;
            thief.money += stolenAmount;

            await victim.save();
            await thief.save();

            return interaction.reply(`🥷 Bạn đã trộm thành công **${stolenAmount.toLocaleString()} VND** từ <@${targetUser.id}>!`);
        } else {
            const fine = 2000; // Phạt tiền nếu trộm hụt
            thief.money -= fine;
            await thief.save();
            return interaction.reply(`🚔 Bạn đã bị bắt khi đang hành nghề và bị phạt **${fine.toLocaleString()} VND**!`);
        }
    }
};