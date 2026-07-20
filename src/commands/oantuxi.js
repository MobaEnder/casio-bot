const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const challenges = new Map();

const MOVES = {
    r: { emoji: "✊", name: "ĐẤM" },
    s: { emoji: "✌️", name: "KÉO" },
    p: { emoji: "✋", name: "LÁ" },
};

function pvpButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("oantuxi_playpvp_r_0").setLabel("ĐẤM").setEmoji("✊").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("oantuxi_playpvp_s_0").setLabel("KÉO").setEmoji("✌️").setStyle(ButtonStyle.Danger).setDisabled(disabled),
        new ButtonBuilder().setCustomId("oantuxi_playpvp_p_0").setLabel("LÁ").setEmoji("✋").setStyle(ButtonStyle.Success).setDisabled(disabled)
    );
}

// Bảng trạng thái trận PvP
function renderPvP(game, hostId) {
    const p1Status = game.p1.choice ? "✅ **Đã ra đòn** (bí mật)" : "🤔 *Đang suy nghĩ...*";
    const p2Status = !game.p2.id
        ? "📢 *Đang chờ cao thủ nhận kèo...*"
        : game.p2.choice ? "✅ **Đã ra đòn** (bí mật)" : "🤔 *Đang suy nghĩ...*";

    return casinoEmbed({ color: COLORS.orange, title: "⚔️ ĐẤU TRƯỜNG OẲN TÙ XÌ ⚔️" })
        .setDescription(
            `> 💰 Tiền cược: ${vnd(game.amount)} — kẻ thắng lấy hết!\n` +
            `${"─".repeat(25)}\n` +
            `🥊 **Đấu sĩ 1:** <@${game.p1.id}>\n${p1Status}\n\n` +
            `🥊 **Đấu sĩ 2:** ${game.p2.id ? `<@${game.p2.id}>` : "**AI CŨNG ĐƯỢC!**"}\n${p2Status}`
        )
        .setFooter({ text: "💡 Chọn đòn bên dưới — đối thủ KHÔNG thấy lựa chọn của bạn!" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("oantuxi")
        .setDescription("✊✌️✋ Oẳn tù xì - Chơi với Bot hoặc Bạn bè")
        .addIntegerOption((opt) =>
            opt.setName("tien").setDescription("Số tiền muốn cược").setRequired(true).setMinValue(1000)
        )
        .addUserOption((opt) =>
            opt.setName("doi_thu").setDescription("Tag người muốn thách đấu (Để trống nếu muốn đấu với Bot hoặc mở kèo tự do)")
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger("tien");
        const target = interaction.options.getUser("doi_thu");
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user || user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn đang bị cấm tham gia cá cược!", flags: 64 });

        if (target) {
            if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Bạn không thể tự đấu với chính mình!", flags: 64 });
            if (target.bot) return interaction.reply({ content: "❌ Muốn đấu Bot thì để trống mục đối thủ nhé!", flags: 64 });
            return setupPvP(interaction, amount, target.id);
        }

        const embed = casinoEmbed({ color: COLORS.blue, title: "✊✌️✋ CHỌN CHẾ ĐỘ THI ĐẤU" })
            .setDescription(`> 💰 Kèo: ${vnd(amount)}\n\nBạn muốn so găng với ai?`)
            .addFields(
                { name: "🤖 Đấu với Nhà Cái", value: "Kết quả ngay lập tức\n*(cẩn thận, nhà cái gian lắm 😏)*", inline: true },
                { name: "🤝 Kèo mở PvP", value: "Đấu 1vs1 công bằng\nAi cũng có thể nhận kèo!", inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`oantuxi_choice_bot_${amount}`).setLabel("Chơi với Bot").setEmoji("🤖").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`oantuxi_choice_user_${amount}`).setLabel("Mở kèo PvP").setEmoji("🤝").setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const [, action, detail, amtStr] = interaction.customId.split("_");
        const amount = parseInt(amtStr || detail);

        // --- CHỌN CHẾ ĐỘ ---
        if (action === "choice") {
            if (detail === "bot") {
                const embed = casinoEmbed({ color: COLORS.purple, title: "🤖 SO GĂNG VỚI NHÀ CÁI" })
                    .setDescription(`> 💰 Cược: ${vnd(amount)}\n\n**Ra đòn nào! Oẳn... tù... xì!** 👊`);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_r_${amount}`).setLabel("ĐẤM").setEmoji("✊").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_s_${amount}`).setLabel("KÉO").setEmoji("✌️").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`oantuxi_playbot_p_${amount}`).setLabel("LÁ").setEmoji("✋").setStyle(ButtonStyle.Success)
                );
                return interaction.update({ embeds: [embed], components: [row] });
            }
            if (detail === "user") {
                return setupPvP(interaction, amount, null, true);
            }
        }

        // --- ĐẤU VỚI BOT ---
        if (action === "playbot") {
            const uData = await User.findOne({ userId: interaction.user.id });
            if (!uData || uData.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(uData?.money || 0)}!`, flags: 64 });

            const userChoice = detail;
            let botChoice;
            // Giữ nguyên lõi: 65% Bot thắng
            if (Math.random() < 0.65) {
                botChoice = userChoice === "r" ? "p" : userChoice === "s" ? "r" : "s";
            } else {
                botChoice = userChoice === "r" ? "s" : userChoice === "s" ? "p" : "r";
            }

            // 🎬 Hiệu ứng đếm: Oẳn... tù... xì!
            const countdownFrames = ["# ✊ OẲN...", "# ✊✊ TÙ...", "# ✊✊✊ XÌ!!!"];
            await interaction.update({
                embeds: [casinoEmbed({ color: COLORS.purple, title: "🤖 SO GĂNG VỚI NHÀ CÁI", description: countdownFrames[0] })],
                components: [],
            });
            for (let i = 1; i < countdownFrames.length; i++) {
                await sleep(800);
                await safeEdit(interaction, {
                    embeds: [casinoEmbed({ color: COLORS.purple, title: "🤖 SO GĂNG VỚI NHÀ CÁI", description: countdownFrames[i] })],
                }, interaction.message.id);
            }
            await sleep(800);

            let result, color, moneyLine;
            if (botChoice === userChoice) {
                result = "🤝 HÒA — KHÔNG AI MẤT TIỀN!";
                color = COLORS.gold;
                moneyLine = `💼 Ví giữ nguyên: ${vnd(uData.money)}`;
            } else if ((userChoice === "r" && botChoice === "s") || (userChoice === "s" && botChoice === "p") || (userChoice === "p" && botChoice === "r")) {
                uData.money += amount;
                if (uData.stats) { uData.stats.win++; uData.stats.gamblePlayed++; }
                result = "🏆 BẠN THẮNG — NHÀ CÁI KHÓC RÒNG!";
                color = COLORS.green;
                moneyLine = `💸 **+${money(amount)} VND** → Ví: ${vnd(uData.money)}`;
            } else {
                uData.money -= amount;
                if (uData.stats) { uData.stats.lose++; uData.stats.gamblePlayed++; }
                result = "💀 BẠN THUA — NHÀ CÁI CƯỜI KHẨY!";
                color = COLORS.red;
                moneyLine = `🕳️ **-${money(amount)} VND** → Ví: ${vnd(uData.money)}`;
            }
            await uData.save();

            return safeEdit(interaction, {
                embeds: [casinoEmbed({ color, title: result })
                    .setDescription(
                        `# ${MOVES[userChoice].emoji} 🆚 ${MOVES[botChoice].emoji}\n` +
                        `> 🙋 Bạn ra: **${MOVES[userChoice].emoji} ${MOVES[userChoice].name}**\n` +
                        `> 🤖 Bot ra: **${MOVES[botChoice].emoji} ${MOVES[botChoice].name}**\n\n${moneyLine}`
                    )
                    .setFooter({ text: "✊✌️✋ Gõ /oantuxi để phục thù!" })],
                components: [],
            }, interaction.message.id);
        }

        // --- PVP ---
        if (action === "playpvp") {
            const game = challenges.get(interaction.message.id);
            if (!game) return interaction.reply({ content: "❌ Trận đấu đã kết thúc!", flags: 64 });

            if (!game.p2.id && interaction.user.id !== game.p1.id) {
                const p2Data = await User.findOne({ userId: interaction.user.id });
                if (!p2Data || p2Data.money < game.amount) return interaction.reply({ content: `❌ Cần ${vnd(game.amount)} để nhận kèo này!`, flags: 64 });
                if (p2Data.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });
                game.p2.id = interaction.user.id;
            }

            const isP1 = interaction.user.id === game.p1.id;
            const isP2 = interaction.user.id === game.p2.id;
            if (!isP1 && !isP2) return interaction.reply({ content: "❌ Kèo này đã có chủ, hãy đợi kèo khác!", flags: 64 });

            const p = isP1 ? game.p1 : game.p2;
            if (p.choice) return interaction.reply({ content: "❌ Bạn đã ra đòn rồi, không được đổi!", flags: 64 });

            p.choice = detail;
            await interaction.reply({ content: `🤫 Bạn đã bí mật chọn **${MOVES[detail].emoji} ${MOVES[detail].name}**!`, flags: 64 });

            // Cập nhật bảng trạng thái trận đấu
            if (!(game.p1.choice && game.p2.choice)) {
                await interaction.message.edit({ embeds: [renderPvP(game)], components: [pvpButtons()] }).catch(() => {});
                return;
            }

            // --- CẢ 2 ĐÃ RA ĐÒN → CÔNG BỐ ---
            const c1 = game.p1.choice, c2 = game.p2.choice;
            let winnerId = c1 === c2 ? "draw"
                : ((c1 === "r" && c2 === "s") || (c1 === "s" && c2 === "p") || (c1 === "p" && c2 === "r")) ? game.p1.id : game.p2.id;

            if (winnerId !== "draw") {
                const w = await User.findOne({ userId: winnerId });
                const l = await User.findOne({ userId: winnerId === game.p1.id ? game.p2.id : game.p1.id });
                if (w && l) {
                    w.money += game.amount;
                    l.money -= game.amount;
                    if (w.stats) { w.stats.win++; w.stats.gamblePlayed++; }
                    if (l.stats) { l.stats.lose++; l.stats.gamblePlayed++; }
                    await w.save();
                    await l.save();
                }
            }

            const isDraw = winnerId === "draw";
            await interaction.message.edit({
                embeds: [casinoEmbed({
                    color: isDraw ? COLORS.gold : COLORS.cyan,
                    title: isDraw ? "🤝 BẤT PHÂN THẮNG BẠI!" : "🏁 TRẬN ĐẤU KẾT THÚC!",
                })
                    .setDescription(
                        `# ${MOVES[c1].emoji} 🆚 ${MOVES[c2].emoji}\n` +
                        `> 🥊 <@${game.p1.id}> ra **${MOVES[c1].emoji} ${MOVES[c1].name}**\n` +
                        `> 🥊 <@${game.p2.id}> ra **${MOVES[c2].emoji} ${MOVES[c2].name}**\n` +
                        `${"─".repeat(25)}\n` +
                        (isDraw
                            ? "⚖️ **HÒA!** Cả hai giữ nguyên tiền cược."
                            : `👑 <@${winnerId}> **THẮNG TUYỆT ĐỐI** và ẵm trọn **+${money(game.amount)} VND**! 💰`)
                    )
                    .setFooter({ text: "⚔️ Gõ /oantuxi để mở kèo mới!" })],
                components: [],
            }).catch(() => {});
            challenges.delete(interaction.message.id);
        }
    },
};

// Thiết lập trận PvP
async function setupPvP(interaction, amount, targetId, isUpdate = false) {
    const gameData = {
        p1: { id: interaction.user.id, choice: null },
        p2: { id: targetId, choice: null },
        amount,
    };

    const msgData = {
        content: targetId ? `🔔 <@${targetId}> — có người thách đấu bạn!` : "📢 **KÈO MỞ!** Ai dám nhận lời so găng?",
        embeds: [renderPvP(gameData)],
        components: [pvpButtons()],
    };

    isUpdate ? await interaction.update(msgData) : await interaction.reply(msgData);
    const msg = await interaction.fetchReply();
    challenges.set(msg.id, gameData);
}