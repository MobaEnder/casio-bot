const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, bar, casinoEmbed } = require("../utils/ui");

// 🏅 DANH SÁCH THÀNH TỰU (check dựa trên dữ liệu sẵn có — thêm bớt tùy ý)
const ACHIEVEMENTS = [
    { id: "first_blood", badge: "🩸 Khai Trương Vận Đỏ", desc: "Thắng ván cờ bạc đầu tiên", reward: 30000, check: (u) => (u.stats?.win || 0) >= 1, prog: (u) => [Math.min(1, u.stats?.win || 0), 1] },
    { id: "win50", badge: "🎯 Xạ Thủ Sòng Bài", desc: "Thắng 50 ván", reward: 100000, check: (u) => (u.stats?.win || 0) >= 50, prog: (u) => [Math.min(50, u.stats?.win || 0), 50] },
    { id: "win200", badge: "🃏 Thần Bài Nhập Môn", desc: "Thắng 200 ván", reward: 500000, check: (u) => (u.stats?.win || 0) >= 200, prog: (u) => [Math.min(200, u.stats?.win || 0), 200] },
    { id: "play500", badge: "🎰 Con Nghiện Chính Hiệu", desc: "Chơi tổng 500 ván", reward: 300000, check: (u) => (u.stats?.gamblePlayed || 0) >= 500, prog: (u) => [Math.min(500, u.stats?.gamblePlayed || 0), 500] },
    { id: "lose100", badge: "🕳️ Nhà Tài Trợ Kim Cương", desc: "Thua 100 ván (cảm ơn vì đã nuôi nhà cái)", reward: 200000, check: (u) => (u.stats?.lose || 0) >= 100, prog: (u) => [Math.min(100, u.stats?.lose || 0), 100] },
    { id: "rich10m", badge: "🥇 Chục Triệu Đầu Đời", desc: "Sở hữu 10 triệu tiền mặt", reward: 100000, check: (u) => u.money >= 10000000, prog: (u) => [Math.min(10000000, u.money), 10000000] },
    { id: "rich100m", badge: "💎 Đại Gia Trăm Triệu", desc: "Sở hữu 100 triệu tiền mặt", reward: 1000000, check: (u) => u.money >= 100000000, prog: (u) => [Math.min(100000000, u.money), 100000000] },
    { id: "rich1b", badge: "👑 Tỷ Phú Casino", desc: "Sở hữu 1 TỶ tiền mặt", reward: 10000000, check: (u) => u.money >= 1000000000, prog: (u) => [Math.min(1000000000, u.money), 1000000000] },
    { id: "tower50", badge: "🗼 Chinh Phục Gia", desc: "Leo tới tầng 50 Tháp Vô Tận", reward: 500000, check: (u) => (u.towerFloor || 1) >= 50, prog: (u) => [Math.min(50, u.towerFloor || 1), 50] },
    { id: "tower150", badge: "🌌 Kẻ Chạm Đỉnh Tháp", desc: "Phá đảo tầng 150", reward: 5000000, check: (u) => (u.towerFloor || 1) >= 150, prog: (u) => [Math.min(150, u.towerFloor || 1), 150] },
    { id: "chat1000", badge: "📢 Loa Phường Chính Hiệu", desc: "Chat 1.000 tin nhắn", reward: 200000, check: (u) => (u.totalMessages || 0) >= 1000, prog: (u) => [Math.min(1000, u.totalMessages || 0), 1000] },
    { id: "level20", badge: "⚡ Lão Làng Cấp 20", desc: "Đạt Level 20", reward: 300000, check: (u) => (u.level || 1) >= 20, prog: (u) => [Math.min(20, u.level || 1), 20] },
    { id: "cards5", badge: "🎴 Nhà Sưu Tầm", desc: "Sở hữu đủ 5 thẻ bài", reward: 150000, check: (u) => (u.cards?.length || 0) >= 5, prog: (u) => [Math.min(5, u.cards?.length || 0), 5] },
    { id: "survivor", badge: "⚰️ Kẻ Từng Chết Đi Sống Lại", desc: "Từng bị BAN rồi được ân xá (banned=false nhưng từng vay)", reward: 100000, check: (u) => u.banned === false && u.loan && u.loan.from === null && (u.stats?.lose || 0) >= 20, prog: (u) => [(u.stats?.lose || 0) >= 20 && !u.banned ? 1 : 0, 1] },
];

function ensureAch(user) {
    if (!user.achievements || !Array.isArray(user.achievements.claimed)) {
        user.achievements = { claimed: [], displayed: null };
        user.markModified("achievements");
    }
    return user.achievements;
}

