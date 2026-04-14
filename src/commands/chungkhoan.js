const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require("discord.js");
const User = require("../models/User");

const games = new Map();

// Hàm tạo biểu đồ bằng emoji
function generateChart(history) {
    // history là mảng chứa các giá trị số (ví dụ: [10, 12, 11, 14...])
    const chartHeight = 5;
    const min = Math.min(...history) - 1;
    const max = Math.max(...history) + 1;
    const range = max - min;

    let display = "";
    for (let y = chartHeight; y >= 0; y--) {
        let line = "";
        for (let i = 0; i < history.length; i++) {
            const val = history[i];
            const threshold = ((val - min) / range) * chartHeight;
            
            if (y <= threshold) {
                // Nếu nến hiện tại cao hơn nến trước đó thì màu xanh, ngược lại màu đỏ
                const isUp = i === 0 || history[i] >= history[i - 1];
                line += isUp ? "🟩" : "🟥";
            } else {
                line += "⬛"; // Khoảng trống của biểu đồ (nền đen)
            }
        }
        display += line + "\n";
    }
    return display;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("chungkhoan")
        .setDescription("📈 Dự đoán thị trường bằng biểu đồ nến real-time"),

    async execute(interaction) {
        const user = await User.findOne({ userId: interaction.user.id });
        if (user?.banned) return interaction.reply({ content: "🚫 Bạn đang bị đình chỉ giao dịch!", flags: 64 });

        const embed = new EmbedBuilder()
            .setColor(0x00fbff)
            .setTitle("📊 SÀN GIAO DỊCH QUỐC TẾ")
            .setDescription("Chọn lệnh giao dịch của bạn để bắt đầu quan sát biến động thị trường!")
            .addFields({ name: "Quy tắc", value: "Dự đoán giá sau 15 giây sẽ cao hơn hay thấp hơn giá hiện tại." });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ck_up").setLabel("BUY (LÊN)").setStyle(ButtonStyle.Success).setEmoji("📈"),
            new ButtonBuilder().setCustomId("ck_down").setLabel("SELL (XUỐNG)").setStyle(ButtonStyle.Danger).setEmoji("📉")
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const side = interaction.customId.split("_")[1];
        const modal = new ModalBuilder()
            .setCustomId(`ck_modal_${side}`)
            .setTitle(`Khớp lệnh: ${side === "up" ? "MUA VÀO" : "BÁN RA"}`);

        const input = new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Số vốn đầu tư (VND)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const side = interaction.customId.split("_")[2];
        const amount = parseInt(interaction.fields.getTextInputValue("amount"));

        if (isNaN(amount) || amount < 1000) return interaction.reply({ content: "❌ Tiền không hợp lệ!", flags: 64 });

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });

        user.money -= amount;
        await user.save();

        let history = [10]; // Giá khởi điểm
        let seconds = 0;
        const maxSeconds = 15;

        const embed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle("📉 ĐANG THEO DÕI BIẾN ĐỘNG...")
            .setDescription(`Lệnh: **${side === "up" ? "MUA (LÊN)" : "BÁN (XUỐNG)"}**\nVốn: **${amount.toLocaleString()} VND**\n\n${generateChart(history)}`);

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Vòng lặp cập nhật biểu đồ mỗi giây
        const interval = setInterval(async () => {
            seconds++;
            // Tạo biến động ngẫu nhiên (-2 đến +2)
            const change = (Math.random() * 4 - 2);
            const nextPrice = Math.max(1, history[history.length - 1] + change);
            history.push(nextPrice);

            // Giới hạn chiều rộng biểu đồ (chỉ hiện 15 nến cuối)
            if (history.length > 15) history.shift();

            const updateEmbed = new EmbedBuilder()
                .setColor(0xffff00)
                .setTitle(`📉 THỊ TRƯỜNG ĐANG CHẠY (${maxSeconds - seconds}s)`)
                .setDescription(`Lệnh: **${side === "up" ? "MUA" : "BÁN"}** | Vốn: **${amount.toLocaleString()}**\n\n${generateChart(history)}`);

            await interaction.editReply({ embeds: [updateEmbed] }).catch(() => {});

            if (seconds >= maxSeconds) {
                clearInterval(interval);
                
                // Kết quả: So sánh giá cuối cùng với giá lúc bắt đầu (history[0])
                const startPrice = history[0];
                const endPrice = history[history.length - 1];
                const trend = endPrice >= startPrice ? "up" : "down";
                const isWin = side === trend;

                let userUpdate = await User.findOne({ userId: interaction.user.id });
                let resultText = "";
                let shieldUsed = false;

                if (isWin) {
                    const winAmt = amount * 2;
                    userUpdate.money += winAmt;
                    resultText = `✅ **THẮNG!** Giá đã **${trend === "up" ? "TĂNG" : "GIẢM"}** đúng dự đoán.\n💰 Nhận được: **+${winAmt.toLocaleString()} VND**`;
                } else {
                    if (userUpdate.buffs?.shield > 0) {
                        const refund = Math.floor(amount * userUpdate.buffs.shield);
                        userUpdate.money += refund;
                        userUpdate.buffs.shield = 0;
                        shieldUsed = true;
                        resultText = `❌ **THUA!** Thị trường đi ngược lệnh.\n🔰 **KHIÊN:** Đã hoàn lại **${refund.toLocaleString()} VND** cho bạn.`;
                    } else {
                        resultText = `❌ **THUA!** Bạn mất **${amount.toLocaleString()} VND**.`;
                    }
                }

                await userUpdate.save();

                const finalEmbed = new EmbedBuilder()
                    .setColor(isWin ? 0x00ff00 : 0xff0000)
                    .setTitle(isWin ? "🚀 CHỐT LỜI THÀNH CÔNG" : "📉 CẮT LỖ THẤT BẠI")
                    .setDescription(`${generateChart(history)}\n${resultText}`)
                    .setFooter({ text: shieldUsed ? "Đã sử dụng 1 Khiên bảo vệ" : "Sàn giao dịch kết thúc ván." });

                await interaction.editReply({ embeds: [finalEmbed] });
            }
        }, 1000); // 1000ms = 1 giây cập nhật 1 lần
    }
};