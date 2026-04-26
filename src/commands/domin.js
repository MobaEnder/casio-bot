const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");
const User = require("../models/User"); // QUAN TRỌNG: Kiểm tra kỹ đường dẫn này

// --- LOGIC KHỞI TẠO BÀN CỜ ---
function createBoard(size, mineCount) {
    const board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({
            isMine: false,
            count: 0,
            isOpen: false,
            isFlagged: false
        }))
    );

    let plantedMines = 0;
    while (plantedMines < mineCount) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        if (!board[r][c].isMine) {
            board[r][c].isMine = true;
            plantedMines++;
        }
    }

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (board[r + i]?.[c + j]?.isMine) count++;
                }
            }
            board[r][c].count = count;
        }
    }
    return board;
}

// --- GIAO DIỆN NÚT (Fix giới hạn 5 hàng) ---
function createComponents(board, isGameOver = false, isWin = false, flagMode = false) {
    const rows = [];
    // Bàn cờ 4x4 = 4 hàng
    for (let r = 0; r < board.length; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < board[r].length; c++) {
            const cell = board[r][c];
            const btn = new ButtonBuilder().setCustomId(`boom_${r}_${c}`);

            if (!cell.isOpen) {
                btn.setLabel(cell.isFlagged ? "🚩" : "\u200b")
                   .setStyle(cell.isFlagged ? ButtonStyle.Warning : ButtonStyle.Secondary);
                if (isGameOver || isWin) btn.setDisabled(true);
                if (isGameOver && cell.isMine) btn.setLabel("💥").setStyle(ButtonStyle.Danger);
            } else {
                btn.setLabel(cell.isMine ? "💥" : (cell.count > 0 ? cell.count.toString() : "\u200b"))
                   .setStyle(cell.isMine ? ButtonStyle.Danger : ButtonStyle.Primary)
                   .setDisabled(true);
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }

    // Hàng thứ 5: Nút chuyển chế độ
    const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("boom_toggle_flag")
            .setLabel(flagMode ? "CHẾ ĐỘ: CẮM CỜ 🚩" : "CHẾ ĐỘ: MỞ Ô ⛏️")
            .setStyle(flagMode ? ButtonStyle.Warning : ButtonStyle.Success)
            .setDisabled(isGameOver || isWin)
    );
    rows.push(controlRow);
    return rows;
}

function reveal(board, r, c) {
    if (!board[r] || !board[r][c] || board[r][c].isOpen || board[r][c].isFlagged) return;
    board[r][c].isOpen = true;
    if (board[r][c].count === 0 && !board[r][c].isMine) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) reveal(board, r + i, c + j);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("doboom")
        .setDescription("💣 Dò mìn - Thắng x5 tiền cược")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền đặt cược")
               .setRequired(true)
               .setMinValue(1000)
        ),

    async execute(interaction) {
        try {
            const bet = interaction.options.getInteger("tiencuoc");
            let user = await User.findOne({ userId: interaction.user.id });

            // Kiểm tra user, nếu không có thì tạo mới (tùy logic bot của bạn)
            if (!user) {
                return interaction.reply({ content: "❌ Bạn chưa có tài khoản trong hệ thống!", flags: 64 });
            }

            if (user.money < bet) {
                return interaction.reply({ 
                    content: `❌ Không đủ tiền! Ví: \`${user.money.toLocaleString()}\` VND`, 
                    flags: 64 
                });
            }

            user.money -= bet;
            await user.save();

            // SỬA TẠI ĐÂY: Dùng bàn cờ 4x4 (Size 4) để không bị quá 5 hàng nút
            let board = createBoard(4, 3); 
            let flagMode = false;
            let gameOver = false;
            let win = false;

            const embed = new EmbedBuilder()
                .setTitle("💣 DÒ MÌN - KHỞI NGHIỆP")
                .setDescription(`💰 Cược: **${bet.toLocaleString()}** | Thắng: **${(bet * 5).toLocaleString()}**\nTrạng thái: Đang dò...`)
                .setColor(0x2f3136);

            const response = await interaction.reply({
                embeds: [embed],
                components: createComponents(board, false, false, flagMode),
                withResponse: true
            });

            const collector = (response.resource || response).createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on("collect", async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "Không phải máy của bạn!", flags: 64 });

                if (i.customId === "boom_toggle_flag") {
                    flagMode = !flagMode;
                    return i.update({ components: createComponents(board, false, false, flagMode) });
                }

                const [, r, c] = i.customId.split("_").map(Number);
                const cell = board[r][c];

                if (flagMode) {
                    if (!cell.isOpen) cell.isFlagged = !cell.isFlagged;
                } else {
                    if (cell.isFlagged) return i.reply({ content: "Gỡ cờ trước!", flags: 64 });
                    if (cell.isMine) {
                        gameOver = true;
                        return collector.stop("mine");
                    }
                    reveal(board, r, c);
                    if (board.flat().filter(cell => !cell.isMine && !cell.isOpen).length === 0) {
                        win = true;
                        return collector.stop("win");
                    }
                }
                await i.update({ components: createComponents(board, false, false, flagMode) });
            });

            collector.on("end", async (_, reason) => {
                let finalDesc = "";
                if (reason === "mine") {
                    finalDesc = `💥 **THUA RỒI!** Bạn mất \`${bet.toLocaleString()}\` VND.`;
                    embed.setColor(0xff0000);
                } else if (reason === "win") {
                    const prize = bet * 5;
                    const winner = await User.findOne({ userId: interaction.user.id });
                    winner.money += prize;
                    await winner.save();
                    finalDesc = `🏆 **THẮNG LỚN!** Bạn nhận được \`${prize.toLocaleString()}\` VND!`;
                    embed.setColor(0x00ff00);
                } else {
                    finalDesc = "⏰ Trận đấu kết thúc do quá lâu không tương tác.";
                }

                embed.setDescription(`💰 Cược: **${bet.toLocaleString()}**\n\n${finalDesc}`);
                await interaction.editReply({
                    embeds: [embed],
                    components: createComponents(board, gameOver, win, flagMode)
                }).catch(() => {});
            });

        } catch (error) {
            console.error("LỖI DÒ MÌN:", error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: "Có lỗi xảy ra khi xử lý game!", flags: 64 });
            } else {
                await interaction.reply({ content: "Có lỗi xảy ra khi thực hiện lệnh!", flags: 64 });
            }
        }
    }
};