const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, versusBar, dice, casinoEmbed, safeEdit, sleep } = require("../utils/ui");
const JackpotPool = require("../utils/jackpotPool");

const games = new Map();
const BET_TIME = 30000; // 30 giây đặt cược
const LIVE_UPDATE_MS = 5000; // Cập nhật bảng cược mỗi 5s

// ---------- VẼ BẢNG SÒNG LIVE ----------
function renderLobby(game) {
    let totalTai = 0, totalXiu = 0, countTai = 0, countXiu = 0;
    for (const bet of game.bets.values()) {
        if (bet.choice === "tai") { totalTai += bet.amount; countTai++; }
        else { totalXiu += bet.amount; countXiu++; }
    }
    const pot = totalTai + totalXiu;

    return casinoEmbed({
        color: COLORS.gold,
        title: "🎲 ✦ SÒNG TÀI XỈU HOÀNG GIA ✦ 🎲",
    })
        .setDescription(
            `> 🔥 **TÀI** · tổng 11 – 17 ⠀|⠀ ❄️ **XỈU** · tổng 4 – 10\n` +
            `> 💰 Ăn ngay **x2** tiền cược!\n\n` +
            `⏳ **Chốt kèo ${countdown(game.endsAt)}** — ${countdown(game.endsAt, "T")}\n\n` +
            `${versusBar(totalTai, totalXiu, 12, "🟥", "🟦")}`
        )
        .addFields(
            {
                name: "🔥 CỬA TÀI",
                value: `💵 ${vnd(totalTai)}\n👥 **${countTai}** người`,
                inline: true,
            },
            {
                name: "⚡ TỔNG HŨ",
                value: `💰 ${vnd(pot)}\n🎫 **${game.bets.size}** vé cược`,
                inline: true,
            },
            {
                name: "❄️ CỬA XỈU",
                value: `💵 ${vnd(totalXiu)}\n👥 **${countXiu}** người`,
                inline: true,
            }
        )
        .setFooter({ text: "💡 Bấm nút để đặt cược • Không được đổi cửa sau khi đã đặt!" });
}

function lobbyButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("taixiu_tai").setLabel("CƯỢC TÀI").setEmoji("🔥").setStyle(ButtonStyle.Danger).setDisabled(disabled),
        new ButtonBuilder().setCustomId("taixiu_xiu").setLabel("CƯỢC XỈU").setEmoji("❄️").setStyle(ButtonStyle.Primary).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("taixiu")
        .setDescription("🎲 Mở sòng Tài Xỉu - Nơi đại gia hóa ăn mày"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user?.banned) {
            return interaction.reply({ content: "⛔ Bạn đang bị phong tỏa tài sản, không được phép cờ bạc!", flags: 64 });
        }

        const endsAt = Date.now() + BET_TIME;
        const gameData = { bets: new Map(), endsAt, locked: false };

        await interaction.reply({ embeds: [renderLobby(gameData)], components: [lobbyButtons()] });
        const response = await interaction.fetchReply();
        games.set(response.id, gameData);

        // 🔄 LIVE: cập nhật bảng cược liên tục (đếm ngược thì Discord tự chạy)
        const liveInterval = setInterval(async () => {
            const g = games.get(response.id);
            if (!g || g.locked) return clearInterval(liveInterval);
            await safeEdit(interaction, { embeds: [renderLobby(g)] }, response.id);
        }, LIVE_UPDATE_MS);

        setTimeout(async () => {
          try {
            clearInterval(liveInterval);
            const game = games.get(response.id);
            if (!game) return;
            game.locked = true; // 🔒 Khóa bàn

            // ---------- TÍNH KẾT QUẢ (giữ nguyên lõi 65/35) ----------
            let totalTai = 0, totalXiu = 0;
            for (const bet of game.bets.values()) {
                if (bet.choice === "tai") totalTai += bet.amount;
                else totalXiu += bet.amount;
            }

            let targetResult;
            if (totalTai === 0 && totalXiu === 0) {
                targetResult = Math.random() < 0.5 ? "tai" : "xiu";
            } else {
                const isHouseWin = Math.random() < 0.65;
                if (totalTai > totalXiu) targetResult = isHouseWin ? "xiu" : "tai";
                else if (totalXiu > totalTai) targetResult = isHouseWin ? "tai" : "xiu";
                else targetResult = Math.random() < 0.5 ? "tai" : "xiu";
            }

            let d1, d2, d3, sum;
            do {
                d1 = Math.floor(Math.random() * 6) + 1;
                d2 = Math.floor(Math.random() * 6) + 1;
                d3 = Math.floor(Math.random() * 6) + 1;
                sum = d1 + d2 + d3;
            } while ((targetResult === "tai" && sum < 11) || (targetResult === "xiu" && sum >= 11));

            // ---------- 🎬 ANIMATION LẮC XÚC XẮC ----------
            const shakeFrames = [
                "```\n╭───────────────────╮\n│   🎲  ❓ ❓ ❓  🎲   │\n│    ĐANG LẮC ĐĨA...  │\n╰───────────────────╯```",
                "```\n╭───────────────────╮\n│   💨  🌀 🌀 🌀  💨   │\n│   XÓC! XÓC! XÓC!   │\n╰───────────────────╯```",
                `\`\`\`\n╭───────────────────╮\n│   ✨  ${dice(d1)} ❓ ❓  ✨   │\n│    MỞ BÁT........   │\n╰───────────────────╯\`\`\``,
                `\`\`\`\n╭───────────────────╮\n│   ✨  ${dice(d1)} ${dice(d2)} ❓  ✨   │\n│    HỒI HỘP CHƯA?   │\n╰───────────────────╯\`\`\``,
            ];
            for (const frame of shakeFrames) {
                await safeEdit(interaction, {
                    embeds: [casinoEmbed({ color: COLORS.orange, title: "🎲 NHÀ CÁI ĐANG LẮC ĐĨA...", description: frame })],
                    components: [lobbyButtons(true)],
                }, response.id);
                await sleep(1200);
            }

            // ---------- TRẢ THƯỞNG ----------
            const result = targetResult;
            let winners = [], losers = [];
            let biggestWin = { id: null, amount: 0 };

            for (const [userId, bet] of game.bets.entries()) {
                const uData = await User.findOne({ userId });
                if (!uData) continue;
                let usedBuffs = [];

                if (bet.choice === result) {
                    if (uData.buffs.winRateBoost > 0) {
                        usedBuffs.push(`🍀${uData.buffs.winRateBoost * 100}%`);
                        uData.buffs.winRateBoost = 0;
                    }
                    uData.money += bet.amount * 2;
                    uData.stats.win++;
                    if (bet.amount > biggestWin.amount) biggestWin = { id: userId, amount: bet.amount };
                    winners.push(`> 💸 <@${userId}> **+${money(bet.amount)}**${usedBuffs.length ? " " + usedBuffs.join(" ") : ""}`);
                } else {
                    let lossAmount = bet.amount;
                    if (uData.buffs.shield > 0) {
                        const reducedLoss = bet.amount * (1 - uData.buffs.shield);
                        uData.money += Math.floor(bet.amount - reducedLoss);
                        lossAmount = Math.floor(reducedLoss);
                        usedBuffs.push(`🔰${uData.buffs.shield * 100}%`);
                        uData.buffs.shield = 0;
                    }
                    if (uData.buffs.winRateBoost > 0) {
                        usedBuffs.push(`🍀 mất bùa`);
                        uData.buffs.winRateBoost = 0;
                    }
                    uData.stats.lose++;
                    losers.push(`> 🕳️ <@${userId}> **-${money(lossAmount)}**${usedBuffs.length ? " " + usedBuffs.join(" ") : ""}`);
                }
                uData.stats.gamblePlayed++;
                await uData.save();
                if (bet.choice !== result) JackpotPool.contribute(bet.amount);
                JackpotPool.tryExplode(interaction.client, interaction.channelId, userId);
            }

            // ---------- 🏆 EMBED KẾT QUẢ VIP ----------
            const isTai = result === "tai";
            const resultEmbed = casinoEmbed({
                color: isTai ? COLORS.red : COLORS.cyan,
                title: `${isTai ? "🔥" : "❄️"} KẾT QUẢ: ${isTai ? "T À I" : "X Ỉ U"} ${isTai ? "🔥" : "❄️"}`,
            })
                .setDescription(
                    `# ${dice(d1)} ${dice(d2)} ${dice(d3)}\n` +
                    `## Tổng điểm: **${sum}** → ${isTai ? "🔥 **TÀI**" : "❄️ **XỈU**"}\n` +
                    `${"─".repeat(25)}\n` +
                    `🏆 **NGƯỜI THẮNG (${winners.length})**\n${winners.slice(0, 8).join("\n") || "> 😢 Nhà cái ăn trọn ván này!"}` +
                    (winners.length > 8 ? `\n> *...và ${winners.length - 8} người khác*` : "") +
                    `\n\n💀 **NGƯỜI THUA (${losers.length})**\n${losers.slice(0, 8).join("\n") || "> 😎 Không ai mất xu nào!"}` +
                    (losers.length > 8 ? `\n> *...và ${losers.length - 8} người khác*` : "")
                )
                .setFooter({ text: "🎲 Thắng làm vua, thua đi /work • Gõ /taixiu để mở ván mới" });

            if (biggestWin.id) {
                resultEmbed.addFields({
                    name: "👑 CAO THỦ VÁN NÀY",
                    value: `<@${biggestWin.id}> ẵm trọn **+${money(biggestWin.amount)} VND** 💰`,
                });
            }

            await safeEdit(interaction, { embeds: [resultEmbed], components: [] }, response.id);
          } catch (err) {
            console.error("❌ [taixiu] Lỗi khi xử lý kết quả:", err);
          } finally {
            games.delete(response.id);
          }
        }, BET_TIME);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.locked) return interaction.reply({ content: "❌ Bàn này đã đóng cửa!", flags: 64 });

        if (game.bets.has(interaction.user.id)) {
            const old = game.bets.get(interaction.user.id);
            return interaction.reply({
                content: `❌ Bạn đã cược ${vnd(old.amount)} vào **${old.choice.toUpperCase()}** rồi, không được đổi ý!`,
                flags: 64,
            });
        }

        const choice = interaction.customId === "taixiu_tai" ? "tai" : "xiu";
        const modal = new ModalBuilder()
            .setCustomId(`taixiu_modal_${choice}`)
            .setTitle(`${choice === "tai" ? "🔥 Cược TÀI" : "❄️ Cược XỈU"} — nhập số tiền`);
        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn tất tay (tối thiểu 1.000):")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("VD: 50000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const choice = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount").replace(/[.,\s]/g, ""));
        const game = games.get(interaction.message.id);

        if (!game || game.locked || Date.now() >= game.endsAt) {
            return interaction.reply({ content: "❌ Bàn đã kết thúc trong lúc bạn đang nhập tiền! Tiền của bạn KHÔNG bị trừ.", flags: 64 });
        }
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tiền cược tối thiểu là 1.000 VND!", flags: 64 });

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return interaction.reply({ content: "❌ Bạn chưa có tài khoản! Hãy dùng /daily hoặc /work để khởi tạo.", flags: 64 });
        if (user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user.money)}, đừng có "tay không bắt giặc"!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

        user.money -= amount;
        await user.save();
        game.bets.set(interaction.user.id, { choice, amount });

        await interaction.reply({
            content: `✅ Đã ghi nhận ${vnd(amount)} vào cửa **${choice === "tai" ? "🔥 TÀI" : "❄️ XỈU"}**!\n💼 Ví còn lại: ${vnd(user.money)} • Chốt kèo ${countdown(game.endsAt)}`,
            flags: 64,
        });
    },
};