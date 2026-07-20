// src/utils/petBattle.js — ENGINE PVP PET (1v1 → 3v3)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed, safeEdit, sleep } = require("./ui");
const { petStats, petPower, petDisplay } = require("./petData");

const battles = new Map();

const CLASH_FLAVOR = [
    "lao vào cắn xé dữ dội!", "tung tuyệt chiêu bản mệnh!", "quần thảo mù mịt khói bụi!",
    "phản đòn cực gắt!", "dồn ép đối thủ vào góc!",
];

function renderLobby(b) {
    const teamLine = (side) => {
        if (!side.id) return "📢 *Đang chờ đối thủ nhận kèo...*";
        if (!side.team) return "🤔 *Đang chọn đội hình...*";
        return side.team.map((p) => {
            const d = petDisplay(p);
            return `> ${d.emoji} **${d.name}** Lv.${p.level} ⚡\`${money(petPower(p))}\``;
        }).join("\n");
    };
    return casinoEmbed({ color: COLORS.purple, title: `🐾⚔️ ĐẤU TRƯỜNG PET ${b.size}v${b.size} ⚔️🐾` })
        .setDescription(
            `> 💰 Cược: ${vnd(b.bet)} — thắng ăn trọn **${money(b.bet * 2)}**!\n${"─".repeat(25)}\n` +
            `🅰️ **<@${b.p1.id}>**\n${teamLine(b.p1)}\n\n` +
            `🅱️ ${b.p2.id ? `**<@${b.p2.id}>**` : "**AI CŨNG ĐƯỢC!**"}\n${teamLine(b.p2)}`
        )
        .setFooter({ text: `💡 Cần ${b.size} pet mỗi bên • Cả 2 chọn xong là chiến luôn!` });
}

function pickMenu(userId, pets, size) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pet_pvppick_${userId}`)
            .setPlaceholder(`🐾 Chọn đúng ${size} pet ra trận...`)
            .setMinValues(size)
            .setMaxValues(size)
            .addOptions(pets.slice(0, 6).map((p) => {
                const d = petDisplay(p);
                return { label: `${d.name} Lv.${p.level} — ⚡${money(petPower(p))}`.slice(0, 100), value: p.id, emoji: d.emoji.length <= 4 ? d.emoji : "🐾" };
            }))
    );
}

// ================== TẠO SẢNH ==================
async function createLobby(interaction, user) {
    const bet = interaction.options.getInteger("tiencuoc");
    const size = interaction.options.getInteger("doihinh");
    const target = interaction.options.getUser("doithu");

    if (user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user.money)}!`, flags: 64 });
    if ((user.pets || []).length < size) return interaction.reply({ content: `❌ Đội hình ${size}v${size} cần ít nhất **${size} pet**! Bạn mới có ${(user.pets || []).length}. Ghé /pet shop mua trứng thêm.`, flags: 64 });
    if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });
    if (target) {
        if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Pet nhà đánh nhau à? Không được!", flags: 64 });
        if (target.bot) return interaction.reply({ content: "❌ Bot không nuôi pet!", flags: 64 });
    }

    const battle = { bet, size, started: false, p1: { id: interaction.user.id, team: null }, p2: { id: target?.id || null, team: null } };

    await interaction.reply({
        content: target ? `🔔 <@${target.id}> — có kèo đấu pet ${size}v${size} gọi tên bạn!` : `📢 **KÈO ĐẤU PET ${size}v${size} MỞ!** Ai dám nhận?`,
        embeds: [renderLobby(battle)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pet_pvpjoin").setLabel("Nhận kèo").setEmoji("⚔️").setStyle(ButtonStyle.Danger)
        )],
    });
    const msg = await interaction.fetchReply();
    battle.msgId = msg.id;
    battle.channelId = interaction.channelId;
    battles.set(msg.id, battle);

    // Chủ kèo chọn đội ngay
    await interaction.followUp({ content: `🐾 Chọn **${size}** pet ra trận:`, components: [pickMenu(interaction.user.id, user.pets, size)], flags: 64 });
}

