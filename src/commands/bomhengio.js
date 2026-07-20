const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, bar, casinoEmbed } = require("../utils/ui");

const PASS_FLAVOR = [
    "ném quả bom đi như ném củ khoai nóng! 🥔",
    "chuyền bom bằng một tay, tay kia đếm tiền! 😎",
    "run cầm cập nhưng vẫn kịp đẩy bom đi! 😱",
    "hét lên 'KHÔNG PHẢI HÔM NAY!' rồi ném bom! 🗣️",
    "vừa chuyền vừa cầu nguyện tổ tiên phù hộ! 🙏",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bomhengio")
        .setDescription("💣 Chuyền bom - Nhà cái rót tiền (Chốt hạ từ lượt thứ 4)")
        .addIntegerOption((opt) =>
            opt.setName("tiencuoc").setDescription("Số tiền mỗi người đóng góp").setRequired(true).setMinValue(1000)
        ),

    async execute(interaction) {
        try {
            const initialBet = interaction.options.getInteger("tiencuoc");
            const creator = interaction.user;

            const userCreator = await User.findOne({ userId: creator.id });
            if (!userCreator || userCreator.money < initialBet) {
                return interaction.reply({ content: `❌ Cần ${vnd(initialBet)} để khởi tạo hũ bom! Ví bạn còn ${vnd(userCreator?.money || 0)}.`, flags: 64 });
            }

            let players = [creator];
            let pot = initialBet;
            const lobbyEndsAt = Date.now() + 45000;

            const renderLobby = () =>
                casinoEmbed({ color: COLORS.orange, title: "💣 ✦ PHÒNG CHỜ: BOM HẸN GIỜ ✦ 💣" })
                    .setDescription(
                        `\`\`\`\n     💣\n    ╱🔥╲   tick... tock...\n\`\`\`` +
                        `> 👑 Chủ bom: <@${creator.id}>\n` +
                        `> 💵 Vé vào cửa: \`${money(initialBet)} VND\`/người\n` +
                        `> 💰 Hũ hiện tại: **\`${money(pot)} VND\`** *(nhà cái rót thêm 10% mỗi lượt chuyền!)*\n` +
                        `> ⏳ Phòng đóng ${countdown(lobbyEndsAt)}\n${"─".repeat(25)}\n` +
                        `👥 **Đội cảm tử (${players.length}):** ${players.map((p) => `<@${p.id}>`).join(", ")}\n\n` +
                        `⚠️ **Luật:** bom nổ trên tay ai người đó mất trắng • Chỉ được ÔM TIỀN từ lượt chuyền thứ 4 (50/50 nổ tức thì)!`
                    )
                    .setFooter({ text: "💣 Cần tối thiểu 2 người • Chủ bom bấm Bắt đầu khi đủ đội" });

            const lobbyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("join_bomb").setLabel("Tham gia").setEmoji("🧨").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("start_bomb").setLabel("Bắt đầu").setEmoji("🔥").setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [renderLobby()], components: [lobbyRow] });
            const msg = await interaction.fetchReply();

            const lobbyCollector = msg.createMessageComponentCollector({ time: 45000 });

            lobbyCollector.on("collect", async (i) => {
                if (i.customId === "join_bomb") {
                    if (players.some((p) => p.id === i.user.id)) return i.reply({ content: "❌ Bạn đã trong đội cảm tử rồi!", flags: 64 });
                    const pDB = await User.findOne({ userId: i.user.id });
                    if (!pDB || pDB.money < initialBet) return i.reply({ content: `❌ Cần ${vnd(initialBet)} để vào phòng!`, flags: 64 });
                    if (pDB.banned) return i.reply({ content: "🚫 Bạn bị cấm chơi!", flags: 64 });

                    players.push(i.user);
                    pot += initialBet;
                    await i.deferUpdate();
                    await interaction.editReply({ embeds: [renderLobby()] });
                }

                if (i.customId === "start_bomb") {
                    if (i.user.id !== creator.id) return i.reply({ content: "❌ Chỉ chủ bom mới có thể châm ngòi!", flags: 64 });
                    if (players.length < 2) return i.reply({ content: "❌ Cần ít nhất 2 người mới vui!", flags: 64 });
                    await i.deferUpdate();
                    lobbyCollector.stop("started");
                }
            });

            lobbyCollector.on("end", async (_, reason) => {
                if (reason === "started") {
                    for (const p of players) {
                        await User.findOneAndUpdate({ userId: p.id }, { $inc: { money: -initialBet } });
                    }
                    await startBombGame(interaction, players, pot, initialBet);
                } else {
                    await interaction.editReply({
                        embeds: [casinoEmbed({ color: COLORS.dark, title: "⏰ PHÒNG ĐÃ HỦY", description: "> Không đủ người dám chơi với tử thần... 💣💤" })],
                        components: [],
                    }).catch(() => {});
                }
            });
        } catch (error) {
            console.error("LỖI BOM:", error);
        }
    },
};

