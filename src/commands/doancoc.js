const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const games = new Map();
const CUP_COOLDOWN = 60 * 60 * 1000; // 1 tiếng (lưu DB vì miễn phí)
const REWARD = 200000;

// Các khung hình đảo cốc
const SHUFFLE_FRAMES = [
    "```\n   🥤    🥤    🥤\n    ＼  ／＼  ／\n     ✕     ✕\n    ／  ＼／  ＼\n```",
    "```\n     🥤 🥤 🥤\n      ↺  ↻  ↺\n   (xoay vòng vòng...)\n```",
    "```\n   🥤　　🥤　　🥤\n     ＞═══╬═══＜\n    (tráo qua tráo lại!)\n```",
    "```\n    🥤🥤　　　🥤\n      💨💨💨\n   (nhanh dần đều!!)\n```",
    "```\n   🥤    🥤    🥤\n   ﹏﹏﹏﹏﹏﹏﹏\n  (dừng lại... chọn đi!)\n```",
];

function cupButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("doancoc_pick_0").setLabel("Cốc 1").setEmoji("🥤").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("doancoc_pick_1").setLabel("Cốc 2").setEmoji("🥤").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("doancoc_pick_2").setLabel("Cốc 3").setEmoji("🥤").setStyle(ButtonStyle.Primary).setDisabled(disabled)
    );
}

// Vẽ 3 cốc khi lật đáp án
function revealArt(prizeIdx, pickIdx) {
    const row = [0, 1, 2].map((i) => (i === prizeIdx ? "💎" : "❌")).join("    ");
    const pointer = [0, 1, 2].map((i) => (i === pickIdx ? "👆" : "  ")).join("    ");
    return `\`\`\`\n   ${row}\n   ${pointer}\n   (bạn chọn cốc ${pickIdx + 1})\n\`\`\``;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("doancoc")
        .setDescription("🥤 Đoán cốc MIỄN PHÍ - Đúng ăn ngay 200.000 VND (1 lần/giờ)!"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        // ⏳ Cooldown 1h lưu DB (không mất khi bot restart)
        if (Date.now() - (user.lastCup || 0) < CUP_COOLDOWN) {
            const readyAt = (user.lastCup || 0) + CUP_COOLDOWN;
            return interaction.reply({
                content: `🥤 Chủ quán đang rửa cốc! Ván miễn phí tiếp theo ${countdown(readyAt)}.`,
                flags: 64,
            });
        }

        // Chốt cooldown ngay khi bắt đầu (chống spam mở nhiều bàn)
        user.lastCup = Date.now();
        await user.save();

        // 🎬 MÀN 1: Cho xem viên kim cương bỏ vào cốc
        await interaction.reply({
            embeds: [casinoEmbed({ color: COLORS.cyan, title: "🥤 ✦ TRÒ ĐOÁN CỐC ✦ 🥤" })
                .setDescription(
                    `\`\`\`\n   🥤    🥤    🥤\n         💎\n  (bỏ kim cương vào 1 cốc...)\n\`\`\`` +
                    `> 🎁 Đoán đúng cốc chứa 💎 → nhận ngay **${money(REWARD)} VND**!\n> 🆓 Hoàn toàn miễn phí • Nhìn kỹ nhé...`
                )],
        });
        const msg = await interaction.fetchReply();
        await sleep(1500);

        // 🎬 MÀN 2: Animation đảo cốc
        for (const frame of SHUFFLE_FRAMES) {
            await safeEdit(interaction, {
                embeds: [casinoEmbed({ color: COLORS.orange, title: "🌀 ĐANG ĐẢO CỐC — NHÌN CHO KỸ!" })
                    .setDescription(frame + `\n> 👀 *Mắt thường không theo kịp đâu...*`)],
            }, msg.id);
            await sleep(1000);
        }

        // Chốt vị trí kim cương
        const game = { userId: interaction.user.id, prizeIdx: Math.floor(Math.random() * 3) };
        games.set(msg.id, game);

        await safeEdit(interaction, {
            embeds: [casinoEmbed({ color: COLORS.purple, title: "🥤 CHỌN CỐC CỦA BẠN!" })
                .setDescription(
                    `\`\`\`\n   🥤    🥤    🥤\n    1     2     3\n\`\`\`` +
                    `> 💎 Kim cương nằm trong 1 trong 3 cốc.\n> 🎯 Đoán đúng: **+${money(REWARD)} VND** • Sai: về tay không (nhưng miễn phí mà!)`
                )
                .setFooter({ text: "🧠 Tin vào trực giác của bạn!" })],
            components: [cupButtons()],
        }, msg.id);
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return interaction.reply({ content: "❌ Ván này đã kết thúc!", flags: 64 });
        if (interaction.user.id !== game.userId) return interaction.reply({ content: "❌ Đây là ván của người khác! Gõ /doancoc để chơi ván riêng.", flags: 64 });

        games.delete(interaction.message.id);
        const pickIdx = parseInt(interaction.customId.split("_")[2]);
        const correct = pickIdx === game.prizeIdx;

        // 🎬 Hồi hộp tí đã
        await interaction.update({
            embeds: [casinoEmbed({ color: COLORS.orange, title: "🥤 TỪ TỪ LẬT CỐC..." })
                .setDescription(`\`\`\`\n   🥤    🥤    🥤\n   (cốc ${pickIdx + 1} đang được nhấc lên...)\n\`\`\``)],
            components: [],
        });
        await sleep(1500);

        if (correct) {
            const user = await User.findOne({ userId: game.userId });
            user.money += REWARD;
            await user.save();

            return safeEdit(interaction, {
                embeds: [casinoEmbed({ color: COLORS.gold, title: "💎 CHUẨN KHÔNG CẦN CHỈNH!" })
                    .setDescription(
                        revealArt(game.prizeIdx, pickIdx) +
                        `# 🎉 +${money(REWARD)} VND\n` +
                        `> 🧠 Mắt thần đấy! Kim cương nằm đúng cốc **${pickIdx + 1}**!\n` +
                        `> 💼 Ví hiện tại: ${vnd(user.money)}\n` +
                        `> 🔄 Ván free tiếp theo: ${countdown(Date.now() + 60 * 60 * 1000)}`
                    )
                    .setFooter({ text: "🥤 Hẹn gặp lại sau 1 tiếng!" })],
            }, interaction.message.id);
        }

        return safeEdit(interaction, {
            embeds: [casinoEmbed({ color: COLORS.red, title: "💨 TRẬT LẤT RỒI!" })
                .setDescription(
                    revealArt(game.prizeIdx, pickIdx) +
                    `> 🥲 Kim cương nằm ở cốc **${game.prizeIdx + 1}**, bạn chọn cốc **${pickIdx + 1}**...\n` +
                    `> 😌 Không mất gì cả — nhưng cũng chẳng được gì!\n` +
                    `> 🔄 Ván free tiếp theo: ${countdown(Date.now() + 60 * 60 * 1000)}`
                )
                .setFooter({ text: "🥤 Mắt kém thì tập nhìn thêm nhé! Hẹn 1 tiếng nữa." })],
        }, interaction.message.id);
    },
};