// ================== NÚT NHẬN KÈO ==================
async function handleButton(interaction) {
    const battle = battles.get(interaction.message.id);
    if (!battle || battle.started) return interaction.reply({ content: "❌ Kèo đã bắt đầu hoặc kết thúc!", flags: 64 });

    if (interaction.user.id === battle.p1.id) return interaction.reply({ content: "❌ Bạn là chủ kèo rồi, chọn đội trong tin nhắn ẩn kia kìa!", flags: 64 });
    if (battle.p2.id && interaction.user.id !== battle.p2.id) return interaction.reply({ content: "❌ Kèo này dành cho người khác!", flags: 64 });

    const user = await User.findOne({ userId: interaction.user.id });
    if (!user || user.money < battle.bet) return interaction.reply({ content: `❌ Cần ${vnd(battle.bet)} để nhận kèo!`, flags: 64 });
    if ((user.pets || []).length < battle.size) return interaction.reply({ content: `❌ Cần ít nhất ${battle.size} pet!`, flags: 64 });
    if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

    battle.p2.id = interaction.user.id;
    await interaction.message.edit({ embeds: [renderLobby(battle)] }).catch(() => {});
    return interaction.reply({ content: `🐾 Chọn **${battle.size}** pet ra trận:`, components: [pickMenu(interaction.user.id, user.pets, battle.size)], flags: 64 });
}

// ================== MENU CHỌN ĐỘI ==================
async function handleMenu(interaction) {
    const ownerId = interaction.customId.split("_")[2];
    if (interaction.user.id !== ownerId) return interaction.reply({ content: "❌ Menu không dành cho bạn!", flags: 64 });

    let battle;
    for (const b of battles.values()) {
        if (!b.started && (b.p1.id === ownerId || b.p2.id === ownerId)) { battle = b; break; }
    }
    if (!battle) return interaction.reply({ content: "❌ Không tìm thấy kèo đấu!", flags: 64 });

    const user = await User.findOne({ userId: ownerId });
    const team = interaction.values.map((id) => (user.pets || []).find((p) => p.id === id)).filter(Boolean);
    if (team.length !== battle.size) return interaction.reply({ content: "❌ Đội hình không hợp lệ!", flags: 64 });

    const side = battle.p1.id === ownerId ? battle.p1 : battle.p2;
    side.team = team;
    await interaction.update({ content: `✅ Đội hình đã khóa: ${team.map((p) => petDisplay(p).emoji).join(" ")} — chờ khai chiến!`, components: [] });

    const channel = await interaction.client.channels.fetch(battle.channelId).catch(() => null);
    const msg = channel ? await channel.messages.fetch(battle.msgId).catch(() => null) : null;
    if (msg) await msg.edit({ embeds: [renderLobby(battle)] }).catch(() => {});

    if (battle.p1.team && battle.p2.team && !battle.started) {
        battle.started = true;
        await runBattle(interaction, battle, msg);
    }
}

