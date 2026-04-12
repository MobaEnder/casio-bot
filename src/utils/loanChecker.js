const User = require("../models/User");
const { EmbedBuilder } = require("discord.js");

module.exports = async function checkLoans(client) {
    // Tìm những người có nợ đã quá hạn
    const overdue = await User.find({
        "loan.active": true,
        "loan.dueAt": { $lt: new Date() },
    });

    for (const user of overdue) {
        const lenderId = user.loan.from;
        const amount = user.loan.amount;

        // Reset nợ và Ban
        user.loan.active = false;
        user.loan.amount = 0;
        user.loan.from = null;
        user.loan.dueAt = null;
        user.banned = true; 
        await user.save();

        try {
            const discordUser = await client.users.fetch(user.userId);
            
            // 1. Gửi DM cho con nợ
            await discordUser.send("💀 **HẾT THỜI RỒI!** Bạn đã quá hạn trả nợ và chính thức bị **BAN** khỏi hệ thống cược vĩnh viễn.").catch(() => {});

            // 2. Gửi thông báo cho chủ nợ (để họ biết là họ mất tiền rồi)
            const lender = await client.users.fetch(lenderId);
            if (lender) {
                await lender.send(`📢 Chia buồn! Con nợ <@${user.userId}> đã trốn nợ quá hạn. Hắn đã bị ban, nhưng số tiền **${amount.toLocaleString()} VND** của bạn đã bay theo gió...`).catch(() => {});
            }
        } catch (err) {
            console.log(`Lỗi khi xử lý ban nợ: ${err}`);
        }
    }
};