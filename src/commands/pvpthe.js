const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const arenas = new Map();

// Công thức DPS đồng bộ /tuido
function calculateDPS(card) {
    const level = card.level || 1;
    const base = card.hp * 0.1 + card.atk * 2 + card.def * 1.5 + card.mdef * 1.5 + card.spd * 5;
    const offensive = card.atkSpd * 100 * (1 + (card.critRate / 100) * (card.critDmg / 100));
    return Math.floor((base + offensive) * (1 + (level - 1) * 0.05));
}

const HIT_FLAVOR = [
    "tung chiêu chí mạng", "lao vào combo tốc độ", "giáng đòn trời long đất lở",
    "ra tuyệt kỹ bí truyền", "đánh úp từ phía sau", "nổ sát thương bạo kích",
];

function renderLobby(arena) {
    const p1Card = arena.p1.card ? `🎴 **${arena.p1.card.name}** (Lv.${arena.p1.card.level || 1}) — 🔥 \`${money(calculateDPS(arena.p1.card))}\`` : "🤔 *Đang chọn tướng...*";
    const p2Card = !arena.p2.id ? "📢 *Đang chờ đối thủ nhận kèo...*"
        : arena.p2.card ? `🎴 **${arena.p2.card.name}** (Lv.${arena.p2.card.level || 1}) — 🔥 \`${money(calculateDPS(arena.p2.card))}\`` : "🤔 *Đang chọn tướng...*";

    return casinoEmbed({ color: COLORS.purple, title: "⚔️ ✦ ĐẤU TRƯỜNG THẺ BÀI ✦ ⚔️" })
        .setDescription(
            `> 💰 Cược: ${vnd(arena.bet)} — kẻ thắng ẵm trọn!\n${"─".repeat(25)}\n` +
            `🥊 **Đấu sĩ 1:** <@${arena.p1.id}>\n${p1Card}\n\n` +
            `🥊 **Đấu sĩ 2:** ${arena.p2.id ? `<@${arena.p2.id}>` : "**AI CŨNG ĐƯỢC!**"}\n${p2Card}`
        )
        .setFooter({ text: "💡 Cả 2 chọn tướng xong, trận đấu tự động bắt đầu!" });
}

