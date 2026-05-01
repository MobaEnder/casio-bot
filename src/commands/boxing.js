const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../models/User");

// ==========================================
// 1. DATA VÕ SĨ
// ==========================================
const BOXERS = [
    { id: "ali", name: "Muhammad Ali", alias: "Float like a butterfly", hp: 100, atk: 15, def: 20, spd: 30, trait: "Né tránh cao" },
    { id: "tyson", name: "Mike Tyson", alias: "Iron Mike", hp: 120, atk: 35, def: 10, spd: 15, trait: "Tỉ lệ KO cao" },
    { id: "floyd", name: "Floyd Mayweather", alias: "Money", hp: 90, atk: 12, def: 35, spd: 25, trait: "Phản đòn mạnh" },
    { id: "pacman", name: "Manny Pacquiao", alias: "Pac-Man", hp: 110, atk: 25, def: 15, spd: 20, trait: "Đánh liên hoàn" },
    { id: "louis", name: "Joe Louis", alias: "The Brown Bomber", hp: 130, atk: 20, def: 20, spd: 10, trait: "Lì đòn" },
    { id: "sugar", name: "Sugar Ray Robinson", alias: "The Greatest", hp: 100, atk: 22, def: 22, spd: 22, trait: "Toàn diện" },
    { id: "rocky", name: "Rocky Marciano", alias: "Bất bại", hp: 115, atk: 28, def: 18, spd: 12, trait: "Sát thương chuẩn" },
    { id: "fury", name: "Tyson Fury", alias: "The Gypsy King", hp: 140, atk: 18, def: 15, spd: 18, trait: "Sải tay dài" },
    { id: "joshua", name: "Anthony Joshua", alias: "AJ", hp: 125, atk: 26, def: 15, spd: 10, trait: "Sức mạnh bùng nổ" },
    { id: "foreman", name: "George Foreman", alias: "Big George", hp: 150, atk: 30, def: 5, spd: 5, trait: "Cú đấm tàn bạo" }
];

// ==========================================
// 2. HÀM TRỢ GIÚP (UI THANH MÁU)
// ==========================================
function createHpBar(currentHp, maxHp, size = 10) {
    const progress = Math.max(0, Math.min(currentHp / maxHp, 1));
    const filled = Math.round(progress * size);
    const empty = size - filled;
    return "🟦".repeat(filled) + "⬜".repeat(empty) + ` (${Math.floor(progress * 100)}%)`;
}

// ==========================================
// 3. LOGIC GIẢI ĐẤU & AI (TOURNAMENT)
// ==========================================
async function aiFight(channel, a, b) {
    let hpA = a.hp;
    let hpB = b.hp;

    const fightMsg = await channel.send("🥊 Trận đấu đang diễn ra...");

    for (let round = 1; round <= 3; round++) {
        // AI tính damage cơ bản (có thể phát triển thêm tỉ lệ crit/miss sau)
        const dmgToB = Math.floor(Math.random() * a.atk) + (a.spd > b.spd ? 5 : 0);
        const dmgToA = Math.floor(Math.random() * b.atk) + (b.spd > a.spd ? 5 : 0);

        hpB -= dmgToB;
        hpA -= dmgToA;

        const roundEmbed = new EmbedBuilder()
            .setTitle(`🥊 HIỆP ${round}`)
            .setColor(0xE74C3C)
            .addFields(
                { name: `🔴 ${a.name}`, value: `HP: ${createHpBar(hpA, a.hp)}\nRa đòn: -${dmgToB} HP`, inline: false },
                { name: `🔵 ${b.name}`, value: `HP: ${createHpBar(hpB, b.hp)}\nRa đòn: -${dmgToA} HP`, inline: false }
            );

        await fightMsg.edit({ content: `⏳ Hiệp ${round}...`, embeds: [roundEmbed] });
        
        if (hpA <= 0 || hpB <= 0) break;
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Chờ 3s giữa hiệp
    }

    return hpA > hpB ? a : b;
}

