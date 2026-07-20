const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, bar, casinoEmbed, sleep } = require("../utils/ui");

// --- HỆ THỐNG DỮ LIỆU TẦNG (GIỮ NGUYÊN) ---
function getFloorData(floor) {
    let reqDps;
    if (floor <= 20) reqDps = 100 + floor * 95;
    else if (floor <= 70) reqDps = 2000 + (floor - 20) * 960;
    else if (floor <= 120) reqDps = 50000 + (floor - 70) * 9000;
    else reqDps = 500000 + (floor - 120) * 50000;

    let reward = 0;
    if (floor <= 50) reward = 500000;
    else if (floor <= 100) reward = 1000000;
    else reward = 3000000;

    return { reqDps: Math.floor(reqDps), reward };
}

// Vẽ tòa tháp ASCII theo tầng hiện tại
function renderTower(floor) {
    const milestones = [150, 120, 100, 70, 50, 20, 1];
    let art = "";
    for (const m of milestones) {
        const here = floor >= m ? " 🧗" : "";
        const icon = m === 150 ? "👑" : m % 50 === 0 ? "💎" : m % 20 === 0 ? "⭐" : "🧱";
        art += `${icon} Tầng ${String(m).padStart(3)}${floor >= m && floor < (milestones[milestones.indexOf(m) - 1] || 999) ? " ← BẠN Ở ĐÂY 🚩" : ""}\n`;
    }
    return "```\n" + art + "```";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leothap")
        .setDescription("🏰 Đưa thẻ bài từ túi đồ đi chinh phục Tháp Vô Tận")
        .addIntegerOption((opt) =>
            opt.setName("vitri").setDescription("Số thứ tự thẻ trong túi đồ").setRequired(true).setMinValue(1)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const slot = interaction.options.getInteger("vitri");
            const userId = interaction.user.id;

            const userDB = await User.findOne({ userId });
            if (!userDB) return interaction.editReply("❌ Không tìm thấy dữ liệu người chơi!");
            if (userDB.towerAttempts <= 0) {
                return interaction.editReply({
                    embeds: [casinoEmbed({ color: COLORS.red, title: "😴 HẾT LƯỢT LEO THÁP", description: "> Bạn đã dùng hết lượt leo hôm nay.\n> Quay lại vào ngày mai để tiếp tục chinh phục! 🌅" })],
                });
            }

            const userCards = userDB.cards || userDB.inventory;
            if (!userCards || userCards.length < slot) {
                return interaction.editReply(`❌ Không tìm thấy thẻ ở vị trí số **${slot}** trong túi đồ.`);
            }

            const card = userCards[slot - 1];

            // --- CÔNG THỨC DPS (GIỮ NGUYÊN) ---
            const level = card.level || card.lv || 1;
            const base =
                (card.hp || 0) * 0.1 +
                (card.atk || 0) * 2 +
                (card.def || 0) * 1.5 +
                (card.mdef || 0) * 1.5 +
                (card.spd || 0) * 5;
            const offensive = (card.atkSpd || 0) * 100 * (1 + ((card.critRate || 0) / 100) * ((card.critDmg || 0) / 100));

            let dps = Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
            const buffRate = userDB.buffs?.towerDpsBoost || 0;
            dps = Math.floor(dps * (1 + buffRate));

            // 🎬 KHUNG 1: XUẤT PHÁT
            const startFloorDisplay = userDB.towerFloor || 1;
            await interaction.editReply({
                embeds: [casinoEmbed({ color: COLORS.blue, title: "🏰 THÁP VÔ TẬN — BẮT ĐẦU CHINH PHỤC!" })
                    .setThumbnail(card.imageUrl || null)
                    .setDescription(
                        `🎴 **${card.name}** (Lv.${level}) bước vào tháp...\n` +
                        `⚔️ DPS xuất trận: \`${money(dps)}\`${buffRate > 0 ? ` *(🔮 +${buffRate * 100}% bùa)*` : ""}\n` +
                        `🚩 Xuất phát: **Tầng ${startFloorDisplay}**\n\n⏳ *Đang chiến đấu...*`
                    )],
            });
            await sleep(1500);

            // --- LOGIC LEO THÁP (GIỮ NGUYÊN) ---
            let currentFloor = userDB.towerFloor || 1;
            const startFloor = currentFloor;
            let totalRewards = 0;
            let stopReason = "⚔️ Thẻ của bạn không đủ sức mạnh để vượt qua tầng này.";
            let bossEvent = false;

            while (currentFloor <= 150) {
                const floorData = getFloorData(currentFloor);

                if (currentFloor % 10 === 0) {
                    if (dps < floorData.reqDps * 2 && Math.random() < 0.10) {
                        currentFloor = Math.max(1, currentFloor - 1);
                        stopReason = "💀 **BOSS APPEARED!** Bạn đã bị Boss đánh bật lùi lại 1 tầng!";
                        bossEvent = true;
                        break;
                    }
                }

                if (dps >= floorData.reqDps) {
                    totalRewards += floorData.reward;
                    currentFloor++;
                    card.exp = (card.exp || 0) + 10;
                    if (card.exp >= level * 100) {
                        card.exp = 0;
                        if (card.level) card.level++;
                        else if (card.lv) card.lv++;
                    }
                } else break;
            }

            // 🎬 KHUNG 2: BOSS (nếu gặp)
            if (bossEvent) {
                await interaction.editReply({
                    embeds: [casinoEmbed({ color: COLORS.dark, title: "💀 CẢNH BÁO: BOSS XUẤT HIỆN!!!" })
                        .setDescription(`\`\`\`\n     👹\n    /||\\   RAWRRR!!!\n   🧗💨 (bị đánh văng)\n\`\`\`\n> ${card.name} đụng độ Boss canh tầng và bị đánh bật lùi!`)],
                });
                await sleep(1800);
            }

            // --- CẬP NHẬT DATABASE (GIỮ NGUYÊN) ---
            userDB.towerAttempts -= 1;
            userDB.money += totalRewards;
            userDB.towerFloor = currentFloor;
            userDB.markModified("cards");
            userDB.markModified("inventory");
            await userDB.save();

            const finalFloor = currentFloor > 150 ? 150 : currentFloor;
            const floorsClimbed = finalFloor - startFloor;
            const nextReq = getFloorData(finalFloor).reqDps;
            const dpsRatio = Math.min(1, dps / nextReq);

            // 🎬 KHUNG CUỐI: TỔNG KẾT
            const embed = casinoEmbed({
                color: currentFloor > 150 ? COLORS.gold : floorsClimbed > 0 ? COLORS.green : COLORS.red,
                title: `🏰 THÁP VÔ TẬN — DỪNG CHÂN TẠI TẦNG ${finalFloor}`,
            })
                .setThumbnail(card.imageUrl || null)
                .setDescription(
                    (floorsClimbed > 0
                        ? `🎉 **${card.name}** đã càn quét **${floorsClimbed} tầng** trong lượt này!`
                        : `😤 **${card.name}** không vượt nổi tầng ${finalFloor}...`) +
                    `\n\n${renderTower(finalFloor)}`
                )
                .addFields(
                    {
                        name: "🎴 Chiến Binh",
                        value: `**${card.name}** — Lv.${card.level || card.lv || 1}\n⚔️ DPS: \`${money(dps)}\`\n📖 EXP: ${card.exp || 0}/${(card.level || card.lv || 1) * 100}`,
                        inline: true,
                    },
                    {
                        name: "🧗 Hành Trình",
                        value: `🚩 Tầng ${startFloor} → **Tầng ${finalFloor}**\n🎯 Cửa ải tiếp: \`${money(nextReq)}\` DPS\n${bar(dpsRatio, 8, "🟩", "⬛")} ${Math.floor(dpsRatio * 100)}%`,
                        inline: true,
                    },
                    {
                        name: "🎁 Chiến Lợi Phẩm",
                        value: `💰 **+${money(totalRewards)} VND**\n⚡ Lượt còn: **${userDB.towerAttempts}**\n💼 Ví: \`${money(userDB.money)}\``,
                        inline: true,
                    },
                    {
                        name: "📊 Tiến độ chinh phục tháp (Max 150)",
                        value: `${bar(finalFloor / 150, 15, "🟩", "⬛")} **${Math.floor((finalFloor / 150) * 100)}%**`,
                    }
                )
                .setFooter({ text: currentFloor > 150 ? "👑 CHÚC MỪNG! Bạn đã chinh phục ĐỈNH THÁP!" : stopReason.replace(/\*/g, "") });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("LỖI LEO THÁP:", error);
            await interaction.editReply("❌ Đã xảy ra lỗi khi leo tháp.");
        }
    },
};