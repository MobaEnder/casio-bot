const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const heists = new Map();
const HEIST_COOLDOWN = 2 * 60 * 60 * 1000; // 2h (lưu DB: lastHeist)
const ENTRY_FEE = 100000; // Vé tham gia mỗi người
const LOBBY_TIME = 60000;

const ROLES = ["🔫 Xạ Thủ", "🧨 Chuyên Gia Phá Két", "🚗 Tài Xế Tẩu Thoát", "👁️ Người Canh Gác"];

const HEIST_STAGES = [
    "🚗 Cả băng áp sát ngân hàng trong đêm...",
    "🧨 Chuyên gia đặt thuốc nổ phá cửa két...",
    "💰 Vàng và tiền mặt hiện ra lấp lánh...",
    "🚨 Còi báo động rú lên! Chạy!!!",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cuopnganhang")
        .setDescription("🏦 Lập băng cướp ngân hàng tổ đội (2-4 người) - Ăn cả ngã về không!"),

    async execute(interaction) {
        const leader = interaction.user;
        const leaderDB = await User.findOne({ userId: leader.id });

        if (!leaderDB || leaderDB.money < ENTRY_FEE) {
            return interaction.reply({ content: `❌ Cần ${vnd(ENTRY_FEE)} tiền "đồ nghề" để lập băng! Ví bạn còn ${vnd(leaderDB?.money || 0)}.`, flags: 64 });
        }
        if (leaderDB.banned) return interaction.reply({ content: "🚫 Bạn đang bị truy nã, nằm im đi!", flags: 64 });

        // Cooldown 2h
        if (Date.now() - (leaderDB.lastHeist || 0) < HEIST_COOLDOWN) {
            const readyAt = (leaderDB.lastHeist || 0) + HEIST_COOLDOWN;
            return interaction.reply({ content: `🚔 Cảnh sát đang truy lùng băng của bạn! Ẩn náu đến khi vụ việc lắng xuống ${countdown(readyAt)}.`, flags: 64 });
        }

        const heist = { leaderId: leader.id, members: [leader.id], started: false, endsAt: Date.now() + LOBBY_TIME };

        const renderLobby = () => {
            const slots = [];
            for (let i = 0; i < 4; i++) {
                slots.push(heist.members[i]
                    ? `> ${ROLES[i]} — <@${heist.members[i]}>${i === 0 ? " 👑" : ""}`
                    : `> ${ROLES[i]} — 💺 *trống*`);
            }
            const chance = 30 + (heist.members.length - 1) * 18; // 2 người:48%, 3:66%, 4:84%
            return casinoEmbed({ color: COLORS.dark, title: "🏦 ✦ PHI VỤ CƯỚP NGÂN HÀNG ✦ 🏦" })
                .setDescription(
                    `\`\`\`\n  🏦💰🏦\n  ▓▓ KÉT SẮT ▓▓\n\`\`\`` +
                    `> 👑 Băng trưởng: <@${heist.leaderId}>\n` +
                    `> 💵 Vé đồ nghề: \`${money(ENTRY_FEE)} VND\`/người\n` +
                    `> ⏳ Xuất phát ${countdown(heist.endsAt)}\n${"─".repeat(25)}\n` +
                    `**🎭 ĐỘI HÌNH (${heist.members.length}/4):**\n${slots.join("\n")}\n\n` +
                    `📊 **Tỉ lệ thành công hiện tại: ${chance}%** *(càng đông càng dễ ăn!)*\n` +
                    `💰 Loot dự kiến: **${money(500000 * heist.members.length)} - ${money(1500000 * heist.members.length)} VND** chia đều`
                )
                .setFooter({ text: "⚠️ Thất bại → CẢ BĂNG bị truy nã (cooldown 2h) + mất vé!" });
        };

        const lobbyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("cuopnganhang_join").setLabel("Nhập băng").setEmoji("🎭").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("cuopnganhang_start").setLabel("Xuất phát").setEmoji("🚗").setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [renderLobby()], components: [lobbyRow] });
        const msg = await interaction.fetchReply();
        heist.render = renderLobby;
        heists.set(msg.id, heist);

        const collector = msg.createMessageComponentCollector({ time: LOBBY_TIME });

        collector.on("collect", async (i) => {
            if (i.customId === "cuopnganhang_join") {
                if (heist.members.includes(i.user.id)) return i.reply({ content: "❌ Bạn đã ở trong băng!", flags: 64 });
                if (heist.members.length >= 4) return i.reply({ content: "❌ Băng đã đủ 4 người!", flags: 64 });

                const memberDB = await User.findOne({ userId: i.user.id });
                if (!memberDB || memberDB.money < ENTRY_FEE) return i.reply({ content: `❌ Cần ${vnd(ENTRY_FEE)} để nhập băng!`, flags: 64 });
                if (memberDB.banned) return i.reply({ content: "🚫 Bạn đang bị truy nã!", flags: 64 });
                if (Date.now() - (memberDB.lastHeist || 0) < HEIST_COOLDOWN) {
                    return i.reply({ content: `🚔 Bạn vừa đi cướp xong, đang bị truy lùng! Chờ ${countdown((memberDB.lastHeist || 0) + HEIST_COOLDOWN)}.`, flags: 64 });
                }

                heist.members.push(i.user.id);
                await i.deferUpdate();
                await interaction.editReply({ embeds: [heist.render()] });
            }

            if (i.customId === "cuopnganhang_start") {
                if (i.user.id !== heist.leaderId) return i.reply({ content: "❌ Chỉ băng trưởng mới hô xuất phát!", flags: 64 });
                if (heist.members.length < 2) return i.reply({ content: "❌ Cần ít nhất 2 người mới cướp được!", flags: 64 });
                await i.deferUpdate();
                collector.stop("go");
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason !== "go") {
                return interaction.editReply({ embeds: [casinoEmbed({ color: COLORS.dark, title: "🕐 PHI VỤ BỊ HỦY", description: "> Không đủ người... băng cướp giải tán trong im lặng." })], components: [] }).catch(() => {});
            }
            await runHeist(interaction, msg.id, heist);
        });
    },

    async handleButton() { /* xử lý trong collector */ },
};

