const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User"); // Đảm bảo đường dẫn này đúng với model của bạn

// Biến toàn cục để lưu người chơi trong 30 phút (Reset sau mỗi lần xổ)
// Cấu trúc: Map<ChannelId, Map<UserId, TicketNumber>>
const activeSessions = new Map(); 
let globalClient = null;
let timerStarted = false;

// --- HÀM TẠO SỐ NGẪU NHIÊN CÓ SỐ 0 Ở ĐẦU ---
function randomStr(length) {
    let res = '';
    for (let i = 0; i < length; i++) {
        res += Math.floor(Math.random() * 10).toString();
    }
    return res;
}

// --- HÀM TẠO KẾT QUẢ VÉ SỐ MIỀN NAM ---
function generateResults() {
    return {
        g8: [randomStr(2)],
        g7: [randomStr(3)],
        g6: [randomStr(4), randomStr(4), randomStr(4)],
        g5: [randomStr(4)],
        g4: [randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5), randomStr(5)],
        g3: [randomStr(5), randomStr(5)],
        g2: [randomStr(5)],
        g1: [randomStr(5)],
        db: [randomStr(6)]
    };
}

// --- HÀM KIỂM TRA VÉ TRÚNG THƯỞNG ---
function checkTicket(ticket, results) {
    let wonPrizes = [];
    let totalPrize = 0;

    if (results.db.includes(ticket)) { wonPrizes.push("Đặc Biệt"); totalPrize += 1000000000; }
    if (results.g1.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 1"); totalPrize += 200000000; }
    if (results.g2.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 2"); totalPrize += 100000000; }
    if (results.g3.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 3"); totalPrize += 50000000; }
    if (results.g4.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 4"); totalPrize += 20000000; }
    if (results.g5.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 5"); totalPrize += 10000000; }
    if (results.g6.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 6"); totalPrize += 1000000; }
    if (results.g7.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 7"); totalPrize += 500000; }
    if (results.g8.some(r => ticket.endsWith(r))) { wonPrizes.push("Giải 8"); totalPrize += 500000; }

    return { wonPrizes, totalPrize };
}

// --- HỆ THỐNG ĐẾM GIỜ QUAY SỐ ---
function startTimer() {
    if (timerStarted) return;
    timerStarted = true;

    function scheduleNextDraw() {
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Tính số phút còn lại để đến mốc :00 hoặc :30 tiếp theo
        let minutesToNext = 30 - (minutes % 30);
        if (minutesToNext === 0) minutesToNext = 30; 

        const msToNext = (minutesToNext * 60 * 1000) - (now.getSeconds() * 1000) - now.getMilliseconds();

        setTimeout(async () => {
            await runLottery();
            scheduleNextDraw(); // Lặp lại vòng tuần hoàn
        }, msToNext);
    }
    
    scheduleNextDraw();
}

// --- HÀM THỰC THI QUAY SỐ VÀ TRẢ THƯỞNG ---
async function runLottery() {
    if (!globalClient || activeSessions.size === 0) return; // Không có ai chơi thì bỏ qua

    const results = generateResults();

    const embed = new EmbedBuilder()
        .setTitle("🎲 KẾT QUẢ XỔ SỐ KIẾN THIẾT 🎲")
        .setDescription("Kết quả sẽ áp dụng chung cho tất cả người chơi trong kỳ này!")
        .setColor(0xffd700)
        .addFields(
            { name: "👑 Giải Đặc Biệt (1 Tỷ)", value: `**${results.db[0]}**`, inline: false },
            { name: "🥇 Giải 1 (200Tr)", value: results.g1.join(" - "), inline: false },
            { name: "🥈 Giải 2 (100Tr)", value: results.g2.join(" - "), inline: false },
            { name: "🥉 Giải 3 (50Tr)", value: results.g3.join(" - "), inline: false },
            { name: "🎫 Giải 4 (20Tr)", value: results.g4.join(" - "), inline: false },
            { name: "🎫 Giải 5 (10Tr)", value: results.g5.join(" - "), inline: false },
            { name: "🎫 Giải 6 (1Tr)", value: results.g6.join(" - "), inline: false },
            { name: "🎫 Giải 7 (500K)", value: results.g7.join(" - "), inline: false },
            { name: "🎫 Giải 8 (500K)", value: `**${results.g8[0]}**`, inline: false }
        )
        .setFooter({ text: "Hệ thống sẽ mở bán lại ngay sau tin nhắn này!" })
        .setTimestamp();

    // Duyệt qua từng kênh có người chơi
    for (const [channelId, playersMap] of activeSessions.entries()) {
        const channel = globalClient.channels.cache.get(channelId);
        if (!channel) continue;

        let resultText = "👥 **BẢNG DÒ VÉ NGƯỜI CHƠI KỲ NÀY:**\n\n";

        // Dò vé cho từng người trong kênh
        for (const [userId, ticket] of playersMap.entries()) {
            const { wonPrizes, totalPrize } = checkTicket(ticket, results);

            if (totalPrize > 0) {
                // Trúng thưởng -> Cộng tiền vào Database
                const userDB = await User.findOne({ userId: userId });
                if (userDB) {
                    userDB.money = (userDB.money || 0) + totalPrize;
                    await userDB.save();
                }
                resultText += `🎉 <@${userId}>: Vé \`${ticket}\` trúng **${wonPrizes.join(", ")}** 💰(+${totalPrize.toLocaleString()} VND)\n`;
            } else {
                resultText += `❌ <@${userId}>: Vé \`${ticket}\` chúc bạn may mắn lần sau!\n`;
            }
        }

        // Gửi kết quả ra kênh
        try {
            await channel.send({ content: "🔔 **ĐÃ ĐẾN GIỜ XỔ SỐ!** 🔔\nNgừng bán vé! Bắt đầu quay thưởng...", embeds: [embed] });
            await channel.send(resultText);
        } catch (error) {
            console.error("Lỗi gửi tin nhắn vé số:", error);
        }
    }

    // Dọn dẹp danh sách để bắt đầu kỳ mới
    activeSessions.clear();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("veso")
        .setDescription("🎟️ Mua vé số kiến thiết (100.000 VND / vé). Sổ mỗi phút 00 và 30 hàng giờ.")
        .addStringOption(opt => 
            opt.setName("so")
               .setDescription("Nhập 6 số bạn muốn mua (VD: 012345)")
               .setRequired(true)
               .setMaxLength(6)
               .setMinLength(6)
        ),

    async execute(interaction) {
        // Lưu lại client để xài cho hệ thống gửi tin nhắn tự động
        if (!globalClient) globalClient = interaction.client;
        
        // Kích hoạt bộ đếm giờ ngầm (chỉ chạy 1 lần duy nhất)
        startTimer();

        const ticket = interaction.options.getString("so");

        // Kiểm tra xem vé có đúng định dạng 6 chữ số hay không
        if (!/^\d{6}$/.test(ticket)) {
            return interaction.reply({ content: "❌ Số vé không hợp lệ! Bạn phải nhập đúng 6 chữ số (Ví dụ: 012345).", ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const userDB = await User.findOne({ userId: interaction.user.id });
            if (!userDB) return interaction.editReply("❌ Không tìm thấy dữ liệu người chơi!");

            const ticketPrice = 100000; // 100k VND
            
            // Kiểm tra tiền
            if ((userDB.money || 0) < ticketPrice) {
                return interaction.editReply(`❌ Bạn không đủ tiền! Cần **${ticketPrice.toLocaleString()} VND** để mua vé số.`);
            }

            const channelId = interaction.channelId;
            
            // Khởi tạo danh sách người chơi cho kênh hiện tại nếu chưa có
            if (!activeSessions.has(channelId)) {
                activeSessions.set(channelId, new Map());
            }

            const channelPlayers = activeSessions.get(channelId);

            // Kiểm tra xem người dùng đã mua vé trong khung 30p này chưa
            if (channelPlayers.has(interaction.user.id)) {
                return interaction.editReply(`❌ Bạn đã mua vé số \`${channelPlayers.get(interaction.user.id)}\` cho kỳ này rồi!\n⏳ Hãy chờ quay số xong mới có thể mua tiếp.`);
            }

            // Trừ tiền người chơi
            userDB.money -= ticketPrice;
            await userDB.save();

            // Lưu người chơi vào bộ nhớ chờ quay số
            channelPlayers.set(interaction.user.id, ticket);

            interaction.editReply(`✅ Bạn đã mua thành công vé số **${ticket}** với giá **${ticketPrice.toLocaleString()} VND**.\n⏳ Hệ thống sẽ tự động quay số và thông báo tại kênh này vào mỗi phút thứ \`00\` và \`30\` hàng giờ! Chúc bạn may mắn!`);

        } catch (error) {
            console.error("LỖI LỆNH VÉ SỐ:", error);
            interaction.editReply("❌ Có lỗi xảy ra khi mua vé số, vui lòng thử lại sau.");
        }
    }
};