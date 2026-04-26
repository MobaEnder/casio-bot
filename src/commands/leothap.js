const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const User = require("../models/User");

// --- HỆ THỐNG TÍNH TOÁN THÁP ---
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
               .setDescription("Số thứ tự thẻ trong /tuido")
               .setRequired(true)
               .setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const slot = interaction.options.getInteger("vitri");
            const userDB = await User.findOne({ userId: interaction.user.id });

            if (!userDB) return interaction.editReply("❌ Không tìm thấy dữ liệu!");
            if (userDB.towerAttempts <= 0) return interaction.editReply("❌ Bạn đã hết lượt leo tháp. Hãy vào `/shop` để mua thêm lượt!");

            const userCards = userDB.cards; 
            if (!userCards || userCards.length < slot) {
                return interaction.editReply(`❌ Không tìm thấy thẻ ở vị trí số **${slot}**.`);
            }

            let card = userCards[slot - 1]; 
            card.level = card.level || 1;
            card.exp = card.exp || 0;

            // --- [MỚI] TÍNH TOÁN DPS CÓ BUFF ---
            const baseDpsRaw = Math.floor((card.atk || 100) + (card.critRate || 0) * (card.critDmg || 0) / 100);
            const dpsLevelBonus = Math.floor(baseDpsRaw * (1 + (card.level - 1) * 0.02));
            
            // Lấy tỉ lệ buff từ shop (towerDpsBoost đã mua ở shop)
            const towerBuffMultiplier = userDB.buffs?.towerDpsBoost || 0;
            const finalDps = Math.floor(dpsLevelBonus * (1 + towerBuffMultiplier));

            let currentFloor = userDB.towerFloor || 1;
            let startFloor = currentFloor;
            let totalRewards = 0;
            let totalExpGained = 0; 
            let stopReason = "Thẻ không đủ sức mạnh để vượt qua tầng tiếp theo.";

            // --- VÒNG LẶP LEO THÁP ---
            while (currentFloor <= 150) {
                const floorData = getFloorData(currentFloor);

                if (currentFloor % 10 === 0) {
                    // Boss khó hơn 1.5 lần, nếu dps < dps yêu cầu * 1.5 thì có tỉ lệ bị đẩy lùi
                    if (finalDps < floorData.reqDps * 1.5 && Math.random() < 0.15) {
                        currentFloor = Math.max(1, currentFloor - 1);
                        stopReason = "💀 **BOSS TRẤN GIỮ!** Bạn bị đánh bật lùi 1 tầng!";
                        break;
                    }
                }

                if (finalDps >= floorData.reqDps) {
                    totalRewards += floorData.reward;
                    totalExpGained += currentFloor * 5;
                    currentFloor++;
                } else {
                    break;
                }
            }

            // --- LOGIC LÊN CẤP ---
            let levelUpMsg = "";
            if (card.level < 100) {
                card.exp += totalExpGained;
                let neededExp = card.level * 1000;
                while (card.exp >= neededExp && card.level < 100) {
                    card.exp -= neededExp;
                    card.level++;
                    neededExp = card.level * 1000;
                    levelUpMsg = `\n⭐ **LEVEL UP!** Thẻ đã đạt cấp **${card.level}**`;
                }
            }

            // Cập nhật Database
            userDB.towerAttempts -= 1;
            userDB.money += totalRewards;
            userDB.towerFloor = currentFloor;
            userDB.markModified('cards');
            await userDB.save();

            const finalFloor = Math.min(currentFloor, 150);
            const embed = new EmbedBuilder()
                .setTitle(`🏰 KẾT QUẢ LEO THÁP - TẦNG ${finalFloor}`)
                .setColor(towerBuffMultiplier > 0 ? 0xffcc00 : 0x3498db) // Đổi màu vàng nếu có buff
                .addFields(
                    { 
                        name: "🎴 Thẻ Sử Dụng", 
                        value: `**${card.name}** (Lv.${card.level})\n⚔️ Sức mạnh: \`${finalDps.toLocaleString()}\` ${towerBuffMultiplier > 0 ? `*(🔥 +${towerBuffMultiplier * 100}%)*` : ""}`, 
                        inline: false 
                    },
                    { 
                        name: "📊 Tiến Trình", 
                        value: `Tiến lên: **${startFloor} ➔ ${finalFloor}**\nEXP: \`+${totalExpGained.toLocaleString()}\`${levelUpMsg}`, 
                        inline: true 
                    },
                    { 
                        name: "🎁 Phần Thưởng", 
                        value: `💰: **+${totalRewards.toLocaleString()}** VND\n🎫 Lượt còn: **${userDB.towerAttempts}**`, 
                        inline: true 
                    },
                    { 
                        name: "🏁 Vạch Tiến Độ", 
                        value: createProgressBar(finalFloor, 150), 
                        inline: false 
                    }
                )
                .setFooter({ text: finalFloor >= 150 ? "👑 ĐÃ CHINH PHỤC ĐỈNH THÁP!" : stopReason });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Có lỗi xảy ra!");
        }
    }
};