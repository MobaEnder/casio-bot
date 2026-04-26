const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");
const User = require("../models/User");

// --- LOGIC KHỞI TẠO BÀN CỜ (4x4) ---
function createBoard(size, mineCount) {
    const board = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({
            isMine: false,
            count: 0,
            isOpen: false
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

// --- GIAO DIỆN NÚT ---
function createComponents(board) {
    const rows = [];
    for (let r = 0; r < board.length; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < board[r].length; c++) {
            const cell = board[r][c];
            const btn = new ButtonBuilder().setCustomId(`boom_${r}_${c}`);
            if (!cell.isOpen) {
                btn.setLabel("\u200b").setStyle(ButtonStyle.Secondary);
            } else {
                btn.setLabel(cell.count > 0 ? cell.count.toString() : "\u200b")
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
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) reveal(board, r + i, c + j);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("doboom")
        .setDescription("💣 Dò mìn - Mở hết ô sạch để thắng")
        .addIntegerOption(opt => opt.setName("tiencuoc").setDescription("Số tiền cược").setRequired(true).setMinValue(1000)),

    async execute(interaction) {
        try {
            const bet = interaction.options.getInteger("tiencuoc");
            const user = await User.findOne({ userId: interaction.user.id });

            if (!user || user.money < bet) {
                return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
            }

            user.money -= bet;
            await user.save();

            let board = createBoard(4, 3);
            const embed = new EmbedBuilder()
                .setTitle("💣 DÒ MÌN - TỐC CHIẾN")
                .setDescription(`💰 Cược: **${bet.toLocaleString()}** | Thắng nhận: **${(bet * 5).toLocaleString()}**\n\n*Nhấn vào các ô để dò mìn!*`)
                .setColor(0x2f3136);

            const message = await interaction.reply({
                embeds: [embed],
                components: createComponents(board),
                fetchReply: true
            });

            const collector = interaction.channel.createMessageComponentCollector({
                filter: (i) => i.message.id === message.id && i.user.id === interaction.user.id,
                componentType: ComponentType.Button,
                time: 60000 // 1 phút để chơi
            });

            collector.on("collect", async (i) => {
                await i.deferUpdate();

                const [, r, c] = i.customId.split("_").map(Number);
                const cell = board[r][c];

                if (cell.isMine) {
                    return collector.stop("mine");
                }

                reveal(board, r, c);

                // Kiểm tra thắng: Số ô chưa mở bằng đúng số mìn
                const unopened = board.flat().filter(cell => !cell.isOpen).length;
                if (unopened === 3) { // 3 là số mìn đã set ở trên
                    return collector.stop("win");
                }

                await interaction.editReply({ components: createComponents(board) });
            });

            collector.on("end", async (_, reason) => {
                if (reason === "win") {
                    const prize = bet * 5;
                    const winner = await User.findOne({ userId: interaction.user.id });
                    winner.money += prize;
                    await winner.save();
                    
                    await interaction.followUp({ 
                        content: `🏆 **THẮNG!** <@${interaction.user.id}> đã dò sạch mìn và nhận **${prize.toLocaleString()}** VND!` 
                    });
                } else if (reason === "mine") {
                    await interaction.followUp({ 
                        content: `💥 **BÙM!** <@${interaction.user.id}> đã đạp trúng mìn và mất cược.` 
                    });
                }

                // XÓA BẢNG GAME SAU KHI KẾT THÚC
                await interaction.deleteReply().catch(() => {});
            });

        } catch (error) {
            console.error("LỖI DÒ MÌN:", error);
        }
    }
};