function pickMenu(userId, cards) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`dauthe_pick_${userId}`)
            .setPlaceholder("🎴 Chọn chiến binh ra trận...")
            .addOptions(cards.slice(0, 5).map((c, i) => ({
                label: `${c.name} (Lv.${c.level || 1})`.slice(0, 100),
                description: `Lực chiến: ${money(calculateDPS(c))}`,
                value: i.toString(),
            })))
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dauthe")
        .setDescription("⚔️ Đấu Trường PvP - Mang thẻ bài ra solo cược tiền!")
        .addIntegerOption((opt) => opt.setName("tiencuoc").setDescription("Tiền cược").setRequired(true).setMinValue(1000))
        .addUserOption((opt) => opt.setName("doithu").setDescription("Tag người thách đấu (để trống = kèo mở)")),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const target = interaction.options.getUser("doithu");

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < bet) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (!user.cards || user.cards.length === 0) return interaction.reply({ content: "❌ Bạn chưa có thẻ bài nào! Ghé /shopthe mua thẻ đã.", flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });
        if (target) {
            if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Không thể tự đấu với mình!", flags: 64 });
            if (target.bot) return interaction.reply({ content: "❌ Bot không có thẻ bài đâu!", flags: 64 });
        }

        const arena = { bet, p1: { id: interaction.user.id, card: null }, p2: { id: target?.id || null, card: null }, started: false };

        await interaction.reply({
            content: target ? `🔔 <@${target.id}> — <@${interaction.user.id}> thách đấu bạn!` : "📢 **KÈO ĐẤU THẺ MỞ!** Ai dám nhận?",
            embeds: [renderLobby(arena)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("dauthe_join").setLabel("Nhận kèo & chọn tướng").setEmoji("⚔️").setStyle(ButtonStyle.Success)
                ),
            ],
        });
        const msg = await interaction.fetchReply();
        arenas.set(msg.id, arena);

        // Người tạo chọn tướng ngay (ẩn)
        await interaction.followUp({ content: "🎴 Chọn tướng ra trận của bạn:", components: [pickMenu(interaction.user.id, user.cards)], flags: 64 });
    },

    async handleButton(interaction) {
        const arena = arenas.get(interaction.message.id);
        if (!arena || arena.started) return interaction.reply({ content: "❌ Trận đấu đã bắt đầu hoặc kết thúc!", flags: 64 });

        if (interaction.customId === "dauthe_join") {
            if (interaction.user.id === arena.p1.id) return interaction.reply({ content: "❌ Bạn là người tạo kèo rồi!", flags: 64 });
            if (arena.p2.id && interaction.user.id !== arena.p2.id) return interaction.reply({ content: "❌ Kèo này đã có đối thủ chỉ định!", flags: 64 });

            const user = await User.findOne({ userId: interaction.user.id });
            if (!user || user.money < arena.bet) return interaction.reply({ content: `❌ Cần ${vnd(arena.bet)} để nhận kèo!`, flags: 64 });
            if (!user.cards || user.cards.length === 0) return interaction.reply({ content: "❌ Bạn chưa có thẻ bài nào!", flags: 64 });
            if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

            arena.p2.id = interaction.user.id;
            await interaction.message.edit({ embeds: [renderLobby(arena)] }).catch(() => {});
            return interaction.reply({ content: "🎴 Chọn tướng ra trận của bạn:", components: [pickMenu(interaction.user.id, user.cards)], flags: 64 });
        }
    },

    async handleMenu(interaction) {
        const parts = interaction.customId.split("_");
        if (parts[1] !== "pick") return;
        const ownerId = parts[2];
        if (interaction.user.id !== ownerId) return interaction.reply({ content: "❌ Menu không dành cho bạn!", flags: 64 });

        // Tìm arena mà người này tham gia
        let arena, arenaMsgId;
        for (const [id, a] of arenas.entries()) {
            if ((a.p1.id === ownerId || a.p2.id === ownerId) && !a.started) { arena = a; arenaMsgId = id; break; }
        }
        if (!arena) return interaction.reply({ content: "❌ Không tìm thấy trận đấu!", flags: 64 });

        const user = await User.findOne({ userId: ownerId });
        const card = user.cards[parseInt(interaction.values[0])];
        if (!card) return interaction.reply({ content: "❌ Thẻ không hợp lệ!", flags: 64 });

        const side = arena.p1.id === ownerId ? arena.p1 : arena.p2;
        side.card = card;
        await interaction.update({ content: `✅ Đã chọn **${card.name}** (🔥 ${money(calculateDPS(card))}) — chờ đối thủ!`, components: [] });

        // Cập nhật sảnh
        const channel = await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
        const arenaMsg = channel ? await channel.messages.fetch(arenaMsgId).catch(() => null) : null;
        if (arenaMsg) await arenaMsg.edit({ embeds: [renderLobby(arena)] }).catch(() => {});

        // Cả 2 đã chọn → chiến!
        if (arena.p1.card && arena.p2.card && !arena.started) {
            arena.started = true;
            await startBattle(interaction, arena, arenaMsg, arenaMsgId);
        }
    },
};

