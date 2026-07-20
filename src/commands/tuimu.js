const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed, safeEdit, sleep } = require("../utils/ui");

const PRICE_PER_BAG = 100000;
const MAX_BAGS = 100;
const WIN_PERCENT = 40; // Giữ nguyên tỉ lệ

const games = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tuimu")
        .setDescription("🎁 Mua túi mù may mắn - Cơ hội nhận quà khủng!"),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("tuimu_modal")
            .setTitle("🛍️ MUA TÚI MÙ MAY MẮN");

        const input = new TextInputBuilder()
            .setCustomId("bag_amount")
            .setLabel(`Số lượng túi (${PRICE_PER_BAG.toLocaleString()} VND/túi)`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Nhập số lượng (Tối đa ${MAX_BAGS})`)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        if (interaction.customId !== "tuimu_modal") return;

        const amount = parseInt(interaction.fields.getTextInputValue("bag_amount").replace(/[.,\s]/g, ""));
        if (isNaN(amount) || amount <= 0 || amount > MAX_BAGS) {
            return interaction.reply({ content: `❌ Số lượng không hợp lệ (1 - ${MAX_BAGS})!`, flags: 64 });
        }

        const totalCost = amount * PRICE_PER_BAG;
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user || user.money < totalCost) {
            return interaction.reply({ content: `❌ Cần ${vnd(totalCost)} cho ${amount} túi! Ví bạn còn ${vnd(user?.money || 0)}.`, flags: 64 });
        }
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm mua sắm!", flags: 64 });

        // TRỪ TIỀN NGAY (giữ nguyên)
        user.money -= totalCost;
        await user.save();

        const embed = casinoEmbed({ color: COLORS.gold, title: "🎁 ✦ LÔ TÚI MÙ ĐÃ VỀ TAY! ✦ 🎁" })
            .setDescription(
                `\`\`\`\n  🎁🎁🎁🎁🎁\n  🎁🎁🎁🎁🎁   x${amount} túi bí ẩn\n\`\`\`` +
                `> 📦 Số lượng: **${amount} túi**\n` +
                `> 💸 Tổng chi: **-${money(totalCost)} VND** • Ví còn: ${vnd(user.money)}\n` +
                `> 🎲 Mỗi túi: ${WIN_PERCENT}% có quà từ \`20.000\` đến \`500.000\` VND\n\n` +
                `*Hít một hơi thật sâu... rồi bấm KHUI!* 🫁`
            )
            .setFooter({ text: "🍀 Cầu nhân phẩm đi nào!" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("tuimu_open").setLabel("KHUI TÚI").setEmoji("🎁").setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
        const response = await interaction.fetchReply();

        games.set(response.id, {
            userId: interaction.user.id,
            amount,
            totalCost,
        });
    },

    async handleButton(interaction) {
        const game = games.get(interaction.message.id);
        if (!game) return;

        if (interaction.user.id !== game.userId) {
            return interaction.reply({ content: "❌ Túi này của người khác mà!", flags: 64 });
        }

        if (interaction.customId === "tuimu_open") {
            games.delete(interaction.message.id); // chống double-click khui 2 lần

            // 🎬 ANIMATION XÉ TÚI
            const frames = [
                "```\n  ✂️🎁🎁🎁\n  RẸT... RẸT...\n```",
                "```\n  💨📦✨📦\n  CÓ GÌ TRONG NÀY?!\n```",
                "```\n  ✨🌟✨🌟✨\n  SẮP LỘ DIỆN...!!!\n```",
            ];
            await interaction.update({
                embeds: [casinoEmbed({ color: COLORS.purple, title: "🎁 ĐANG KHUI TÚI...", description: frames[0] })],
                components: [],
            });
            for (let i = 1; i < frames.length; i++) {
                await sleep(1000);
                await safeEdit(interaction, {
                    embeds: [casinoEmbed({ color: COLORS.purple, title: "🎁 ĐANG KHUI TÚI...", description: frames[i] })],
                }, interaction.message.id);
            }
            await sleep(800);

            // 🎲 TÍNH KẾT QUẢ (giữ nguyên: 40% trúng, 20k-500k)
            let totalReward = 0;
            let winCount = 0;
            let jackpotBags = [], luckyBags = [];
            let biggest = 0;

            for (let i = 1; i <= game.amount; i++) {
                const isWin = Math.random() * 100 < WIN_PERCENT;
                if (isWin) {
                    const reward = Math.floor(Math.random() * (500000 - 20000 + 1) + 20000);
                    totalReward += reward;
                    winCount++;
                    if (reward > biggest) biggest = reward;
                    if (reward >= 400000) jackpotBags.push(`> 💎 Túi #${i}: **+${money(reward)}** JACKPOT!`);
                    else if (reward > 250000) luckyBags.push(`> 🔥 Túi #${i}: **+${money(reward)}**`);
                }
            }

            const user = await User.findOne({ userId: interaction.user.id });
            user.money += totalReward;
            if (user.stats) {
                if (totalReward >= game.totalCost) user.stats.win++;
                else user.stats.lose++;
                user.stats.gamblePlayed++;
            }
            await user.save();

            const profit = totalReward - game.totalCost;
            const winRateActual = Math.round((winCount / game.amount) * 100);
            const highlight = [...jackpotBags, ...luckyBags].slice(0, 6);

            const resultEmbed = casinoEmbed({
                color: profit >= 0 ? COLORS.green : COLORS.red,
                title: profit >= 0 ? "🎊 KHUI TÚI ĐẠI THẮNG — NHÂN PHẨM CỰC PHẨM!" : "🥲 KHUI TÚI XONG... NGHÈO THÊM TÍ!",
            })
                .setDescription(
                    `# ${profit >= 0 ? "📈 LÃI" : "📉 LỖ"} ${money(Math.abs(profit))} VND\n${"─".repeat(25)}\n` +
                    `> 📦 Tổng túi: **${game.amount}** • 🎉 Trúng: **${winCount}** túi (${winRateActual}%)\n` +
                    `${bar(winCount / game.amount, 12, "🟨", "⬛")}\n` +
                    `> 💰 Tổng quà nhận: **+${money(totalReward)} VND**\n` +
                    `> 👑 Túi to nhất: ${biggest > 0 ? `\`${money(biggest)} VND\`` : "*toàn túi rỗng...*"}\n` +
                    `> 💼 Ví hiện tại: ${vnd(user.money)}` +
                    (highlight.length ? `\n${"─".repeat(25)}\n🌟 **CÁC TÚI ĐỈNH NHẤT:**\n${highlight.join("\n")}` : "")
                )
                .setFooter({ text: profit >= 0 ? "🍀 Vía đẹp đấy! Gõ /tuimu mua thêm lô nữa?" : "🎁 Đen thôi... /work rồi quay lại phục thù!" });

            await safeEdit(interaction, { embeds: [resultEmbed], components: [] }, interaction.message.id);
        }
    },
};