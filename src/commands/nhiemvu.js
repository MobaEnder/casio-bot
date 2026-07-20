const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, bar, casinoEmbed, countdown } = require("../utils/ui");

// 📜 DANH SÁCH NHIỆM VỤ MỖI NGÀY (tự theo dõi qua stats sẵn có — chỉnh thưởng tùy ý)
const QUESTS = [
    { id: "login", name: "🌅 Điểm danh casino", desc: "Mở bảng nhiệm vụ hôm nay", target: 1, reward: 20000, track: "login" },
    { id: "play5", name: "🎰 Máu me cờ bạc", desc: "Chơi 5 ván bất kỳ", target: 5, reward: 50000, track: "gamble" },
    { id: "win3", name: "🏆 Tay chơi thứ thiệt", desc: "Thắng 3 ván bất kỳ", target: 3, reward: 80000, track: "win" },
    { id: "chat30", name: "💬 Mõm vàng hoạt náo", desc: "Chat 30 tin nhắn trong kênh casino", target: 30, reward: 50000, track: "msg" },
];

const todayStr = () => new Date().toLocaleDateString("vi-VN"); // theo ngày VN

// Mốc reset: 0h đêm nay
function nextResetTs() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
}

// Đảm bảo user có dữ liệu nhiệm vụ của HÔM NAY (tự reset khi sang ngày)
function ensureQuests(user) {
    const today = todayStr();
    if (!user.quests || user.quests.date !== today) {
        user.quests = {
            date: today,
            baseline: {
                gamble: user.stats?.gamblePlayed || 0,
                win: user.stats?.win || 0,
                msg: user.totalMessages || 0,
            },
            claimed: [],
        };
        user.markModified("quests");
    }
    return user.quests;
}

// Tiến độ hiện tại của 1 nhiệm vụ
function progressOf(user, quest) {
    const q = user.quests;
    if (quest.track === "login") return 1;
    if (quest.track === "gamble") return Math.max(0, (user.stats?.gamblePlayed || 0) - q.baseline.gamble);
    if (quest.track === "win") return Math.max(0, (user.stats?.win || 0) - q.baseline.win);
    if (quest.track === "msg") return Math.max(0, (user.totalMessages || 0) - q.baseline.msg);
    return 0;
}

function renderBoard(user) {
    const q = user.quests;
    let doneCount = 0;
    const lines = QUESTS.map((quest) => {
        const prog = Math.min(quest.target, progressOf(user, quest));
        const claimed = q.claimed.includes(quest.id);
        const done = prog >= quest.target;
        if (claimed) doneCount++;
        const status = claimed ? "✅ **ĐÃ NHẬN**" : done ? "🎁 **BẤM NHẬN THƯỞNG!**" : `\`${prog}/${quest.target}\``;
        return (
            `${claimed ? "✅" : done ? "🎁" : "⬜"} **${quest.name}** — 💰 \`+${money(quest.reward)}\`\n` +
            `> *${quest.desc}*\n> ${bar(prog / quest.target, 10, claimed || done ? "🟩" : "🟨", "⬛")} ${status}`
        );
    });

    return casinoEmbed({ color: doneCount === QUESTS.length ? COLORS.gold : COLORS.blue, title: "📜 ✦ NHIỆM VỤ HẰNG NGÀY ✦ 📜" })
        .setDescription(
            `> 📅 Nhiệm vụ ngày **${q.date}** • Hoàn thành: **${doneCount}/${QUESTS.length}**\n` +
            `> 🔄 Làm mới ${countdown(nextResetTs())}\n${"─".repeat(25)}\n${lines.join("\n\n")}`
        )
        .setFooter({ text: "💡 Nhiệm vụ tự theo dõi khi bạn chơi game & chat — quay lại nhận thưởng!" });
}

function claimButtons(user) {
    const row = new ActionRowBuilder();
    for (const quest of QUESTS) {
        const prog = progressOf(user, quest);
        const claimed = user.quests.claimed.includes(quest.id);
        const done = prog >= quest.target;
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`nhiemvu_claim_${quest.id}`)
                .setLabel(claimed ? "Đã nhận" : done ? `Nhận ${money(quest.reward)}` : quest.name.split(" ")[0])
                .setEmoji(claimed ? "✅" : done ? "🎁" : "🔒")
                .setStyle(claimed ? ButtonStyle.Secondary : done ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(claimed || !done)
        );
    }
    return row;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nhiemvu")
        .setDescription("📜 Xem và nhận thưởng nhiệm vụ hằng ngày"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        ensureQuests(user);
        await user.save();

        await interaction.reply({ embeds: [renderBoard(user)], components: [claimButtons(user)], flags: 64 });
    },

    async handleButton(interaction) {
        await interaction.deferUpdate(); // ⚡ Chống timeout 3s khi DB chậm

        const questId = interaction.customId.split("_")[2];
        const quest = QUESTS.find((qq) => qq.id === questId);
        if (!quest) return;

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return interaction.followUp({ content: "❌ Không tìm thấy dữ liệu!", flags: 64 });

        ensureQuests(user);

        if (user.quests.claimed.includes(questId)) {
            return interaction.followUp({ content: "✅ Bạn đã nhận thưởng nhiệm vụ này rồi!", flags: 64 });
        }
        if (progressOf(user, quest) < quest.target) {
            return interaction.followUp({ content: `🔒 Chưa hoàn thành! Tiến độ: ${progressOf(user, quest)}/${quest.target}`, flags: 64 });
        }

        user.quests.claimed.push(questId);
        user.markModified("quests");
        user.money += quest.reward;
        await user.save();

        const allDone = user.quests.claimed.length === QUESTS.length;
        await interaction.editReply({ embeds: [renderBoard(user)], components: [claimButtons(user)] });
        await interaction.followUp({
            content: `🎁 Đã nhận **+${money(quest.reward)} VND** từ nhiệm vụ **${quest.name}**!` +
                (allDone ? `\n🏅 **HOÀN THÀNH TẤT CẢ NHIỆM VỤ HÔM NAY — quá đỉnh!**` : ""),
            flags: 64,
        });
    },
};