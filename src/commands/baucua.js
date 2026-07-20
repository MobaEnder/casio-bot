const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit, sleep } = require("../utils/ui");
const JackpotPool = require("../utils/jackpotPool");

const games = new Map();
const BET_TIME = 30000;
const LIVE_UPDATE_MS = 5000;

const EMOJIS = { bau: "🎃", cua: "🦀", tom: "🦐", ca: "🐟", ga: "🐓", nai: "🦌" };
const NAMES = { bau: "Bầu", cua: "Cua", tom: "Tôm", ca: "Cá", ga: "Gà", nai: "Nai" };
const FACES = Object.keys(EMOJIS);

// ---------- VẼ BÀN CƯỢC LIVE ----------
function renderLobby(game) {
    const totals = {};
    const counts = {};
    for (const f of FACES) { totals[f] = 0; counts[f] = 0; }
    for (const bet of game.bets.values()) {
        totals[bet.face] += bet.amount;
        counts[bet.face]++;
    }
    const pot = Object.values(totals).reduce((a, b) => a + b, 0);

    const embed = casinoEmbed({
        color: COLORS.green,
        title: "🎃🦀🦐 SÒNG BẦU CUA TÔM CÁ 🐟🐓🦌",
    })
        .setDescription(
            `> 🎯 Trúng 1 mặt ăn **x2**, trúng 2 mặt **x3**, trúng cả 3 **x4**!\n\n` +
            `⏳ **Xóc đĩa ${countdown(game.endsAt)}** — ${countdown(game.endsAt, "T")}\n` +
            `💰 **Tổng hũ:** ${vnd(pot)} • 🎫 **${game.bets.size}** vé cược`
        );

    for (const f of FACES) {
        embed.addFields({
            name: `${EMOJIS[f]} ${NAMES[f].toUpperCase()}`,
            value: `💵 \`${money(totals[f])}\`\n👥 ${counts[f]} người`,
            inline: true,
        });
    }
    return embed.setFooter({ text: "💡 Bấm nút chọn linh vật để xuống tiền!" });
}

