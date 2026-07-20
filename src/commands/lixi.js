const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, safeEdit } = require("../utils/ui");

const envelopes = new Map();
const LIXI_TIME = 5 * 60 * 1000; // Bao tồn tại 5 phút

const GRAB_FLAVOR = [
    "nhanh như chớp giật ngay bao!",
    "chen lấn xô đẩy cướp được!",
    "vừa ngủ dậy tiện tay vớ được!",
    "rình từ nãy giờ, hốt liền!",
    "tay nhanh hơn não, chộp luôn!",
];

// 🧧 Chia bao thành N phần ngẫu nhiên (kiểu lì xì WeChat: hên nhận cục to, xui nhận vài đồng)
function splitAmount(total, parts) {
    const result = [];
    let remaining = total;
    for (let i = 0; i < parts - 1; i++) {
        const partsLeft = parts - i;
        // Ngẫu nhiên từ 1% đến 2x mức trung bình còn lại
        const max = Math.floor((remaining / partsLeft) * 2);
        const amount = Math.max(1, Math.floor(Math.random() * max));
        result.push(amount);
        remaining -= amount;
    }
    result.push(Math.max(1, remaining));
    // Xáo trộn thứ tự
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function renderEnvelope(env) {
    const claimedLines = env.claims.map((c) => `> 🧧 <@${c.userId}> ${c.flavor} **+${money(c.amount)}**${c.amount === env.biggest ? " 👑" : ""}`);
    return casinoEmbed({ color: COLORS.red, title: "🧧 ✦ MƯA LÌ XÌ ĐANG RƠI ✦ 🧧" })
        .setDescription(
            `\`\`\`\n   🧧🧧🧧\n  ╱ 恭喜發財 ╲\n  ╲  💰💰💰  ╱\n   ╰━━━━━━╯\n\`\`\`` +
            `> 🎅 Người thả: <@${env.senderId}>\n` +
            `> 💰 Tổng bao: **\`${money(env.total)} VND\`** chia **${env.parts.length + env.claims.length}** phần HÊN XUI\n` +
            `> 🧧 Còn lại: **${env.parts.length}** phần • Hết hạn ${countdown(env.expiresAt)}\n${"─".repeat(25)}\n` +
            (claimedLines.length ? `**💸 ĐÃ CƯỚP:**\n${claimedLines.join("\n")}` : "*Chưa ai nhanh tay... bấm ngay!*")
        )
        .setFooter({ text: "⚡ Mỗi người chỉ nhận được 1 phần • Phần to phần bé tùy nhân phẩm!" });
}

function grabButton(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("lixi_grab").setLabel("CƯỚP LÌ XÌ").setEmoji("🧧").setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lixi")
        .setDescription("🧧 Thả bao lì xì từ tiền của bạn - Ai nhanh tay người đó hốt!")
        .addIntegerOption((opt) => opt.setName("sotien").setDescription("Tổng tiền bỏ vào bao (tối thiểu 10.000)").setRequired(true).setMinValue(10000))
        .addIntegerOption((opt) => opt.setName("sophan").setDescription("Chia thành mấy phần? (2-10)").setRequired(true).setMinValue(2).setMaxValue(10)),

    async execute(interaction) {
        const total = interaction.options.getInteger("sotien");
        const parts = interaction.options.getInteger("sophan");

        const sender = await User.findOne({ userId: interaction.user.id });
        if (!sender || sender.money < total) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(sender?.money || 0)}, không đủ thả bao ${vnd(total)}!`, flags: 64 });
        if (sender.banned) return interaction.reply({ content: "🚫 Bạn bị cấm giao dịch!", flags: 64 });
        if (sender.loan?.active) return interaction.reply({ content: "⚠️ Đang nợ mà bày đặt thả lì xì! Trả nợ (/tratien) trước đi.", flags: 64 });

        // Trừ tiền người thả ngay
        sender.money -= total;
        await sender.save();

        const env = {
            senderId: interaction.user.id,
            total,
            parts: splitAmount(total, parts),
            claims: [],
            biggest: 0,
            expiresAt: Date.now() + LIXI_TIME,
        };

        await interaction.reply({
            content: `🎊 **@here MƯA LÌ XÌ!** <@${interaction.user.id}> vừa thả bao ${vnd(total)}!`,
            embeds: [renderEnvelope(env)],
            components: [grabButton()],
        });
        const msg = await interaction.fetchReply();
        envelopes.set(msg.id, env);

        // ⏰ Hết hạn: hoàn phần chưa ai nhận về người thả
        setTimeout(async () => {
            const e = envelopes.get(msg.id);
            if (!e) return;
            envelopes.delete(msg.id);
            const refund = e.parts.reduce((a, b) => a + b, 0);
            if (refund > 0) {
                await User.findOneAndUpdate({ userId: e.senderId }, { $inc: { money: refund } });
            }
            await safeEdit(interaction, {
                embeds: [renderEnvelope(e).setTitle("🧧 BAO LÌ XÌ ĐÃ HẾT HẠN").setColor(COLORS.dark)
                    .setFooter({ text: refund > 0 ? `⏰ ${money(refund)} VND chưa ai nhận đã hoàn về người thả.` : "🧧 Bao đã được cướp sạch!" })],
                components: [],
            }, msg.id);
        }, LIXI_TIME);
    },

    async handleButton(interaction) {
        const env = envelopes.get(interaction.message.id);
        if (!env) return interaction.reply({ content: "❌ Bao lì xì đã hết hạn hoặc bị cướp sạch!", flags: 64 });

        if (env.claims.some((c) => c.userId === interaction.user.id)) {
            return interaction.reply({ content: "❌ Tham thế! Mỗi người chỉ được cướp 1 phần thôi!", flags: 64 });
        }
        if (env.parts.length === 0) {
            return interaction.reply({ content: "💨 Chậm tay rồi... bao đã bị cướp sạch!", flags: 64 });
        }

        // 🧧 Nhận phần ngẫu nhiên (đã xáo sẵn, lấy phần đầu)
        const amount = env.parts.shift();
        const flavor = GRAB_FLAVOR[Math.floor(Math.random() * GRAB_FLAVOR.length)];
        env.claims.push({ userId: interaction.user.id, amount, flavor });
        if (amount > env.biggest) env.biggest = amount;

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });
        user.money += amount;
        await user.save();

        const isEmpty = env.parts.length === 0;
        if (isEmpty) envelopes.delete(interaction.message.id);

        await interaction.update({
            embeds: [isEmpty
                ? renderEnvelope(env).setTitle("🧧 BAO ĐÃ BỊ CƯỚP SẠCH! 🧧").setColor(COLORS.gold)
                    .setFooter({ text: "👑 = người hốt phần to nhất • Gõ /lixi để thả bao mới!" })
                : renderEnvelope(env)],
            components: [grabButton(isEmpty)],
        });

        await interaction.followUp({ content: `🧧 Bạn cướp được **+${money(amount)} VND**! ${amount === env.biggest ? "👑 Phần TO NHẤT hiện tại!" : ""}`, flags: 64 });
    },
};