const User = require("../models/User");

module.exports = async function checkLoans(client) {
    try {
        // Tìm những người có nợ đã quá hạn
        const overdue = await User.find({
            "loan.active": true,
            "loan.dueAt": { $lt: new Date() },
        });

        if (overdue.length === 0) return;

        for (const user of overdue) {
            try {
                const lenderId = user.loan.from;
                const debtAmount = user.loan.amount;
                
                // 1. Tính tổng tài sản của con nợ
                const totalAssets = (user.money || 0) + (user.bank || 0);

                let userUpdate = await User.findOne({ userId: user.userId });
                let lenderUpdate = await User.findOne({ userId: lenderId });

                // TRƯỜNG HỢP 1: CON NỢ CÓ ĐỦ TIỀN ĐỂ TRẢ (TÍNH CẢ TRONG NGÂN HÀNG)
                if (totalAssets >= debtAmount) {
                    let remainingDebt = debtAmount;

                    // Ưu tiên trừ tiền mặt trước
                    if (userUpdate.money >= remainingDebt) {
                        userUpdate.money -= remainingDebt;
                        remainingDebt = 0;
                    } else {
                        remainingDebt -= userUpdate.money;
                        userUpdate.money = 0;
                        // Trừ phần còn lại vào ngân hàng
                        userUpdate.bank -= remainingDebt;
                    }

                    // Trả tiền cho chủ nợ
                    if (lenderUpdate) {
                        lenderUpdate.money += debtAmount;
                        await lenderUpdate.save();
                    }

                    // Reset trạng thái nợ nhưng KHÔNG BAN
                    userUpdate.loan.active = false;
                    userUpdate.loan.amount = 0;
                    userUpdate.loan.from = null;
                    userUpdate.loan.dueAt = null;
                    await userUpdate.save();

                    // Thông báo thu hồi nợ thành công
                    const channel = await client.channels.fetch("1492024555168989235").catch(() => null);
                    if (channel) {
                        channel.send(`🔔 **THU HỒI NỢ TỰ ĐỘNG**\n> 👤 Con nợ: <@${user.userId}>\n> 💰 Chủ nợ: <@${lenderId}>\n> 💸 Số tiền: **${debtAmount.toLocaleString()} VND**\n*Hệ thống đã tự động trừ tiền từ tài khoản/ngân hàng để hoàn tất khoản vay.*`);
                    }
                } 
                
                // TRƯỜNG HỢP 2: KHÔNG ĐỦ TIỀN TRẢ -> BAN
                else {
                    userUpdate.loan.active = false;
                    userUpdate.loan.amount = 0;
                    userUpdate.loan.from = null;
                    userUpdate.loan.dueAt = null;
                    userUpdate.banned = true; 
                    await userUpdate.save();

                    // Thông báo Ban
                    const channel = await client.channels.fetch("1492024555168989235").catch(() => null);
                    if (channel) {
                        channel.send(`💀 **SIẾT NỢ THẤT BẠI**\n> ❌ Con nợ <@${user.userId}> không đủ tiền trả cho <@${lenderId}> (Số nợ: ${debtAmount.toLocaleString()} VND).\n> 🔨 Hình phạt: **BAN VĨNH VIỄN**.`);
                    }
                }
            } catch (err) {
                console.log(`Lỗi khi xử lý nợ cho user ${user.userId}:`, err);
            }
        }
    } catch (dbError) {
        console.log(`Lỗi truy vấn Database khi check nợ:`, dbError);
    }
};