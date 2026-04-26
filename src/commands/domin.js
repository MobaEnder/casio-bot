const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");
const User = require("../models/User"); // Thay đổi đường dẫn này cho đúng với project của bạn

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

// --- HÀM TẠO GIAO DIỆN NÚT BẤM (Fix lỗi Label) ---
function createComponents(board, isGameOver = false, isWin = false, flagMode = false) {
    const rows = [];
    for (let r = 0; r < board.length; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < board[r].length; c++) {
            const cell = board[r][c];
            const btn = new ButtonBuilder().setCustomId(`boom_${r}_${c}`);

            // Discord yêu cầu label không được để trống "", dùng "\u200b" để tạo khoảng trắng tàng hình
            if (!cell.isOpen) {
                btn.setLabel(cell.isFlagged ? "🚩" : "\u200b")
                   .setStyle(cell.isFlagged ? ButtonStyle.Warning : ButtonStyle.Secondary);
                
                if (isGameOver || isWin) btn.setDisabled(true);
                if (isGameOver && cell.isMine) btn.setLabel("💥").setStyle(ButtonStyle.Danger);
            } else {
                if (cell.isMine) {
                    btn.setLabel("💥").setStyle(ButtonStyle.Danger).setDisabled(true);
                } else {
                    const label = cell.count > 0 ? cell.count.toString() : "\u200b";
                    btn.setLabel(label).setStyle(ButtonStyle.Primary).setDisabled(true);
                }
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }

    // Nút điều khiển chế độ
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("boom_toggle_flag")
            .setLabel(flagMode ? "CHẾ ĐỘ: CẮM CỜ 🚩" : "CHẾ ĐỘ: MỞ Ô ⛏️")
            .setStyle(flagMode ? ButtonStyle.Warning : ButtonStyle.Success)
            .setDisabled(isGameOver || isWin)
    ));
    return rows;
}

// --- LOGIC LOANG (MỞ Ô TRỐNG) ---
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
        .setDescription("💣 Dò mìn thử thách - Thắng x5 tiền cược")
        .addIntegerOption(opt => 
            opt.setName("tiencuoc")
               .setDescription("Số tiền đặt cược")
               .setRequired(true)
               .setMinValue(1000)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger("tiencuoc");
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user || user.money < bet) {
            return interaction.reply({ 
                content: `❌ Bạn không đủ tiền! Ví: \`${(user?.money || 0).toLocaleString()}\` VND`, 
                flags: 64 
            });
        }

        // Tạm thu tiền cược
        user.money -= bet;
        await user.save();

        let board = createBoard(5, 4); // Bàn 5x5, 4 quả mìn
        let flagMode = false;
        let gameOver = false;
        let win = false;

        const embed = new EmbedBuilder()
            .setTitle("💣 DÒ MÌN - CASINO EDITION")
            .setDescription(`💰 Cược: **${bet.toLocaleString()}** | 🎁 Thắng nhận: **${(bet * 5).toLocaleString()}**\n\nHãy cẩn thận với những quả mìn ẩn giấu!`)
            .setColor(0x2f3136);

        // Sử dụng withResponse để tránh Warning fetchReply
        const response = await interaction.reply({
            embeds: [embed],
            components: createComponents(board, false, false, flagMode),
            withResponse: true
        });

        const collector = response.resource 
            ? response.resource.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 })
            : response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: "Không phải lượt của bạn!", flags: 64 });

            if (i.customId === "boom_toggle_flag") {
                flagMode = !flagMode;
                return i.update({ components: createComponents(board, false, false, flagMode) });
            }

            const [, r, c] = i.customId.split("_").map(Number);
            const cell = board[r][c];

            if (flagMode) {
                if (!cell.isOpen) cell.isFlagged = !cell.isFlagged;
            } else {
                if (cell.isFlagged) return i.reply({ content: "Gỡ cờ trước khi mở!", flags: 64 });
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
            let finalMsg = "";
            if (reason === "mine") {
                finalMsg = `💥 **GAME OVER!** Bạn mất \`${bet.toLocaleString()}\` VND.`;
                embed.setColor(0xff0000);
            } else if (reason === "win") {
                const prize = bet * 5;
                const winner = await User.findOne({ userId: interaction.user.id });
                winner.money += prize;
                await winner.save();
                finalMsg = `🏆 **THẮNG LỚN!** Bạn nhận được \`${prize.toLocaleString()}\` VND!`;
                embed.setColor(0x00ff00);
            } else {
                finalMsg = "⏰ Hết thời gian tương tác.";
            }

            await interaction.editReply({
                content: finalMsg,
                embeds: [embed],
                components: createComponents(board, gameOver, win, flagMode)
            }).catch(() => {});
        });
    }
};