function lobbyButtons(disabled = false) {
    const row1 = new ActionRowBuilder().addComponents(
        ...["bau", "cua", "tom"].map((f) =>
            new ButtonBuilder().setCustomId(`baucua_${f}`).setLabel(NAMES[f]).setEmoji(EMOJIS[f]).setStyle(ButtonStyle.Success).setDisabled(disabled)
        )
    );
    const row2 = new ActionRowBuilder().addComponents(
        ...["ca", "ga", "nai"].map((f) =>
            new ButtonBuilder().setCustomId(`baucua_${f}`).setLabel(NAMES[f]).setEmoji(EMOJIS[f]).setStyle(ButtonStyle.Primary).setDisabled(disabled)
        )
    );
    return [row1, row2];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baucua")
        .setDescription("🎃 Mở sòng Bầu Cua Tôm Cá - Xóc đĩa online"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user?.banned) {
            return interaction.reply({ content: "⛔ Bạn đang bị phong tỏa tài sản!", flags: 64 });
        }

        const endsAt = Date.now() + BET_TIME;
        const gameData = { bets: new Map(), endsAt, locked: false };

        await interaction.reply({ embeds: [renderLobby(gameData)], components: lobbyButtons() });
        const msg = await interaction.fetchReply();
        games.set(msg.id, gameData);

        // 🔄 Cập nhật bàn cược live
        const liveInterval = setInterval(async () => {
            const g = games.get(msg.id);
            if (!g || g.locked) return clearInterval(liveInterval);
            await safeEdit(interaction, { embeds: [renderLobby(g)] }, msg.id);
        }, LIVE_UPDATE_MS);

        setTimeout(async () => {
          try {
            clearInterval(liveInterval);
            const game = games.get(msg.id);
            if (!game) return;
            game.locked = true;

            // ---------- LÕI KẾT QUẢ (giữ logic né mặt được cược nhiều) ----------
            let rolls = [];
            const betFaces = Array.from(new Set(Array.from(game.bets.values()).map((b) => b.face)));

            for (let i = 0; i < 3; i++) {
                let face;
                if (betFaces.length > 0 && Math.random() < 0.6) {
                    const nonBet = FACES.filter((f) => !betFaces.includes(f));
                    face = nonBet.length > 0
                        ? nonBet[Math.floor(Math.random() * nonBet.length)]
                        : FACES[Math.floor(Math.random() * FACES.length)];
                } else {
                    face = FACES[Math.floor(Math.random() * FACES.length)];
                }
                rolls.push(face);
            }

            // ---------- 🎬 ANIMATION XÓC ĐĨA ----------
            const shakeFrames = [
                "```\n   ╭─────────────╮\n   │  🥣 ⚡ 🍽️  │\n   │ ĐANG XÓC ĐĨA │\n   ╰─────────────╯```",
                "```\n   ╭─────────────╮\n   │  💨 🌀 💨  │\n   │  XÓC MẠNH!! │\n   ╰─────────────╯```",
                `\`\`\`\n   ╭─────────────╮\n   │  ${EMOJIS[rolls[0]]} ❓ ❓  │\n   │  MỞ BÁT.... │\n   ╰─────────────╯\`\`\``,
                `\`\`\`\n   ╭─────────────╮\n   │  ${EMOJIS[rolls[0]]} ${EMOJIS[rolls[1]]} ❓  │\n   │ CON CUỐI LÀ? │\n   ╰─────────────╯\`\`\``,
            ];
            for (const frame of shakeFrames) {
                await safeEdit(interaction, {
                    embeds: [casinoEmbed({ color: COLORS.orange, title: "🥣 NHÀ CÁI ĐANG XÓC ĐĨA...", description: frame })],
                    components: lobbyButtons(true),
                }, msg.id);
                await sleep(1200);
            }

            // ---------- TRẢ THƯỞNG ----------
            let winners = [], losers = [];
            for (const [userId, bet] of game.bets.entries()) {
                const uData = await User.findOne({ userId });
                if (!uData) continue;
                let usedBuffs = [];

                const hits = rolls.filter((r) => r === bet.face).length;

                if (hits > 0) {
                    if (uData.buffs?.winRateBoost > 0) {
                        usedBuffs.push(`🍀${uData.buffs.winRateBoost * 100}%`);
                        uData.buffs.winRateBoost = 0;
                    }
                    const winAmt = bet.amount * (hits + 1);
                    uData.money += winAmt;
                    uData.stats.win++;
                    winners.push(`> 💸 <@${userId}> ${EMOJIS[bet.face]} x${hits} → **+${money(winAmt - bet.amount)}**${usedBuffs.length ? " " + usedBuffs.join(" ") : ""}`);
                } else {
                    let lossAmount = bet.amount;
                    if (uData.buffs?.shield > 0) {
                        const reducedLoss = bet.amount * (1 - uData.buffs.shield);
                        uData.money += Math.floor(bet.amount - reducedLoss);
                        lossAmount = Math.floor(reducedLoss);
                        usedBuffs.push(`🔰${uData.buffs.shield * 100}%`);
                        uData.buffs.shield = 0;
                    }
                    if (uData.buffs?.winRateBoost > 0) {
                        usedBuffs.push("🍀 mất bùa");
                        uData.buffs.winRateBoost = 0;
                    }
                    uData.stats.lose++;
                    losers.push(`> 🕳️ <@${userId}> ${EMOJIS[bet.face]} trượt → **-${money(lossAmount)}**${usedBuffs.length ? " " + usedBuffs.join(" ") : ""}`);
                }
                uData.stats.gamblePlayed++;
                await uData.save();
                if (rolls.filter((r) => r === bet.face).length === 0) JackpotPool.contribute(bet.amount);
                JackpotPool.tryExplode(interaction.client, interaction.channelId, userId);
            }

            // ---------- 🏆 KẾT QUẢ VIP ----------
            const resultEmbed = casinoEmbed({
                color: COLORS.gold,
                title: "🎉 MỞ BÁT — KẾT QUẢ BẦU CUA 🎉",
            })
                .setDescription(
                    `# ${rolls.map((r) => EMOJIS[r]).join(" ")}\n` +
                    `## ${rolls.map((r) => `**${NAMES[r]}**`).join(" • ")}\n` +
                    `${"─".repeat(25)}\n` +
                    `🏆 **NGƯỜI THẮNG (${winners.length})**\n${winners.slice(0, 8).join("\n") || "> 😢 Không ai ăn được nhà cái!"}` +
                    (winners.length > 8 ? `\n> *...và ${winners.length - 8} người khác*` : "") +
                    `\n\n💀 **NGƯỜI THUA (${losers.length})**\n${losers.slice(0, 8).join("\n") || "> 😎 Không ai mất xu nào!"}` +
                    (losers.length > 8 ? `\n> *...và ${losers.length - 8} người khác*` : "")
                )
                .setFooter({ text: "🎃 Bùa/Khiên tự động áp dụng • Gõ /baucua để chơi tiếp!" });

            await safeEdit(interaction, { embeds: [resultEmbed], components: [] }, msg.id);
          } catch (err) {
            console.error("❌ [baucua] Lỗi khi xử lý kết quả:", err);
          } finally {
            games.delete(msg.id);
          }
        }, BET_TIME);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.locked) return interaction.reply({ content: "❌ Bàn này đã đóng!", flags: 64 });
        if (game.bets.has(interaction.user.id)) {
            const old = game.bets.get(interaction.user.id);
            return interaction.reply({ content: `❌ Bạn đã cược ${vnd(old.amount)} vào ${EMOJIS[old.face]} **${NAMES[old.face]}** rồi!`, flags: 64 });
        }

        const face = interaction.customId.split("_")[1];
        const modal = new ModalBuilder()
            .setCustomId(`baucua_modal_${face}`)
            .setTitle(`${EMOJIS[face]} Cược ${NAMES[face]} — nhập tiền`);
        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền bạn muốn đặt (tối thiểu 1.000):")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("VD: 20000");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const face = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount").replace(/[.,\s]/g, ""));
        const game = games.get(interaction.message.id);

        if (!game || game.locked || Date.now() >= game.endsAt) {
            return interaction.reply({ content: "❌ Bàn đã kết thúc! Tiền của bạn KHÔNG bị trừ.", flags: 64 });
        }
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tiền cược không hợp lệ (tối thiểu 1.000)!", flags: 64 });

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });
        if (user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user.money)}!`, flags: 64 });

        user.money -= amount;
        await user.save();
        game.bets.set(interaction.user.id, { face, amount });

        await interaction.reply({
            content: `✅ Đã xuống ${vnd(amount)} vào ${EMOJIS[face]} **${NAMES[face].toUpperCase()}**!\n💼 Ví còn: ${vnd(user.money)} • Xóc đĩa ${countdown(game.endsAt)}`,
            flags: 64,
        });
    },
};