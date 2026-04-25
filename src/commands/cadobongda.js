const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();
const BET_TIME = 40000; // 40 giây đặt cược
const SIM_TIME = 30000; // 30 giây mô phỏng

const teams = [
    { name: "Real Madrid", emoji: "⚪" }, { name: "Man City", emoji: "🔵" },
    { name: "Manchester United", emoji: "🔴" }, { name: "Liverpool", emoji: "🔴" },
    { name: "Barcelona", emoji: "🔵" }, { name: "Bayern Munich", emoji: "🔴" },
    { name: "Arsenal", emoji: "🔴" }, { name: "Chelsea", emoji: "🔵" },
    { name: "PSG", emoji: "🔵" }, { name: "Inter Milan", emoji: "🔵" },
    { name: "AC Milan", emoji: "🔴" }, { name: "Juventus", emoji: "⚪" },
    { name: "Dortmund", emoji: "🟡" }, { name: "Atletico Madrid", emoji: "🔴" },
    { name: "Leverkusen", emoji: "🔴" }, { name: "Tottenham", emoji: "⚪" },
    { name: "Al Nassr", emoji: "🟡" }, { name: "Inter Miami", emoji: "💗" },
    { name: "Napoli", emoji: "🔵" }, { name: "Aston Villa", emoji: "🟣" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cadobongda")
        .setDescription("⚽ Cá độ bóng đá - Đặt 1 ăn 15!"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🏟️ SIÊU CÚP THẾ GIỚI - MỞ KÈO")
            .setDescription(
                "🔥 **Chọn đội bóng của bạn và đặt cược ngay!**\n" +
                "💰 Tỉ lệ trả thưởng: **x15 lần tiền cược**\n" +
                "⏳ Thời gian khóa kèo: **40 giây**\n\n" +
                "👉 Hãy chọn đội từ Menu thả xuống bên dưới."
            )
            .setFooter({ text: "BOT Casino - Đừng tin vào trọng tài!" });

        const select = new StringSelectMenuBuilder()
            .setCustomId("cadobongda_select") // SỬA: Phải bắt đầu bằng tên lệnh
            .setPlaceholder("Chọn chiến mã của bạn...")
            .addOptions(teams.map((t, i) => ({ label: t.name, value: i.toString(), emoji: t.emoji })));

        const row = new ActionRowBuilder().addComponents(select);

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        games.set(response.id, {
            bets: new Map(), // userId -> { teamIndex, amount }
            isStarted: false,
            message: response
        });

        setTimeout(() => startMatch(response.id), BET_TIME);
    },

    // SỬA: Đổi tên thành handleMenu để khớp với index.js của bạn
    async handleMenu(interaction) {
        const game = games.get(interaction.message.id);
        if (!game || game.isStarted) return interaction.reply({ content: "❌ Trận đấu đã bắt đầu hoặc không tồn tại!", flags: 64 });

        const teamIndex = parseInt(interaction.values[0]);
        const team = teams[teamIndex];

        const modal = new ModalBuilder()
            .setCustomId(`cadobongda_modal_${teamIndex}`) // SỬA: Phải bắt đầu bằng tên lệnh
            .setTitle(`Cược cho ${team.name}`);

        const input = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel("Số tiền muốn cược (VND):")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ví dụ: 50000")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const teamIndex = parseInt(interaction.customId.split("_")[2]);
        const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));
        const game = games.get(interaction.message.id);

        if (!game || game.isStarted) return interaction.reply({ content: "❌ Hết thời gian đặt cược!", flags: 64 });
        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tối thiểu cược 1,000 VND!", flags: 64 });

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
        
        // Check ban đã có ở index.js nhưng có thể giữ lại cho chắc
        if (user.banned) return interaction.reply({ content: "🚫 Bạn đang bị cấm cờ bạc!", flags: 64 });

        user.money -= amount;
        await user.save();

        game.bets.set(interaction.user.id, { teamIndex, amount });

        await interaction.reply({
            content: `✅ Bạn đã đặt **${amount.toLocaleString()} VND** vào đội **${teams[teamIndex].name}**!`,
            flags: 64
        });
    }
};

async function startMatch(gameId) {
    const game = games.get(gameId);
    if (!game) return;
    game.isStarted = true;

    // --- LOGIC NHÀ CÁI BỊP (Tỉ lệ thắng 40%) ---
    let teamTotals = new Array(teams.length).fill(0);
    game.bets.forEach(bet => teamTotals[bet.teamIndex] += bet.amount);

    let winnerIndex;
    const isHouseRig = Math.random() < 0.60; 

    if (isHouseRig) {
        const minMoney = Math.min(...teamTotals);
        const candidates = teamTotals.map((val, idx) => val === minMoney ? idx : null).filter(v => v !== null);
        winnerIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        winnerIndex = Math.floor(Math.random() * teams.length);
    }

    // --- MÔ PHỎNG BIỂU ĐỒ ---
    let progress = new Array(teams.length).fill(0);
    const chartEmoji = "🟩";
    const emptyEmoji = "⬛";

    const interval = setInterval(async () => {
        let chartDisplay = "";
        
        const activeTeams = [];
        game.bets.forEach(bet => { if(!activeTeams.includes(bet.teamIndex)) activeTeams.push(bet.teamIndex) });
        if (!activeTeams.includes(winnerIndex)) activeTeams.push(winnerIndex);

        activeTeams.sort((a, b) => b === winnerIndex ? 1 : -1).forEach(idx => {
            if (idx === winnerIndex) progress[idx] += Math.random() * 15;
            else progress[idx] += Math.random() * 10;

            if (progress[idx] > 100) progress[idx] = 100;

            const bars = Math.floor(progress[idx] / 10);
            chartDisplay += `${teams[idx].emoji} **${teams[idx].name}**\n[${chartEmoji.repeat(bars)}${emptyEmoji.repeat(10 - bars)}] ${Math.floor(progress[idx])}%\n`;
        });

        const simEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle("⚽ TRẬN ĐẤU ĐANG DIỄN RA...")
            .setDescription(chartDisplay);

        await game.message.edit({ embeds: [simEmbed], components: [] }).catch(() => {});
    }, 3000);

    setTimeout(async () => {
        clearInterval(interval);
        const winner = teams[winnerIndex];
        let winnersList = [];

        for (const [userId, bet] of game.bets.entries()) {
            if (bet.teamIndex === winnerIndex) {
                const winAmt = bet.amount * 15;
                const uData = await User.findOne({ userId });
                uData.money += winAmt;
                await uData.save();
                winnersList.push(`<@${userId}> (+${winAmt.toLocaleString()})`);
            }
        }

        const finalEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle(`🏆 NHÀ VÔ ĐỊCH: ${winner.name.toUpperCase()}`)
            .setThumbnail("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0i08VarAesO8M6LLzBhHB8XGAEjxHA2dFrA&s")
            .setDescription(
                `🏁 Đội **${winner.emoji} ${winner.name}** đã xuất sắc giành chiến thắng!\n\n` +
                `💰 **Người thắng kèo:**\n${winnersList.join("\n") || "Không có đại gia nào chọn đúng!"}`
            )
            .setFooter({ text: "Thắng làm vua, thua cày tiếp." })
            .setTimestamp();

        await game.message.edit({ embeds: [finalEmbed] });
        games.delete(gameId);
    }, SIM_TIME);
}