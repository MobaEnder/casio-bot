const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
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
// 2. HÀM TRỢ GIÚP
// ==========================================
function createHpBar(currentHp, maxHp, size = 10) {
    const progress = Math.max(0, Math.min(currentHp / maxHp, 1));
    const filled = Math.round(progress * size);
    const empty = size - filled;
    return "🟦".repeat(filled) + "⬜".repeat(empty) + ` (${Math.floor(progress * 100)}%)`;
}

// ==========================================
// 3. LOGIC SOLO 1VS1
// ==========================================
async function startSoloMatch(interaction, p1) {
    const channel = interaction.channel;
    
    // Mở phòng chờ
    const lobbyEmbed = new EmbedBuilder()
        .setTitle("🥊 PHÒNG CHỜ QUYỀN ANH")
        .setDescription(`**${p1.username}** đã lên đài thách đấu!\nAi dám bước lên tiếp chiêu?`)
        .setColor(0x3498DB)
        .setFooter({ text: "Phòng chờ sẽ đóng sau 60 giây." });

    const lobbyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("join_solo").setLabel("Tham Gia").setStyle(ButtonStyle.Primary).setEmoji("🥊")
    );

    const lobbyMsg = await interaction.editReply({ embeds: [lobbyEmbed], components: [lobbyRow], content: "" });

    const lobbyCollector = lobbyMsg.createMessageComponentCollector({ 
        filter: btn => btn.user.id !== p1.id, 
        max: 1, 
        time: 60000 
    });

    lobbyCollector.on('collect', async i => {
        const p2 = i.user;
        await i.update({ content: `🔥 Trận đấu giữa **${p1.username}** và **${p2.username}** bắt đầu!`, embeds: [], components: [] });

        // Chọn võ sĩ
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_boxer')
            .setPlaceholder('Chọn võ sĩ của bạn...')
            .addOptions(BOXERS.map(b => ({ label: b.name, description: b.trait, value: b.id })));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const selectMsg = await channel.send({ content: `<@${p1.id}> và <@${p2.id}> hãy chọn võ sĩ!`, components: [row] });

        let selections = new Map();
        const selectCollector = selectMsg.createMessageComponentCollector({ time: 30000 });

        selectCollector.on('collect', async si => {
            if (si.user.id !== p1.id && si.user.id !== p2.id) return si.reply({ content: "Bạn không ở trong trận này!", ephemeral: true });
            selections.set(si.user.id, BOXERS.find(b => b.id === si.values[0]));
            await si.reply({ content: `Bạn đã chọn **${si.values[0].toUpperCase()}**!`, ephemeral: true });
            if (selections.size === 2) selectCollector.stop();
        });

        selectCollector.on('end', async () => {
            if (selections.size < 2) return channel.send("Trận đấu bị hủy do không chọn võ sĩ kịp thời.");
            await selectMsg.delete();
            runSoloFight(channel, p1, p2, selections.get(p1.id), selections.get(p2.id));
        });
    });
}

async function runSoloFight(channel, p1, p2, f1, f2) {
    let hp1 = f1.hp, hp2 = f2.hp;
    const fightMsg = await channel.send("🔔 **TIẾNG CHUÔNG VANG LÊN! TRẬN ĐẤU BẮT ĐẦU!**");

    for (let round = 1; round <= 3; round++) {
        const moveRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("atk").setLabel("Tấn Công").setStyle(ButtonStyle.Danger).setEmoji("🥊"),
            new ButtonBuilder().setCustomId("def").setLabel("Phòng Thủ").setStyle(ButtonStyle.Secondary).setEmoji("🛡️"),
            new ButtonBuilder().setCustomId("cnt").setLabel("Phản Đòn").setStyle(ButtonStyle.Primary).setEmoji("⚡")
        );

        const roundMsg = await channel.send({ 
            content: `**HIỆP ${round}**\n<@${p1.id}> & <@${p2.id}>, hãy chọn chiến thuật!`, 
            components: [moveRow] 
        });

        let moves = new Map();
        const moveCollector = roundMsg.createMessageComponentCollector({ time: 15000 });

        moveCollector.on('collect', async mi => {
            if (mi.user.id !== p1.id && mi.user.id !== p2.id) return;
            moves.set(mi.user.id, mi.customId);
            await mi.reply({ content: "Đã ghi nhận chiến thuật!", ephemeral: true });
            if (moves.size === 2) moveCollector.stop();
        });

        await new Promise(res => moveCollector.on('end', res));
        await roundMsg.delete();

        // Tính toán damage
        const move1 = moves.get(p1.id) || "atk";
        const move2 = moves.get(p2.id) || "atk";

        let dmg1 = Math.floor(Math.random() * f1.atk);
        let dmg2 = Math.floor(Math.random() * f2.atk);

        // Logic khắc chế: CNT > ATK, DEF > ATK
        if (move1 === "cnt" && move2 === "atk") dmg1 *= 2.5; 
        if (move2 === "cnt" && move1 === "atk") dmg2 *= 2.5;
        if (move1 === "def") dmg2 = Math.floor(dmg2 * 0.2);
        if (move2 === "def") dmg1 = Math.floor(dmg1 * 0.2);

        hp1 -= dmg2;
        hp2 -= dmg1;

        const embed = new EmbedBuilder()
            .setTitle(`🥊 KẾT THÚC HIỆP ${round}`)
            .addFields(
                { name: `🔴 ${p1.username} (${f1.name})`, value: `Hành động: ${move1.toUpperCase()}\nHP: ${createHpBar(hp1, f1.hp)}`, inline: false },
                { name: `🔵 ${p2.username} (${f2.name})`, value: `Hành động: ${move2.toUpperCase()}\nHP: ${createHpBar(hp2, f2.hp)}`, inline: false }
            )
            .setColor(0xE67E22);

        await channel.send({ embeds: [embed] });
        if (hp1 <= 0 || hp2 <= 0) break;
        await new Promise(r => setTimeout(r, 2000));
    }

    const winner = hp1 > hp2 ? p1 : p2;
    await channel.send(`🏆 **KẾT THÚC!** Người chiến thắng cuối cùng là <@${winner.id}>!`);
}

// ==========================================
// 4. LỆNH CHÍNH
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
                { name: "⚔️ Solo 1vs1", value: "Thách đấu người chơi khác trực tiếp.", inline: true },
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
                await startSoloMatch(i, i.user);
            } else if (i.customId === "mode_tourney") {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "Chỉ người gõ lệnh mới được khởi tạo!", ephemeral: true });
                await i.update({ content: "🔥 **GIẢI ĐẤU BẮT ĐẦU!**", embeds: [], components: [] });
                // Hàm runTournament cũ của bạn
                runTournament(interaction); 
            }
        });
    }
};

// Copy các hàm aiFight, simulatePhase, runTournament cũ của bạn dán xuống dưới cùng này...