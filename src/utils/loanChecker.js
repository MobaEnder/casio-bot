const User = require("../models/User");

// 🐛 FIX: kênh thông báo giờ đọc từ env (LOAN_LOG_CHANNEL_ID) thay vì hardcode ID lạ
const LOG_CHANNEL_ID = process.env.LOAN_LOG_CHANNEL_ID || process.env.ALLOWED_CHANNEL_IDS?.split(",")[0] || null;

async function notify(client, content) {
    if (!LOG_CHANNEL_ID) return;
    const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (channel) channel.send(content).catch(() => {});
}

module.exports = async function checkLoans(client) {
    try {
        const overdue = await User.find({
            "loan.active": true,
            "loan.dueAt": { $lt: new Date() },
        });

        if (overdue.length === 0) return;

        for (const user of overdue) {
            try {
                const lenderId = user.loan.from;
                const debtAmount = user.loan.amount;

                let userUpdate = await User.findOne({ userId: user.userId });
                let lenderUpdate = await User.findOne({ userId: lenderId });

                // 🐛 FIX QUAN TRỌNG: bản cũ đọc user.bank (field không tồn tại, luôn = 0)
                // -> tiền trong NGÂN HÀNG bị bỏ qua -> người có tiền bank vẫn bị BAN OAN!
                const totalAssets = (userUpdate.money || 0) + (userUpdate.bankMoney || 0);

                // TRƯỜNG HỢP 1: ĐỦ TIỀN TRẢ (tính cả ngân hàng)
                if (totalAssets >= debtAmount) {
                    let remainingDebt = debtAmount;

                    // Ưu tiên trừ tiền mặt trước
                    if (userUpdate.money >= remainingDebt) {
                        userUpdate.money -= remainingDebt;
                        remainingDebt = 0;
                    } else {
                        remainingDebt -= userUpdate.money;
                        userUpdate.money = 0;
                        // 🐛 FIX: trừ đúng field bankMoney (bản cũ trừ user.bank -> tiền bank không bị trừ thật)
                        userUpdate.bankMoney -= remainingDebt;
                    }

                    if (lenderUpdate) {
                        lenderUpdate.money += debtAmount;
                        await lenderUpdate.save();
                    }

                    userUpdate.loan.active = false;
                    userUpdate.loan.amount = 0;
                    userUpdate.loan.from = null;
                    userUpdate.loan.dueAt = null;
                    await userUpdate.save();

                    await notify(client,
                        `🔔 **THU HỒI NỢ TỰ ĐỘNG**\n> 👤 Con nợ: <@${user.userId}>\n> 💰 Chủ nợ: <@${lenderId}>\n> 💸 Số tiền: **${debtAmount.toLocaleString("vi-VN")} VND**\n*Hệ thống đã tự động trừ từ ví/ngân hàng để hoàn tất khoản vay.*`
                    );
                }
                // TRƯỜNG HỢP 2: KHÔNG ĐỦ TIỀN -> BAN
                else {
                    userUpdate.loan.active = false;
                    userUpdate.loan.amount = 0;
                    userUpdate.loan.from = null;
                    userUpdate.loan.dueAt = null;
                    userUpdate.banned = true;
                    await userUpdate.save();

                    await notify(client,
                        `💀 **SIẾT NỢ THẤT BẠI**\n> ❌ Con nợ <@${user.userId}> không đủ tiền trả cho <@${lenderId}> (Số nợ: ${debtAmount.toLocaleString("vi-VN")} VND).\n> 🔨 Hình phạt: **BAN VĨNH VIỄN** (admin dùng /anxa để ân xá).`
                    );
                }
            } catch (err) {
                console.log(`Lỗi khi xử lý nợ cho user ${user.userId}:`, err);
            }
        }
    } catch (dbError) {
        console.log(`Lỗi truy vấn Database khi check nợ:`, dbError);
    }
};