async function startBombGame(interaction, players, currentPot, baseBet) {
    let currentIndex = 0;
    let passCount = 0;
    let pot = currentPot;
    const bonusPerPass = Math.floor(baseBet * 0.1);

    const updateGame = async (status) => {
        // Công thức tỉ lệ nổ GIỮ NGUYÊN: 1 - 0.92^passCount
        const explodeChance = Math.floor((1 - Math.pow(0.92, passCount)) * 100);

        const gameRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pass_bomb").setLabel("CHUYỀN TIẾP").setEmoji("💨").setStyle(ButtonStyle.Primary)
        );
        if (passCount >= 3) {
            gameRow.addComponents(
                new ButtonBuilder().setCustomId("hold_bomb").setLabel(`ÔM ${money(pot)} & CHẠY (50/50)`).setEmoji("🎁").setStyle(ButtonStyle.Danger)
            );
        }

        const fuseIcon = explodeChance > 60 ? "🟥" : explodeChance > 30 ? "🟧" : "🟩";
        const embed = casinoEmbed({
            color: passCount < 3 ? COLORS.blue : explodeChance > 60 ? COLORS.red : COLORS.gold,
            title: "💣 BOM ĐANG NÓNG — TIỀN ĐANG PHỒNG! 💣",
        })
            .setDescription(
                `\`\`\`\n      💣💥\n     ╱🔥🔥╲   HOLDER: ${players[currentIndex].username}\n\`\`\`` +
                `> 📍 Đang cầm bom: <@${players[currentIndex].id}>\n` +
                `> 🔄 Lượt chuyền: **${passCount}** • 👥 ${players.length} người chơi\n${"─".repeat(25)}\n` +
                `💰 **HŨ TIỀN: \`${money(pot)} VND\`** *(+${money(bonusPerPass)}/lượt)*\n\n` +
                `🧨 **Dây cháy (tỉ lệ nổ ${explodeChance}%):**\n${bar(explodeChance / 100, 12, fuseIcon, "⬛")}\n\n${status}`
            )
            .setFooter({
                text: passCount < 3
                    ? `🔒 Cần thêm ${3 - passCount} lượt chuyền nữa để mở khóa Ôm Tiền`
                    : "🎁 Ôm Tiền đã mở — nhưng 50% bom nổ ngay trên tay đấy! 😈",
            });

        await interaction.editReply({ content: `🔔 Lượt của <@${players[currentIndex].id}>`, embeds: [embed], components: [gameRow] });
    };

    await updateGame("🏁 **Trò chơi bắt đầu!** Chuyền bom nhanh nhất có thể — chần chừ là toang!");

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 180000,
    });

    collector.on("collect", async (i) => {
        if (i.user.id !== players[currentIndex].id) return i.reply({ content: "❌ Bạn không cầm bom! Đứng ngoài hóng thôi.", flags: 64 });
        await i.deferUpdate();

        if (i.customId === "pass_bomb") {
            const chance = 1 - Math.pow(0.92, passCount);
            if (Math.random() < chance) {
                return collector.stop("exploded");
            }
            passCount++;
            pot += bonusPerPass;
            const passer = players[currentIndex].username;
            currentIndex = (currentIndex + 1) % players.length;
            await updateGame(`> ✅ **${passer}** ${PASS_FLAVOR[Math.floor(Math.random() * PASS_FLAVOR.length)]}\n> 💰 Nhà cái rót thêm **+${money(bonusPerPass)}** vào hũ!`);
        } else if (i.customId === "hold_bomb") {
            if (passCount < 3) return; // Chống hack button (giữ nguyên)
            if (Math.random() < 0.5) {
                return collector.stop("exploded_on_hold");
            }
            return collector.stop("took_the_money");
        }
    });

    collector.on("end", async (_, reason) => {
      try {
        const holder = players[currentIndex];
        let embed;

        if (reason === "exploded") {
            embed = casinoEmbed({ color: COLORS.red, title: "💥 BÙMMMM!!! BOM NỔ GIỮA ĐƯỜNG CHUYỀN!" })
                .setDescription(
                    `\`\`\`\n    💥💥💥\n   ☠️ (${holder.username} bay màu)\n\`\`\`` +
                    `> 💀 <@${holder.id}> ôm trọn vụ nổ ở lượt thứ **${passCount + 1}**!\n` +
                    `> 🕳️ Hũ **${money(pot)} VND** tan thành mây khói cùng vé của cả đội...`
                )
                .setFooter({ text: "💣 Gõ /bomhengio để chơi ván mới!" });
        } else if (reason === "exploded_on_hold") {
            embed = casinoEmbed({ color: COLORS.red, title: "💥 THAM THÌ THÂM — NỔ NGAY TRÊN TAY!" })
                .setDescription(
                    `\`\`\`\n    🎁💥\n   ☠️ (ôm hụt)\n\`\`\`` +
                    `> 😈 <@${holder.id}> định ôm **${money(pot)} VND** chạy... nhưng thần may mắn quay lưng!\n` +
                    `> 🕳️ 50/50 và bạn chọn nhầm cửa tử. Hũ bay màu!`
                )
                .setFooter({ text: "💣 Đen thôi đỏ quên đi • /bomhengio làm ván nữa!" });
        } else if (reason === "took_the_money") {
            await User.findOneAndUpdate({ userId: holder.id }, { $inc: { money: pot } });
            embed = casinoEmbed({ color: COLORS.gold, title: "🏆 ÔM TRỌN HŨ BOM — QUÁ ĐỈNH!" })
                .setDescription(
                    `\`\`\`\n    🎁💰\n   😎🏃💨 (chuồn êm)\n\`\`\`` +
                    `> 👑 <@${holder.id}> gan lì vượt qua cửa tử 50/50!\n` +
                    `> 💰 Ẵm trọn hũ: **\`+${money(pot)} VND\`**\n` +
                    `> 😭 ${players.length - 1} người còn lại chia nhau... không khí!`
                )
                .setFooter({ text: "💣 Thắng làm vua • /bomhengio mở ván mới!" });
        } else {
            embed = casinoEmbed({ color: COLORS.dark, title: "⏰ HẾT GIỜ — BOM TỰ HỦY!" })
                .setDescription(`> 💤 <@${holder.id}> cầm bom mà ngủ gật...\n> 🕳️ Hũ **${money(pot)} VND** tan thành mây khói.`);
        }

        await interaction.editReply({ content: null, embeds: [embed], components: [] });
      } catch (e) {
        console.error("❌ [bomhengio] Lỗi kết thúc:", e);
      }
    });
}