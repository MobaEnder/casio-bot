const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed, countdown } = require("../utils/ui");

const SIZE = 4;
const MINES = 3;
const PLAY_TIME = 60000;

// --- KHỞI TẠO BÀN CỜ (giữ nguyên logic) ---
function createBoard(size, mineCount) {
    const board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({ isMine: false, count: 0, isOpen: false }))
    );
    let planted = 0;
    while (planted < mineCount) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        if (!board[r][c].isMine) { board[r][c].isMine = true; planted++; }
    }
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (board[r + i]?.[c + j]?.isMine) count++;
            board[r][c].count = count;
        }
    }
    return board;
}

// --- GIAO DIỆN NÚT (revealAll: hé lộ mìn khi kết thúc) ---
function createComponents(board, revealAll = false, boomAt = null) {
    const rows = [];
    for (let r = 0; r < board.length; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < board[r].length; c++) {
            const cell = board[r][c];
            const btn = new ButtonBuilder().setCustomId(`boom_${r}_${c}`);

            if (revealAll) {
                btn.setDisabled(true);
                if (cell.isMine) {
                    btn.setEmoji(boomAt && boomAt[0] === r && boomAt[1] === c ? "💥" : "💣")
                       .setStyle(boomAt && boomAt[0] === r && boomAt[1] === c ? ButtonStyle.Danger : ButtonStyle.Secondary)
                       .setLabel("\u200b");
                } else if (cell.isOpen) {
                    btn.setLabel(cell.count > 0 ? cell.count.toString() : "✓").setStyle(ButtonStyle.Success);
                } else {
                    btn.setLabel(cell.count > 0 ? cell.count.toString() : "\u200b").setStyle(ButtonStyle.Secondary);
                }
            } else if (!cell.isOpen) {
                btn.setLabel("\u200b").setStyle(ButtonStyle.Secondary);
            } else {
                btn.setLabel(cell.count > 0 ? cell.count.toString() : "✓")
                   .setStyle(ButtonStyle.Primary)
                   .setDisabled(true);
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }
    return rows;
}

function reveal(board, r, c) {
    if (!board[r] || !board[r][c] || board[r][c].isOpen) return;
    board[r][c].isOpen = true;
    if (board[r][c].count === 0 && !board[r][c].isMine) {
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) reveal(board, r + i, c + j);
    }
}

function gameEmbed(bet, board, endsAt) {
    const totalSafe = SIZE * SIZE - MINES;
    const opened = board.flat().filter((c) => c.isOpen).length;
    return casinoEmbed({ color: COLORS.dark, title: "💣 DÒ MÌN — TỐC CHIẾN TỐC THẮNG 💣" })
        .setDescription(
            `> 💵 Cược: ${vnd(bet)} → Phá đảo nhận **${money(bet * 5)} VND** (x5)!\n` +
            `> ⏳ Hết giờ ${countdown(endsAt)}\n\n` +
            `🧹 **Tiến độ:** ${opened}/${totalSafe} ô an toàn\n${bar(opened / totalSafe, 12, "🟩", "⬛")}\n\n` +
            `💣 Còn **${MINES}** quả mìn ẩn nấp đâu đó...`
        )
        .setFooter({ text: "💡 Ô số = số mìn xung quanh • Mở hết ô sạch để thắng!" });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("doboom")
        .setDescription("💣 Dò mìn - Mở hết ô sạch để thắng")
        .addIntegerOption((opt) => opt.setName("tiencuoc").setDescription("Số tiền cược").setRequired(true).setMinValue(1000)),

    async execute(interaction) {
        try {
            const bet = interaction.options.getInteger("tiencuoc");
            const user = await User.findOne({ userId: interaction.user.id });

            if (!user || user.money < bet) {
                return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
            }
            if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm cược!", flags: 64 });

            user.money -= bet;
            await user.save();

            let board = createBoard(SIZE, MINES);
            const endsAt = Date.now() + PLAY_TIME;
            let boomAt = null;

            await interaction.reply({ embeds: [gameEmbed(bet, board, endsAt)], components: createComponents(board) });
            const message = await interaction.fetchReply();

            const collector = interaction.channel.createMessageComponentCollector({
                filter: (i) => i.message.id === message.id && i.user.id === interaction.user.id,
                componentType: ComponentType.Button,
                time: PLAY_TIME,
            });

            collector.on("collect", async (i) => {
                await i.deferUpdate();
                const [, r, c] = i.customId.split("_").map(Number);
                const cell = board[r][c];

                if (cell.isMine) {
                    boomAt = [r, c];
                    return collector.stop("mine");
                }

                reveal(board, r, c);

                const unopened = board.flat().filter((cl) => !cl.isOpen).length;
                if (unopened === MINES) return collector.stop("win");

                await interaction.editReply({ embeds: [gameEmbed(bet, board, endsAt)], components: createComponents(board) });
            });

            collector.on("end", async (_, reason) => {
                try {
                    if (reason === "win") {
                        const prize = bet * 5;
                        const winner = await User.findOne({ userId: interaction.user.id });
                        winner.money += prize;
                        if (winner.stats) { winner.stats.win++; winner.stats.gamblePlayed++; }
                        await winner.save();

                        await interaction.editReply({
                            embeds: [casinoEmbed({ color: COLORS.green, title: "🏆 RÀ PHÁ BOM MÌN THÀNH CÔNG! 🏆" })
                                .setDescription(
                                    `# 🎉 PHÁ ĐẢO!\n> <@${interaction.user.id}> đã mở sạch **${SIZE * SIZE - MINES}** ô an toàn!\n\n` +
                                    `💰 Nhận thưởng: **+${money(prize)} VND** (x5)\n💼 Ví hiện tại: ${vnd(winner.money)}`
                                )
                                .setFooter({ text: "💣 Gõ /doboom để thử bàn khó tiếp!" })],
                            components: createComponents(board, true),
                        });
                    } else if (reason === "mine") {
                        await interaction.editReply({
                            embeds: [casinoEmbed({ color: COLORS.red, title: "💥 BÙMMM!!! ĐẠP TRÚNG MÌN!" })
                                .setDescription(
                                    `# ☠️ TOANG!\n> <@${interaction.user.id}> đã đạp trúng quả mìn định mệnh...\n\n` +
                                    `🕳️ Mất trắng: **-${money(bet)} VND**\n💣 Vị trí mìn đã được hé lộ bên dưới!`
                                )
                                .setFooter({ text: "💣 Gõ /doboom để phục thù!" })],
                            components: createComponents(board, true, boomAt),
                        });
                        const loser = await User.findOne({ userId: interaction.user.id });
                        if (loser?.stats) { loser.stats.lose++; loser.stats.gamblePlayed++; await loser.save(); }
                    } else {
                        // Hết giờ
                        await interaction.editReply({
                            embeds: [casinoEmbed({ color: COLORS.orange, title: "⏰ HẾT GIỜ RÀ MÌN!" })
                                .setDescription(`> <@${interaction.user.id}> chần chừ quá lâu... Mất **-${money(bet)} VND** tiền cược!`)],
                            components: createComponents(board, true),
                        });
                    }

                    // Dọn bàn sau 20 giây để không trôi kênh
                    setTimeout(() => interaction.deleteReply().catch(() => {}), 20000);
                } catch (e) {
                    console.error("❌ [doboom] Lỗi kết thúc game:", e);
                }
            });
        } catch (error) {
            console.error("LỖI DÒ MÌN:", error);
        }
    },
};