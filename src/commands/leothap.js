const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User"); 

function getFloorData(floor) {
    let reqDps, reward;
    if (floor <= 20) {
        reqDps = 100 + (floor * 95); 
        reward = 10 + (floor * 24); 
    } else if (floor <= 70) {
        reqDps = 2000 + ((floor - 20) * 960);
        reward = 500 + ((floor - 20) * 90);
    } else if (floor <= 120) {
        reqDps = 50000 + ((floor - 70) * 9000);
        reward = 5000 + ((floor - 70) * 900);
    } else {
        reqDps = 500000 + ((floor - 120) * 50000);
        reward = 50000 + ((floor - 120) * 5000);
    }
    return { reqDps: Math.floor(reqDps), reward: Math.floor(reward) };
}

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
               .setDescription("Số thứ tự thẻ trong túi đồ")
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

            // Đổi từ inventory sang cards cho đồng bộ database của bạn
            const userCards = userDB.cards || userDB.inventory; 
            
            if (!userCards || userCards.length < slot) {
                return interaction.editReply(`❌ Không tìm thấy thẻ ở vị trí số **${slot}** trong bộ sưu tập.`);
            }

            const card = userCards[slot - 1]; 
            
            // Fix lỗi undefined/NaN cho stats
            const cardLevel = card.level || card.lv || 1;
            const baseDamage = card.atk || card.baseDamage || 100;
            const critRate = card.critRate || 0;
            const critDmg = card.critDmg || card.critDamage || 0;

            // Lấy buffRate từ DB (mặc định là 0 nếu không có bùa)
            const buffRate = userDB.buffs?.towerDpsBoost || 0;

            // Tính toán DPS
            const card = userCards[slot - 1]; 

            // --- ĐOẠN FIX: ĐỒNG BỘ CÔNG THỨC VỚI TÚI ĐỒ ---
            const level = card.level || 1;
            
            // 1. Tính base (Giống hệt hàm calculateDPS bạn gửi)
            const base = ((card.hp || 0) * 0.1) + 
                         ((card.atk || 0) * 2) + 
                         ((card.def || 0) * 1.5) + 
                         ((card.mdef || 0) * 1.5) + 
                         ((card.spd || 0) * 5);

            // 2. Tính offensive
            const offensive = ((card.atkSpd || 0) * 100) * (1 + ((card.critRate || 0) / 100) * ((card.critDmg || 0) / 100));

            // 3. Tính DPS tổng theo Level (5% mỗi cấp)
            let dps = Math.floor((base + offensive) * (1 + (level - 1) * 0.05));

            // 4. Áp dụng Buff bùa (nếu có)
            const buffRate = userDB.buffs?.towerDpsBoost || 0;
            dps = Math.floor(dps * (1 + buffRate));
            // --- HẾT ĐOẠN FIX ---

            let currentFloor = userDB.towerFloor || 1;
            let startFloor = currentFloor;
            let totalRewards = 0;

            // Vòng lặp leo tháp
            while (currentFloor <= 150) {
                const floorData = getFloorData(currentFloor);

                if (currentFloor % 10 === 0) {
                    bossEncountered = true;
                    if (dps < floorData.reqDps * 2 && Math.random() < 0.10) {
                        currentFloor = Math.max(1, currentFloor - 1);
                        stopReason = "💀 **BOSS APPEARED!** Bạn đã bị Boss đánh bật lùi lại 1 tầng!";
                        break;
                    }
                }

                if (dps >= floorData.reqDps) {
                    totalRewards += floorData.reward;
                    currentFloor++;
                    
                    // Logic tăng EXP và Level
                    card.exp = (card.exp || 0) + 10; 
                    let expNeeded = cardLevel * 100;
                    if (card.exp >= expNeeded) {
                        card.exp = 0;
                        if (card.level) card.level++; else card.lv = (card.lv || 1) + 1;
                    }
                } else {
                    break;
                }
            }

            // Cập nhật Database
            userDB.towerAttempts -= 1;
            userDB.money += totalRewards;
            userDB.towerFloor = currentFloor;
            
            // QUAN TRỌNG: Phải markModified đúng tên mảng dữ liệu (cards hoặc inventory)
            userDB.markModified('cards'); 
            userDB.markModified('inventory'); 
            await userDB.save();

            const isMaxFloor = currentFloor > 150;
            const finalFloor = isMaxFloor ? 150 : currentFloor;

            const embed = new EmbedBuilder()
                .setTitle(`🏰 THÁP VÔ TẬN - TẦNG ${finalFloor}`)
                .setColor(0x2ecc71) 
                .setThumbnail(card.imageUrl || null)
                .addFields(
                    { 
                        name: "🎴 Thẻ Sử Dụng", 
                        value: `**Tên:** ${card.name}\n**Level:** ${card.level || card.lv || 1}\n⚔️ **DPS Tổng:** \`${dps.toLocaleString()}\``, 
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
                        value: `${createProgressBar(finalFloor, 150)}`, 
                        inline: false 
                    }
                )
                .setFooter({ text: isMaxFloor ? "👑 Chúc mừng! Bạn đã chinh phục đỉnh tháp!" : stopReason });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("LỖI LEO THÁP:", error);
            await interaction.editReply("❌ Đã xảy ra lỗi khi leo tháp.");
        }
    }
};