const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const User = require("../models/User"); // Đảm bảo đường dẫn tới model User chính xác

// --- LOGIC KHỞI TẠO BÀN CỜ (Giữ nguyên) ---
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

function createComponents(board, isGameOver = false, isWin = false, flagMode = false) {
    const rows = [];
    for (let r = 0; r < board.length; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < board[r].length; c++) {
            const cell = board[r][c];
            const btn = new ButtonBuilder().setCustomId(`boom_${r}_${c}`);
            if (!cell.isOpen) {
                btn.setLabel(cell.isFlagged ? "🚩" : " ").setStyle(cell.isFlagged ? ButtonStyle.Warning : ButtonStyle.Secondary);
                if (isGameOver || isWin) btn.setDisabled(true);
                if (isGameOver && cell.isMine) btn.setLabel("💥").setStyle(ButtonStyle.Danger);
            } else {
                btn.setLabel(cell.isMine ? "💥" : (cell.count > 0 ? cell.count.toString() : " "))
                   .setStyle(cell.isMine ? ButtonStyle.Danger : ButtonStyle.Primary)
                   .setDisabled(true);
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("boom_toggle_flag")
            .setLabel(flagMode ? "CHẾ ĐỘ: CẮM CỜ 🚩" : "CHẾ ĐỘ: MỞ Ô ⛏️")
            .setStyle(flagMode ? ButtonStyle.Warning : ButtonStyle.Success)
            .setDisabled(isGameOver || isWin)
    ));
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
        .setDescription("💣 Game Dò Mìn - Thắng x5 tiền cược")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền bạn muốn đặt cược")
               .setRequired(true)
               .setMinValue(1000)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const user = await User.findOne({ userId: interaction.user.id });

        // 1. Kiểm tra tiền túi
        if (!user || user.money < bet) {
            return interaction.reply({ content: `❌ Bạn không đủ tiền! Ví hiện tại: \`${(user?.money || 0).toLocaleString()} VND\``, flags: 64 });
        }

        // 2. Trừ tiền cược ngay lập tức
        user.money -= bet;
        await user.save();

        const size = 5;
        const mineCount = 4;
        let board = createBoard(size, mineCount);
        let flagMode = false;
        let gameOver = false;
        let win = false;

        const embed = new EmbedBuilder()
            .setTitle("💣 DÒ MÌN - KHỞI NGHIỆP")
            .setDescription(`💰 Tiền cược: **${bet.toLocaleString()} VND**\n💎 Thắng nhận: **${(bet * 5).toLocaleString()} VND** (x5)`)
            .setColor(0x2f3136)
            .setFooter({ text: "Nhấn nút dưới để chuyển chế độ Cắm Cờ 🚩" });

        const msg = await interaction.reply({
            embeds: [embed],
            components: createComponents(board, false, false, flagMode),
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 // Tăng lên 2 phút cho thoải mái
        });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "Trận này không phải của bạn!", flags: 64 });

            if (i.customId === "boom_toggle_flag") {
                flagMode = !flagMode;
                return i.update({ components: createComponents(board, false, false, flagMode) });
            }

            const [, r, c] = i.customId.split("_").map(Number);
            const cell = board[r][c];

            if (flagMode) {
                if (!cell.isOpen) cell.isFlagged = !cell.isFlagged;
            } else {
                if (cell.isFlagged) return i.reply({ content: "Hãy bỏ cờ 🚩 trước khi mở!", flags: 64 });
                if (cell.isMine) {
                    gameOver = true;
                    return collector.stop("mine");
                } 
                reveal(board, r, c);
                const unOpenedNonMines = board.flat().filter(cell => !cell.isMine && !cell.isOpen).length;
                if (unOpenedNonMines === 0) {
                    win = true;
                    return collector.stop("win");
                }
            }
            await i.update({ components: createComponents(board, false, false, flagMode) });
        });

        collector.on("end", async (collected, reason) => {
            let finalMsg = "";
            if (reason === "mine") {
                finalMsg = `💥 **GAME OVER!** Bạn đạp mìn và mất \`${bet.toLocaleString()} VND\`.`;
                embed.setColor(0xff0000);
            } else if (reason === "win") {
                const prize = bet * 5;
                // CỘNG THƯỞNG X5
                const winner = await User.findOne({ userId: interaction.user.id });
                winner.money += prize;
                await winner.save();

                finalMsg = `🏆 **VICTORY!** Bạn đã thắng và nhận được \`${prize.toLocaleString()} VND\`!`;
                embed.setColor(0x00ff00);
            } else {
                finalMsg = "⏰ Trận đấu kết thúc do quá thời gian.";
            }

            await interaction.editReply({
                content: finalMsg,
                embeds: [embed],
                components: createComponents(board, gameOver, win, flagMode)
            }).catch(() => {});
        });
    }
};