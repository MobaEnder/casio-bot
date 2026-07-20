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
const { COLORS, money, vnd, casinoEmbed, safeEdit } = require("../utils/ui");

// Vẽ biểu đồ nến emoji (giữ nguyên thuật toán, mở rộng chiều cao)
function generateChart(history) {
    const chartHeight = 6;
    const min = Math.min(...history) - 1;
    const max = Math.max(...history) + 1;
    const range = max - min || 1;

    let display = "";
    for (let y = chartHeight; y >= 0; y--) {
        let line = "";
        for (let i = 0; i < history.length; i++) {
            const val = history[i];
            const threshold = ((val - min) / range) * chartHeight;
            if (y <= threshold) {
                const isUp = i === 0 || history[i] >= history[i - 1];
                line += isUp ? "🟩" : "🟥";
            } else {
                line += "⬛";
            }
        }
        display += line + "\n";
    }
    return display;
}

// Mã cổ phiếu ngẫu nhiên cho vui
const TICKERS = ["🪙 MEO/USDT", "💎 KIMCUONG", "🐔 GAVANG", "🍜 PHOCP", "🚀 TOMOON", "🧻 GIAYVS"];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("chungkhoan")
        .setDescription("📈 Chứng khoán 15s"),

    async execute(interaction) {
        const embed = casinoEmbed({ color: COLORS.cyan, title: "📊 ✦ SÀN GIAO DỊCH QUỐC TẾ ✦ 📊" })
            .setDescription(
                `> 🎯 Dự đoán hướng thị trường trong **15 giây** → ăn **x2** tài sản!\n` +
                `> 📈 **BUY** nếu tin giá LÊN • 📉 **SELL** nếu tin giá XUỐNG\n\n` +
                `\`\`\`\n📉📈 Thị trường đang chờ lệnh của bạn...\n\`\`\``
            )
            .addFields({ name: "⚠️ Cảnh báo rủi ro", value: "Thị trường biến động cực mạnh. Dùng 🔰 Khiên (mua ở /shop) để bảo toàn vốn khi đoán sai." })
            .setFooter({ text: "💼 Đầu tư có trách nhiệm... hoặc không 😏" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("chungkhoan_up").setLabel("BUY (LÊN)").setStyle(ButtonStyle.Success).setEmoji("📈"),
            new ButtonBuilder().setCustomId("chungkhoan_down").setLabel("SELL (XUỐNG)").setStyle(ButtonStyle.Danger).setEmoji("📉")
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const side = interaction.customId.split("_")[1];
        const modal = new ModalBuilder()
            .setCustomId(`chungkhoan_modal_${side}`)
            .setTitle(`Khớp lệnh: ${side === "up" ? "📈 MUA VÀO" : "📉 BÁN RA"}`);

        const input = new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Số vốn đầu tư (VND)")
            .setPlaceholder("Nhập số tiền muốn đầu tư...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const side = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("amount").replace(/[.,\s]/g, ""));

        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Số tiền không hợp lệ (tối thiểu 1.000)!", flags: 64 });

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) return interaction.reply({ content: `❌ Ví bạn chỉ còn ${vnd(user?.money || 0)}!`, flags: 64 });
        if (user.banned) return interaction.reply({ content: "🚫 Bạn bị cấm giao dịch!", flags: 64 });

        user.money -= amount;
        await user.save();

        const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
        let history = [10];
        let seconds = 0;
        const maxSeconds = 15;
        const startPrice = history[0];

        const marketEmbed = (title, color) => {
            const cur = history[history.length - 1];
            const change = ((cur - startPrice) / startPrice) * 100;
            const arrow = change >= 0 ? "🟢 +" : "🔴 ";
            return casinoEmbed({ color, title })
                .setDescription(
                    `> 📌 Mã: **${ticker}** • Lệnh: **${side === "up" ? "📈 MUA" : "📉 BÁN"}** • Vốn: ${vnd(amount)}\n` +
                    `> 💹 Giá vào lệnh: \`${startPrice.toFixed(2)}\` → Hiện tại: \`${cur.toFixed(2)}\` (${arrow}${change.toFixed(1)}%)\n\n` +
                    generateChart(history)
                )
                .setFooter({ text: "🟩 nến tăng • 🟥 nến giảm • Chốt theo giá cuối so với giá vào lệnh" });
        };

        await interaction.reply({ embeds: [marketEmbed("📡 ĐANG KHỚP LỆNH — THEO DÕI BIẾN ĐỘNG...", COLORS.gold)] });

        const interval = setInterval(async () => {
          try {
            seconds++;

            let nextPrice;
            if (seconds < maxSeconds) {
                // Biến động ngẫu nhiên (giữ nguyên)
                const change = Math.random() * 4 - 2;
                nextPrice = Math.max(1, history[history.length - 1] + change);
            } else {
                // 🎯 LÕI TỈ LỆ 35/65 (giữ nguyên)
                const isWin = Math.random() < 0.35;
                if (side === "up") {
                    nextPrice = isWin ? startPrice + Math.random() * 3 + 1 : startPrice - Math.random() * 3 - 1;
                } else {
                    nextPrice = isWin ? startPrice - Math.random() * 3 - 1 : startPrice + Math.random() * 3 + 1;
                }
                nextPrice = Math.max(0.5, nextPrice);
            }

            history.push(nextPrice);
            if (history.length > 15) history.shift();

            if (seconds < maxSeconds) {
                await safeEdit(interaction, { embeds: [marketEmbed(`📡 THỊ TRƯỜNG ĐANG CHẠY — CHỐT SAU ${maxSeconds - seconds}s`, COLORS.gold)] });
            } else {
                clearInterval(interval);

                const endPrice = history[history.length - 1];
                const trend = endPrice >= startPrice ? "up" : "down";
                const finalWin = side === trend;
                const changePct = ((endPrice - startPrice) / startPrice) * 100;

                let userUpdate = await User.findOne({ userId: interaction.user.id });
                let resultText = "";
                let shieldUsed = false;

                if (finalWin) {
                    const winAmt = amount * 2;
                    userUpdate.money += winAmt;
                    if (userUpdate.stats) { userUpdate.stats.win++; userUpdate.stats.gamblePlayed++; }
                    resultText =
                        `# 🚀 +${money(amount)} VND\n` +
                        `> ✅ Chốt \`${endPrice.toFixed(2)}\` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) — đoán chuẩn như chuyên gia!\n` +
                        `> 💰 Nhận về: **+${money(winAmt)}** • Ví: ${vnd(userUpdate.money)}`;
                } else {
                    if (userUpdate.buffs?.shield > 0) {
                        const refund = Math.floor(amount * userUpdate.buffs.shield);
                        userUpdate.money += refund;
                        userUpdate.buffs.shield = 0;
                        shieldUsed = true;
                        resultText =
                            `# 📉 -${money(amount - refund)} VND\n` +
                            `> ❌ Chốt \`${endPrice.toFixed(2)}\` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) — thị trường quay xe!\n` +
                            `> 🔰 **KHIÊN kích hoạt:** hoàn lại **+${money(refund)}** • Ví: ${vnd(userUpdate.money)}`;
                    } else {
                        resultText =
                            `# 💸 -${money(amount)} VND\n` +
                            `> ❌ Chốt \`${endPrice.toFixed(2)}\` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) — cháy tài khoản!\n` +
                            `> 🥲 Ví còn: ${vnd(userUpdate.money)}`;
                    }
                    if (userUpdate.stats) { userUpdate.stats.lose++; userUpdate.stats.gamblePlayed++; }
                }

                await userUpdate.save();

                const finalEmbed = casinoEmbed({
                    color: finalWin ? COLORS.green : COLORS.red,
                    title: finalWin ? "🚀 CHỐT LỜI THÀNH CÔNG — TO THE MOON!" : "📉 GIAO DỊCH THẤT BẠI — ĐU ĐỈNH RỒI!",
                })
                    .setDescription(
                        `> 📌 **${ticker}** • Vào lệnh \`${startPrice.toFixed(2)}\` → Chốt \`${endPrice.toFixed(2)}\`\n\n` +
                        generateChart(history) + "\n" + resultText
                    )
                    .setFooter({ text: shieldUsed ? "🛡️ Đã sử dụng Khiên bảo vệ • Gõ /chungkhoan để gỡ!" : "📊 Sàn đóng cửa • Gõ /chungkhoan để giao dịch tiếp!" });

                await safeEdit(interaction, { embeds: [finalEmbed] });
            }
          } catch (err) {
            clearInterval(interval);
            console.error("❌ [chungkhoan] Lỗi phiên giao dịch:", err);
          }
        }, 1000);
    },
};