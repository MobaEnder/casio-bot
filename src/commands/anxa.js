const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");
require("dotenv").config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("anxa")
        .setDescription("🕊️ Ân xá cho người chơi bị Ban do nợ nần")
        .addUserOption(opt =>
            opt.setName("nguoi").setDescription("Người chơi cần được ân xá").setRequired(true)
        ),

    async execute(interaction) {
        // Lấy danh sách ID Admin từ file .env (Ví dụ: ADMIN_IDS=123,456)
        const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];
        
        // Kiểm tra quyền Admin
        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: "❌ Bạn không có quyền hạn của 'Thẩm phán' để thực thi lệnh ân xá này!", 
                flags: 64 
            });
        }

        const target = interaction.options.getUser("nguoi");
        
        // Tìm người chơi trong Database
        const userDB = await User.findOne({ userId: target.id });

        if (!userDB) {
            return interaction.reply({ 
                content: `❌ Người chơi <@${target.id}> chưa từng tham gia hệ thống Casino.`, 
                flags: 64 
            });
        }

        if (!userDB.banned) {
            return interaction.reply({ 
                content: `🤔 <@${target.id}> hiện đang là công dân lương thiện, không có lệnh Ban nào cả.`, 
                flags: 64 
            });
        }

        // Thực hiện ân xá
        userDB.banned = false;
        
        // Nếu bạn muốn xóa luôn vết nợ cũ để họ không bị quét nợ tiếp ngay sau khi ân xá:
        if (userDB.loan) {
            userDB.loan.active = false;
            userDB.loan.amount = 0;
            userDB.loan.dueAt = null;
        }

        await userDB.save();

        const embed = new EmbedBuilder()
            .setColor("White")
            .setTitle("🕊️ LỆNH ÂN XÁ ĐÃ ĐƯỢC THI HÀNH")
            .setDescription(
                `🏛️ **Thẩm phán:** <@${interaction.user.id}>\n` +
                `👤 **Người được ân xá:** <@${target.id}>\n\n` +
                `✨ Tài khoản đã được mở khóa. Hãy làm lại cuộc đời, đừng trốn nợ nữa nhé!`
            )
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    },
};