function renderBoard(user) {
    ensureAch(user);
    const lines = ACHIEVEMENTS.map((a) => {
        const claimed = user.achievements.claimed.includes(a.id);
        const done = a.check(user);
        const [cur, target] = a.prog(user);
        const icon = claimed ? "🏅" : done ? "🎁" : "🔒";
        const status = claimed
            ? (user.achievements.displayed === a.id ? "🏅 **ĐANG ĐEO**" : "✅ đã nhận")
            : done ? `🎁 **BẤM NHẬN +${money(a.reward)}!**`
            : `\`${money(cur)}/${money(target)}\``;
        return `${icon} **${a.badge}** — *${a.desc}*\n> ${bar(cur / target, 8, claimed || done ? "🟩" : "🟨", "⬛")} ${status}`;
    });

    const doneCount = user.achievements.claimed.length;
    return casinoEmbed({ color: doneCount >= ACHIEVEMENTS.length ? COLORS.gold : COLORS.purple, title: `🏅 THÀNH TỰU CỦA ${user.userId ? "" : ""}BẠN (${doneCount}/${ACHIEVEMENTS.length})` })
        .setDescription(lines.join("\n\n"))
        .setFooter({ text: "💡 Nhận thưởng xong có thể chọn 1 huy hiệu đeo lên /hoso!" });
}

function actionRows(user) {
    ensureAch(user);
    // Nút nhận thưởng cho các thành tựu đã đạt chưa claim (tối đa 5 nút)
    const claimable = ACHIEVEMENTS.filter((a) => a.check(user) && !user.achievements.claimed.includes(a.id)).slice(0, 5);
    const rows = [];
    if (claimable.length > 0) {
        const row = new ActionRowBuilder();
        claimable.forEach((a) => row.addComponents(
            new ButtonBuilder().setCustomId(`thanhtuu_claim_${a.id}`).setLabel(a.badge.slice(0, 25)).setEmoji("🎁").setStyle(ButtonStyle.Success)
        ));
        rows.push(row);
    }
    // Menu chọn huy hiệu đeo (chỉ những cái đã claim)
    const owned = ACHIEVEMENTS.filter((a) => user.achievements.claimed.includes(a.id));
    if (owned.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("thanhtuu_wear")
                .setPlaceholder("🏅 Chọn huy hiệu đeo lên /hoso...")
                .addOptions([
                    { label: "— Không đeo huy hiệu —", value: "none", emoji: "❌" },
                    ...owned.map((a) => ({ label: a.badge.slice(0, 100), value: a.id, emoji: "🏅" })),
                ])
        ));
    }
    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("thanhtuu")
        .setDescription("🏅 Xem thành tựu cá nhân, nhận thưởng và chọn huy hiệu đeo"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });
        ensureAch(user);
        await user.save();

        await interaction.reply({ embeds: [renderBoard(user)], components: actionRows(user), flags: 64 });
    },

    async handleButton(interaction) {
        // ⚡ Báo Discord "đợi tí" NGAY LẬP TỨC — tránh lỗi "không phản hồi kịp" khi DB chậm
        await interaction.deferUpdate();

        const achId = interaction.customId.split("_").slice(2).join("_"); // Fix: ID có dấu _ (vd first_blood) bị cắt cụt
        const ach = ACHIEVEMENTS.find((a) => a.id === achId);
        if (!ach) return;

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return;
        ensureAch(user);

        if (user.achievements.claimed.includes(achId)) return interaction.followUp({ content: "✅ Đã nhận thành tựu này rồi!", flags: 64 });
        if (!ach.check(user)) return interaction.followUp({ content: "🔒 Chưa đạt điều kiện!", flags: 64 });

        user.achievements.claimed.push(achId);
        user.markModified("achievements");
        user.money += ach.reward;
        await user.save();

        await interaction.editReply({ embeds: [renderBoard(user)], components: actionRows(user) });
        await interaction.followUp({ content: `🏅 Mở khóa **${ach.badge}**! Thưởng **+${money(ach.reward)} VND** 🎉`, flags: 64 });
    },

    async handleMenu(interaction) {
        if (interaction.customId !== "thanhtuu_wear") return;
        await interaction.deferUpdate(); // ⚡ Chống timeout 3s

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user) return;
        ensureAch(user);

        const choice = interaction.values[0];
        if (choice !== "none" && !user.achievements.claimed.includes(choice)) {
            return interaction.followUp({ content: "❌ Bạn chưa sở hữu huy hiệu này!", flags: 64 });
        }

        user.achievements.displayed = choice === "none" ? null : choice;
        user.markModified("achievements");
        await user.save();

        const badge = choice === "none" ? null : ACHIEVEMENTS.find((a) => a.id === choice)?.badge;
        await interaction.editReply({ embeds: [renderBoard(user)], components: actionRows(user) });
        await interaction.followUp({
            content: badge ? `🏅 Đã đeo huy hiệu **${badge}** — vào /hoso ngắm ngay!` : "❌ Đã gỡ huy hiệu.",
            flags: 64,
        });
    },

    ACHIEVEMENTS, // export cho /hoso dùng
};