async function startBattle(interaction, arena, arenaMsg, msgId) {
    // Trừ tiền cược 2 bên
    for (const pid of [arena.p1.id, arena.p2.id]) {
        await User.findOneAndUpdate({ userId: pid }, { $inc: { money: -arena.bet } });
    }

    const dps1 = calculateDPS(arena.p1.card), dps2 = calculateDPS(arena.p2.card);
    // HP trận = HP thẻ x10 để trận kéo dài vài lượt
    let hp1 = arena.p1.card.hp * 10, hp2 = arena.p2.card.hp * 10;
    const maxHp1 = hp1, maxHp2 = hp2;

    const editArena = async (payload) => {
        if (arenaMsg) return arenaMsg.edit(payload).catch(() => {});
        return safeEdit(interaction, payload, msgId);
    };

    const battleEmbed = (log) =>
        casinoEmbed({ color: COLORS.orange, title: "⚔️ TRẬN ĐẤU ĐANG DIỄN RA!" })
            .setDescription(
                `🅰️ **${arena.p1.card.name}** \`${Math.max(0, Math.round(hp1))}/${maxHp1}\`\n${bar(hp1 / maxHp1, 12, "🟥", "⬛")}\n\n` +
                `🅱️ **${arena.p2.card.name}** \`${Math.max(0, Math.round(hp2))}/${maxHp2}\`\n${bar(hp2 / maxHp2, 12, "🟦", "⬛")}\n\n` +
                `📣 ${log}`
            )
            .setFooter({ text: "🎙️ Đấu trường BOT Casino" });

    await editArena({ content: null, embeds: [battleEmbed("Trận đấu bắt đầu! Hai chiến binh lao vào nhau! 💥")], components: [] });
    await sleep(1500);

    let turn = dps1 >= dps2 ? 1 : 2; // Ai DPS cao đánh trước
    let round = 0;
    while (hp1 > 0 && hp2 > 0 && round < 12) {
        round++;
        const critMul = Math.random() < 0.2 ? 1.8 : 1; // 20% bạo kích
        if (turn === 1) {
            const dmg = Math.round(dps1 * (0.8 + Math.random() * 0.4) * critMul);
            hp2 -= dmg;
            await editArena({ embeds: [battleEmbed(`🅰️ **${arena.p1.card.name}** ${HIT_FLAVOR[Math.floor(Math.random() * HIT_FLAVOR.length)]}, gây **${money(dmg)}** sát thương!${critMul > 1 ? " 💥 BẠO KÍCH!" : ""}`)] });
            turn = 2;
        } else {
            const dmg = Math.round(dps2 * (0.8 + Math.random() * 0.4) * critMul);
            hp1 -= dmg;
            await editArena({ embeds: [battleEmbed(`🅱️ **${arena.p2.card.name}** ${HIT_FLAVOR[Math.floor(Math.random() * HIT_FLAVOR.length)]}, gây **${money(dmg)}** sát thương!${critMul > 1 ? " 💥 BẠO KÍCH!" : ""}`)] });
            turn = 1;
        }
        await sleep(1600);
    }

    // Xác định người thắng (nếu hết 12 lượt thì ai còn nhiều HP % hơn)
    const winnerSide = (hp1 <= 0 ? arena.p2 : hp2 <= 0 ? arena.p1 : (hp1 / maxHp1 >= hp2 / maxHp2 ? arena.p1 : arena.p2));
    const loserSide = winnerSide === arena.p1 ? arena.p2 : arena.p1;
    const prize = arena.bet * 2;

    const winUser = await User.findOne({ userId: winnerSide.id });
    winUser.money += prize;
    if (winUser.stats) { winUser.stats.win++; winUser.stats.gamblePlayed++; }
    await winUser.save();
    const loseUser = await User.findOne({ userId: loserSide.id });
    if (loseUser?.stats) { loseUser.stats.lose++; loseUser.stats.gamblePlayed++; await loseUser.save(); }

    await editArena({
        embeds: [casinoEmbed({ color: COLORS.gold, title: "🏆 KẾT THÚC TRẬN ĐẤU!" })
            .setDescription(
                `# 👑 ${winnerSide.card.name} CHIẾN THẮNG!\n` +
                `> 🎴 Của <@${winnerSide.id}>\n` +
                `> ⚰️ Hạ gục **${loserSide.card.name}** của <@${loserSide.id}>\n${"─".repeat(25)}\n` +
                `💰 <@${winnerSide.id}> ẵm trọn **+${money(prize)} VND**!`
            )
            .setFooter({ text: "⚔️ Gõ /dauthe để mở kèo đấu mới!" })],
        components: [],
    });
    arenas.delete(msgId);
}