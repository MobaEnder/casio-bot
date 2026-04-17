const User = require("../models/User");
const { EmbedBuilder } = require("discord.js");

module.exports = async function checkLoans(client) {
    try {
        // Tìm những người có nợ đã quá hạn
        const overdue = await User.find({
            "loan.active": true,
            "loan.dueAt": { $lt: new Date() }, // Lưu ý: Đổi thành Date.now() nếu bạn dùng Timestamp
        });

        if (overdue.length === 0) return; // Không có ai quá hạn thì dừng luôn cho nhẹ máy

        for (const user of overdue) {
            try {
                const lenderId = user.loan.from;
                const amount = user.loan.amount;

                // Reset nợ và Ban
                user.loan.active = false;
                user.loan.amount = 0;
                user.loan.from = null;
                user.loan.dueAt = null;
                user.banned = true; 
                
                // Chuyển save() vào trong try để an toàn
                await user.save(); 

                const discordUser = await client.users.fetch(user.userId).catch(() => null);
                if (discordUser) {
                    await discordUser.send("💀 **HẾT THỜI RỒI!** Bạn đã quá hạn trả nợ và chính thức bị **BAN** khỏi hệ thống cược vĩnh viễn.").catch(() => {});
                }

                if (lenderId) {
                    const lender = await client.users.fetch(lenderId).catch(() => null);
                    if (lender) {
                        await lender.send(`📢 Chia buồn! Con nợ <@${user.userId}> đã trốn nợ quá hạn. Hắn đã bị ban, nhưng số tiền **${amount.toLocaleString()} VND** của bạn đã bay theo gió...`).catch(() => {});
                    }
                }
            } catch (err) {
                console.log(`Lỗi khi xử lý ban nợ cho user ${user.userId}:`, err);
            }
        }
    } catch (dbError) {
        console.log(`Lỗi truy vấn Database khi check nợ:`, dbError);
    }
};