// ================== ⚔️ TRẬN ĐẤU ==================
async function runBattle(interaction, b, msg) {
    // Trừ tiền 2 bên
    for (const id of [b.p1.id, b.p2.id]) {
        await User.findOneAndUpdate({ userId: id }, { $inc: { money: -b.bet } });
    }

    const edit = (payload) => (msg ? msg.edit(payload).catch(() => {}) : safeEdit(interaction, payload, b.msgId));

    let score1 = 0, score2 = 0;
    const roundLogs = [];

    for (let i = 0; i < b.size; i++) {
        const A = b.p1.team[i], B = b.p2.team[i];
        const dA = petDisplay(A), dB = petDisplay(B);
        const sA = petStats(A), sB = petStats(B);
        let hpA = sA.hp, hpB = sB.hp;

        const frame = (log) =>
            casinoEmbed({ color: COLORS.orange, title: `⚔️ TRẬN ${i + 1}/${b.size}: ${dA.emoji} ${dA.name} 🆚 ${dB.emoji} ${dB.name}` })
                .setDescription(
                    `📊 Tỉ số: 🅰️ **${score1}** — **${score2}** 🅱️\n${"─".repeat(25)}\n` +
                    `🅰️ ${dA.emoji} **${dA.name}** \`${Math.max(0, Math.round(hpA))}/${sA.hp}\`\n${bar(hpA / sA.hp, 11, "🟥", "⬛")}\n\n` +
                    `🅱️ ${dB.emoji} **${dB.name}** \`${Math.max(0, Math.round(hpB))}/${sB.hp}\`\n${bar(hpB / sB.hp, 11, "🟦", "⬛")}\n\n📣 ${log}`
                )
                .setFooter({ text: `🏆 Đội thắng ${Math.ceil(b.size / 2)}+ trận ăn trọn ${money(b.bet * 2)} VND` });

        await edit({ content: null, embeds: [frame(`${dA.emoji} và ${dB.emoji} gầm gừ nhìn nhau... KHAI CHIẾN! 💥`)], components: [] });
        await sleep(1600);

        // Đấu theo lượt: SPD cao đánh trước, damage = ATK biến thiên - DEF/2
        let turnA = sA.spd >= sB.spd;
        let rounds = 0;
        while (hpA > 0 && hpB > 0 && rounds < 10) {
            rounds++;
            const crit = Math.random() < 0.18 ? 1.7 : 1;
            if (turnA) {
                const dmg = Math.max(5, Math.round((sA.atk * (0.9 + Math.random() * 0.4) - sB.def * 0.4) * crit));
                hpB -= dmg;
                await edit({ embeds: [frame(`${dA.emoji} **${dA.name}** ${CLASH_FLAVOR[rounds % CLASH_FLAVOR.length]} Gây **${dmg}** sát thương!${crit > 1 ? " 💥CHÍ MẠNG!" : ""}`)] });
            } else {
                const dmg = Math.max(5, Math.round((sB.atk * (0.9 + Math.random() * 0.4) - sA.def * 0.4) * crit));
                hpA -= dmg;
                await edit({ embeds: [frame(`${dB.emoji} **${dB.name}** ${CLASH_FLAVOR[rounds % CLASH_FLAVOR.length]} Gây **${dmg}** sát thương!${crit > 1 ? " 💥CHÍ MẠNG!" : ""}`)] });
            }
            turnA = !turnA;
            await sleep(1400);
        }

        const aWins = hpB <= 0 || (hpA > 0 && hpA / sA.hp >= hpB / sB.hp);
        if (aWins) { score1++; roundLogs.push(`> Trận ${i + 1}: ${dA.emoji} **${dA.name}** hạ ${dB.emoji} ${dB.name} 🅰️`); }
        else { score2++; roundLogs.push(`> Trận ${i + 1}: ${dB.emoji} **${dB.name}** hạ ${dA.emoji} ${dA.name} 🅱️`); }

        await edit({ embeds: [frame(aWins ? `🏁 ${dA.emoji} **${dA.name}** THẮNG trận ${i + 1}!` : `🏁 ${dB.emoji} **${dB.name}** THẮNG trận ${i + 1}!`)] });
        await sleep(1800);

        // Đủ số trận thắng thì dừng sớm
        if (score1 > b.size / 2 || score2 > b.size / 2) break;
    }

    // ================== TRẢ THƯỞNG ==================
    const p1Won = score1 > score2;
    const winnerId = p1Won ? b.p1.id : b.p2.id;
    const loserId = p1Won ? b.p2.id : b.p1.id;
    const winTeam = p1Won ? b.p1.team : b.p2.team;
    const loseTeam = p1Won ? b.p2.team : b.p1.team;
    const prize = b.bet * 2;

    // Cộng tiền + cập nhật thắng/thua cho pet
    const winUser = await User.findOne({ userId: winnerId });
    winUser.money += prize;
    if (winUser.stats) { winUser.stats.win++; winUser.stats.gamblePlayed++; }
    for (const p of winTeam) {
        const real = (winUser.pets || []).find((x) => x.id === p.id);
        if (real) real.wins = (real.wins || 0) + 1;
    }
    winUser.markModified("pets");
    await winUser.save();

    const loseUser = await User.findOne({ userId: loserId });
    if (loseUser) {
        if (loseUser.stats) { loseUser.stats.lose++; loseUser.stats.gamblePlayed++; }
        for (const p of loseTeam) {
            const real = (loseUser.pets || []).find((x) => x.id === p.id);
            if (real) real.losses = (real.losses || 0) + 1;
        }
        loseUser.markModified("pets");
        await loseUser.save();
    }

    await edit({
        embeds: [casinoEmbed({ color: COLORS.gold, title: `🏆 CHUNG CUỘC ${b.size}v${b.size}: ${p1Won ? score1 : score2} — ${p1Won ? score2 : score1}` })
            .setThumbnail(petDisplay(winTeam[0]).image)
            .setDescription(
                `# 👑 <@${winnerId}> TOÀN THẮNG!\n` +
                `> Đội hình vô địch: ${winTeam.map((p) => petDisplay(p).emoji).join(" ")}\n${"─".repeat(25)}\n` +
                `${roundLogs.join("\n")}\n${"─".repeat(25)}\n` +
                `💰 <@${winnerId}> ẵm trọn **+${money(prize)} VND**!\n😢 <@${loserId}> về chuồng luyện pet tiếp...`
            )
            .setFooter({ text: "🐾 Gõ /pet pvp để phục thù!" })],
        components: [],
    });
    battles.delete(b.msgId);
}

module.exports = { createLobby, handleButton, handleMenu };