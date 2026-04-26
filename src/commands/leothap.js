const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User"); 
// Giả định bạn có model Inventory, nếu gộp chung trong User thì điều chỉnh lại nhé
// const Inventory = require("../models/Inventory"); 

// --- HỆ THỐNG TÍNH TOÁN THÁP ---
function getFloorData(floor) {
    let reqDps, reward;
    if (floor <= 20) {
        // Tầng 1 - 20: Dễ (100 - 2,000 DPS)
        reqDps = 100 + (floor * 95); 
        reward = 10 + (floor * 24); 
    } else if (floor <= 70) {
        // Tầng 21 - 70: Trung bình (2,000 - 50,000 DPS)
        reqDps = 2000 + ((floor - 20) * 960);
        reward = 500 + ((floor - 20) * 90);
    } else if (floor <= 120) {
        // Tầng 71 - 120: Cao (50k - 500k DPS)
        reqDps = 50000 + ((floor - 70) * 9000);
        reward = 5000 + ((floor - 70) * 900);
    } else {
        // Tầng 121 - 150+: Cực hạn (500k+ DPS)
        reqDps = 500000 + ((floor - 120) * 50000);
        reward = 50000 + ((floor - 120) * 5000);
    }
    return { reqDps: Math.floor(reqDps), reward: Math.floor(reward) };
}

// --- TẠO THANH TIẾN TRÌNH (PROGRESS BAR) ---
function createProgressBar(currentFloor, maxFloor = 150, size = 15) {
    const progress = Math.min(currentFloor / maxFloor, 1);
    const filledCount = Math.round(progress * size);
    const emptyCount = size - filledCount;
    const bar = "🟩".repeat(filledCount) + "⬛".repeat(emptyCount);
    return `[${bar}] ${Math.floor(progress * 100)}%`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leothap")
        .setDescription("🏰 Đưa thẻ bài từ túi đồ đi chinh phục Tháp Vô Tận")
        .addIntegerOption(opt => 
            opt.setName("vitri")
               .setDescription("Số thứ tự thẻ trong túi đồ (/tuido) muốn mang đi đánh")
               .setRequired(true)
               .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const slot = interaction.options.getInteger("vitri");
            const userId = interaction.user.id;

            const userDB = await User.findOne({ userId: userId });
            if (!userDB) return interaction.editReply("❌ Không tìm thấy dữ liệu người chơi!");

            if (userDB.towerAttempts <= 0) {
                return interaction.editReply("❌ Bạn đã hết lượt leo tháp hôm nay.");
            }

            // --- SỬA TẠI ĐÂY: Đổi inventory thành cards ---
            const userCards = userDB.cards; 
            
            if (!userCards || userCards.length < slot) {
                return interaction.editReply(`❌ Không tìm thấy thẻ ở vị trí số **${slot}** trong bộ sưu tập thẻ bài của bạn.`);
            }

            const card = userCards[slot - 1]; 
            
            // Tính toán DPS (Đảm bảo thẻ của bạn có các trường stats này)
            // Nếu thẻ chưa có level hoặc stats, hãy thêm mặc định để tránh lỗi NaN
            const cardLevel = card.level || 1;
            const baseDamage = card.atk || 100; // Đổi theo tên field trong cards của bạn
            const critRate = card.critRate || 0;
            const critDmg = card.critDmg || 0;

            const dps = Math.floor((baseDamage * cardLevel) + (critRate * critDmg));

            let currentFloor = userDB.towerFloor || 1;
            let startFloor = currentFloor;
            let totalRewards = 0;
            let stopReason = "Thẻ của bạn không đủ sức mạnh để vượt qua tầng này.";
            let bossEncountered = false;

            // 3. VÒNG LẶP LEO THÁP (AUTO-BATTLE)
            while (currentFloor <= 150) {
                const floorData = getFloorData(currentFloor);

                // Kiểm tra sự kiện Boss (Mỗi 10 tầng)
                if (currentFloor % 10 === 0) {
                    bossEncountered = true;
                    // Tỉ lệ 10% bị Boss đẩy lùi nếu DPS không áp đảo hoàn toàn (Ví dụ: DPS không gấp 2 lần yêu cầu)
                    if (dps < floorData.reqDps * 2 && Math.random() < 0.10) {
                        currentFloor = Math.max(1, currentFloor - 1);
                        stopReason = "💀 **BOSS APPEARED!** Bạn đã bị Boss đánh bật lùi lại 1 tầng do không kịp hạ gục nó trong 10 giây!";
                        break;
                    }
                }

                // So sánh chỉ số
                if (dps >= floorData.reqDps) {
                    // Thắng -> Nhận thưởng -> Lên tầng
                    totalRewards += floorData.reward;
                    currentFloor++;
                } else {
                    // Thua -> Dừng lại
                    break;
                }
            }

            // Xử lý trừ lượt và lưu dữ liệu
            userDB.towerAttempts -= 1;
            userDB.money += totalRewards;
            userDB.towerFloor = currentFloor; // Cập nhật Checkpoint mới
            await userDB.save();

            // 4. HIỂN THỊ KẾT QUẢ TRỰC QUAN (EMBED)
            const isMaxFloor = currentFloor > 150;
            const finalFloor = isMaxFloor ? 150 : currentFloor;

            const embed = new EmbedBuilder()
                .setTitle(`🏰 THÁP VÔ TẬN - TẦNG ${finalFloor}`)
                .setColor(bossEncountered && dps < getFloorData(finalFloor).reqDps ? 0xff0000 : 0x00ff00)
                .setThumbnail(card.imageUrl || "https://i.imgur.com/your-tower-icon.png")
                .addFields(
                    { 
                        name: "🎴 Thẻ Sử Dụng", 
                        value: `**Tên:** ${card.name}\n**Level:** ${card.level}\n⚔️ **DPS Tổng:** \`${dps.toLocaleString()}\``, 
                        inline: false 
                    },
                    { 
                        name: "🧗 Tiến Trình Leo", 
                        value: `🚩 **Bắt đầu từ:** Tầng ${startFloor}\n🛑 **Dừng lại tại:** Tầng ${finalFloor}\n🎯 **Yêu cầu DPS hiện tại:** \`${getFloorData(finalFloor).reqDps.toLocaleString()}\``, 
                        inline: true 
                    },
                    { 
                        name: "🎁 Phần Thưởng", 
                        value: `💰 Tích lũy: **+${totalRewards.toLocaleString()}** VND\n⚡ Lượt còn lại: **${userDB.towerAttempts}**`, 
                        inline: true 
                    },
                    { 
                        name: "📊 Tỉ lệ hoàn thành Tháp (Max: 150)", 
                        value: createProgressBar(finalFloor, 150), 
                        inline: false 
                    }
                )
                .setFooter({ text: isMaxFloor ? "👑 Chúc mừng! Bạn đã chinh phục đỉnh tháp!" : stopReason });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("LỖI LEO THÁP:", error);
            await interaction.editReply("❌ Đã xảy ra lỗi khi tính toán dữ liệu tháp. Vui lòng thử lại sau.");
        }
    }
};