async function simulatePhase(channel, phaseName, boxersInPhase, investors) {
    const fighterA = boxersInPhase[0];
    const fighterB = boxersInPhase[1];

    const matchEmbed = new EmbedBuilder()
        .setTitle(`🥊 VÕ ĐÀI HUYỀN THOẠI - VÒNG ${phaseName} 🥊`)
        .setColor(0x3498DB)
        .addFields(
            { name: `🔴 VÕ SĨ A: [${fighterA.name}]`, value: `Bí danh: *${fighterA.alias}*\nHP: ${fighterA.hp} | Lực tay: ${fighterA.atk}`, inline: true },
            { name: `⚡`, value: `\n\n**VS**\n\n`, inline: true },
            { name: `🔵 VÕ SĨ B: [${fighterB.name}]`, value: `Bí danh: *${fighterB.alias}*\nHP: ${fighterB.hp} | Lực tay: ${fighterB.atk}`, inline: true }
        )
        .setFooter({ text: "💰 Cổng cá cược mở trong 15 giây! (Mặc định 50k/vé)" });

    const betRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bet_${fighterA.id}`).setLabel(`Cược ${fighterA.name}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`bet_${fighterB.id}`).setLabel(`Cược ${fighterB.name}`).setStyle(ButtonStyle.Primary)
    );

    const matchMsg = await channel.send({ embeds: [matchEmbed], components: [betRow] });

    // Thu thập cược trong 15 giây
    const betCollector = matchMsg.createMessageComponentCollector({ time: 15000 });
    let totalPool = 0;

    betCollector.on('collect', async i => {
        const betAmount = 50000; // Tiền cược cứng 50k (bạn có thể đổi bằng modal sau)
        const chosenId = i.customId.replace("bet_", "");

        const userDB = await User.findOne({ userId: i.user.id });
        if (!userDB || userDB.money < betAmount) {
            return i.reply({ content: "❌ Bạn không đủ 50,000 VND để đầu tư!", ephemeral: true });
        }

        userDB.money -= betAmount;
        await userDB.save();

        totalPool += betAmount;
        investors.set(i.user.id, { fighterId: chosenId, amount: betAmount });

        await i.reply({ content: `💸 Bạn đã cược **${betAmount.toLocaleString()} VND** cho **${chosenId}**!`, ephemeral: true });
    });

    betCollector.on('end', async () => {
        await matchMsg.edit({ components: [] });
        await channel.send(`⏳ Cổng cá cược đóng! Tổng hũ: **${totalPool.toLocaleString()} VND**. Bắt đầu!`);
        
        // Gọi AI đánh nhau
        const winner = await aiFight(channel, fighterA, fighterB);
        
        // Trả thưởng x2
        let winnersText = "Danh sách thắng cược:\n";
        for (const [userId, betInfo] of investors.entries()) {
            if (betInfo.fighterId === winner.id) {
                const reward = betInfo.amount * 2;
                const userDB = await User.findOne({ userId });
                if (userDB) {
                    userDB.money += reward;
                    await userDB.save();
                }
                winnersText += `<@${userId}>: +${reward.toLocaleString()} VND 🎉\n`;
            }
        }

        const endEmbed = new EmbedBuilder()
            .setTitle(`🏆 KẾT QUẢ: ${winner.name} THẮNG!`)
            .setColor(0xF1C40F)
            .setDescription(winnersText.length > 25 ? winnersText : "Không có nhà đầu tư nào thắng cược.");
            
        await channel.send({ embeds: [endEmbed] });
    });
}

async function runTournament(interaction) {
    const channel = interaction.channel;
    const shuffled = [...BOXERS].sort(() => 0.5 - Math.random());
    let activeBoxers = shuffled.slice(0, 8); // Lấy 8 người đánh Tứ Kết
    let investors = new Map();

    await simulatePhase(channel, "TỨ KẾT (TRẬN 1)", [activeBoxers[0], activeBoxers[1]], investors);
    // Chú ý: Đây là sườn gốc, bạn có thể gọi thêm SimulatePhase cho các trận tiếp theo (Bán kết, Chung kết)
}

// ==========================================
// 4. LỆNH CHÍNH (SLASH COMMAND)
// ==========================================
module.exports = {
    data: new SlashCommandBuilder()
        .setName("boxing")
        .setDescription("🥊 Quyền Anh Huyền Thoại - Chế độ Solo hoặc Giải đấu"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("🥊 VÕ ĐÀI HUYỀN THOẠI 🥊")
            .setDescription("Chọn phương thức bạn muốn tham gia:")
            .setColor(0xE67E22)
            .addFields(
                { name: "⚔️ Solo 1vs1", value: "Tự chọn võ sĩ, tự ra đòn (Đang phát triển).", inline: true },
                { name: "🏆 Giải Đấu", value: "Cược tiền cho võ sĩ AI đánh.", inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("mode_solo").setLabel("Solo 1vs1").setStyle(ButtonStyle.Danger).setEmoji("⚔️"),
            new ButtonBuilder().setCustomId("mode_tourney").setLabel("Giải Đấu").setStyle(ButtonStyle.Success).setEmoji("💰")
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === "mode_solo") {
                await i.update({ content: "🛠️ *Tính năng Solo đang được xây dựng...*", embeds: [], components: [] });
                // Nơi gọi hàm Solo sau này
            } else if (i.customId === "mode_tourney") {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "Chỉ người gõ lệnh mới được khởi tạo!", ephemeral: true });
                await i.update({ content: "🔥 **GIẢI ĐẤU BẮT ĐẦU!**", embeds: [], components: [] });
                
                runTournament(interaction);
            }
        });
    }
};