async function runHeist(interaction, msgId, heist) {
    heist.started = true;

    // Trừ vé + set cooldown cho cả băng
    for (const id of heist.members) {
        await User.findOneAndUpdate({ userId: id }, { $inc: { money: -ENTRY_FEE }, $set: { lastHeist: Date.now() } });
    }

    // 🎬 Diễn hoạt cảnh cướp
    for (const stage of HEIST_STAGES) {
        await safeEdit(interaction, {
            embeds: [casinoEmbed({ color: COLORS.orange, title: "🏦 PHI VỤ ĐANG DIỄN RA...", description: `> ${stage}` })],
            components: [],
        }, msgId);
        await sleep(1600);
    }

    // Tính kết quả
    const chance = 30 + (heist.members.length - 1) * 18;
    const success = Math.random() * 100 < chance;

    if (success) {
        const totalLoot = Math.floor((Math.random() * 1000000 + 500000) * heist.members.length);
        const share = Math.floor(totalLoot / heist.members.length);

        const shareLines = [];
        for (let i = 0; i < heist.members.length; i++) {
            const id = heist.members[i];
            const u = await User.findOne({ userId: id });
            u.money += share;
            if (u.stats) { u.stats.win++; u.stats.gamblePlayed++; }
            await u.save();
            shareLines.push(`> ${ROLES[i]} <@${id}> — **+${money(share)}**`);
        }

        await safeEdit(interaction, {
            embeds: [casinoEmbed({ color: COLORS.gold, title: "💰 PHI VỤ THÀNH CÔNG — CƯỚP SẠCH KÉT!" })
                .setDescription(
                    `\`\`\`\n  🚗💨💰💰💰\n  (cả băng tẩu thoát êm đẹp)\n\`\`\`` +
                    `> 🎉 Băng của <@${heist.leaderId}> khoắng sạch **${money(totalLoot)} VND**!\n${"─".repeat(25)}\n` +
                    `**💸 CHIA CHÁC:**\n${shareLines.join("\n")}`
                )
                .setFooter({ text: "🏦 Cả băng bị truy nã 2h • /cuopnganhang lập vụ mới sau!" })],
            components: [],
        }, msgId);
    } else {
        const fine = Math.floor(Math.random() * 100000 + 50000);
        const fineLines = [];
        for (const id of heist.members) {
            const u = await User.findOne({ userId: id });
            u.money -= fine;
            if (u.stats) { u.stats.lose++; u.stats.gamblePlayed++; }
            await u.save();
            fineLines.push(`> 🚔 <@${id}> — nộp phạt **-${money(fine)}**`);
        }

        await safeEdit(interaction, {
            embeds: [casinoEmbed({ color: COLORS.red, title: "🚨 THẤT BẠI — CẢ BĂNG BỊ TÓM!" })
                .setDescription(
                    `\`\`\`\n  🚓🚓🚓\n  👮 (còng tay cả lũ)\n\`\`\`` +
                    `> ❌ Cảnh sát mai phục sẵn! Băng của <@${heist.leaderId}> sa lưới.\n${"─".repeat(25)}\n` +
                    `${fineLines.join("\n")}\n\n💸 Mất luôn tiền vé đồ nghề!`
                )
                .setFooter({ text: "🚔 Cả băng bị truy nã 2h • Lần sau rủ đông người hơn cho chắc ăn!" })],
            components: [],
        }, msgId);
    }
    heists.delete(msgId);
}