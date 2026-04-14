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

// Hàm vẽ biểu đồ bằng emoji
function generateChart(history) {
    const chartHeight = 5;
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("chungkhoan")
        .setDescription("📈 Chứng khoán 15s - Vẽ biểu đồ Real-time"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x00fbff)
            .setTitle("📊 SÀN GIAO DỊCH QUỐC TẾ")
            .setDescription("Dự đoán hướng đi của thị trường trong 15s tới để X2 tài sản!")
            .addFields({ name: "Lưu ý", value: "Sử dụng Khiên (Shield) để bảo toàn vốn khi đoán sai." });

        const row = new ActionRowBuilder().addComponents(
            // customId phải bắt đầu bằng "chungkhoan" để index.js nhận diện đúng
            new ButtonBuilder().setCustomId("chungkhoan_up").setLabel("BUY (LÊN)").setStyle(ButtonStyle.Success).setEmoji("📈"),
            new ButtonBuilder().setCustomId("chungkhoan_down").setLabel("SELL (XUỐNG)").setStyle(ButtonStyle.Danger).setEmoji("📉")
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleButton(interaction) {
        const side = interaction.customId.split("_")[1]; // lấy "up" hoặc "down"
        
        const modal = new ModalBuilder()
            .setCustomId(`chungkhoan_modal_${side}`) // Bắt đầu bằng tên lệnh
            .setTitle(`Khớp lệnh: ${side === "up" ? "MUA VÀO" : "BÁN RA"}`);

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
        const side = interaction.customId.split("_")[2]; // lấy "up" hoặc "down"
        const amount = parseInt(interaction.fields.getTextInputValue("amount"));

        if (isNaN(amount) || amount < 1000) {
            return interaction.reply({ content: "❌ Số tiền không hợp lệ!", flags: 64 });
        }

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user || user.money < amount) {
            return interaction.reply({ content: "❌ Bạn không đủ tiền!", flags: 64 });
        }

        // Trừ tiền ngay khi đặt lệnh
        user.money -= amount;
        await user.save();

        let history = [10]; 
        let seconds = 0;
        const maxSeconds = 15;

        // Phản hồi ngay để tránh lỗi Interaction Failed
        const initialEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle("📉 ĐANG THEO DÕI BIẾN ĐỘNG...")
            .setDescription(`Lệnh: **${side === "up" ? "MUA (LÊN)" : "BÁN (XUỐNG)"}**\nVốn: **${amount.toLocaleString()} VND**\n\n${generateChart(history)}`);

        await interaction.reply({ embeds: [initialEmbed] });

        const interval = setInterval(async () => {
            seconds++;
            const change = (Math.random() * 4 - 2);
            const nextPrice = Math.max(1, history[history.length - 1] + change);
            history.push(nextPrice);
            if (history.length > 15) history.shift();

            const updateEmbed = new EmbedBuilder()
                .setColor(0xffff00)
                .setTitle(`📉 THỊ TRƯỜNG ĐANG CHẠY (${maxSeconds - seconds}s)`)
                .setDescription(`Lệnh: **${side === "up" ? "MUA" : "BÁN"}** | Vốn: **${amount.toLocaleString()}**\n\n${generateChart(history)}`);

            await interaction.editReply({ embeds: [updateEmbed] }).catch(() => {});

            if (seconds >= maxSeconds) {
                clearInterval(interval);
                
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
                        resultText = `❌ **THUA!** Thị trường đi ngược lệnh.\n🔰 **KHIÊN:** Đã hoàn lại **${refund.toLocaleString()} VND**.`;
                    } else {
                        resultText = `❌ **THUA!** Bạn mất **${amount.toLocaleString()} VND**.`;
                    }
                }

                await userUpdate.save();

                const finalEmbed = new EmbedBuilder()
                    .setColor(isWin ? 0x00ff00 : 0xff0000)
                    .setTitle(isWin ? "🚀 CHỐT LỜI THÀNH CÔNG" : "📉 GIAO DỊCH THẤT BẠI")
                    .setDescription(`${generateChart(history)}\n${resultText}`)
                    .setFooter({ text: shieldUsed ? "🛡️ Đã sử dụng Khiên bảo vệ" : "Sàn giao dịch kết thúc." });

                await interaction.editReply({ embeds: [finalEmbed] });
            }
        }, 1000);
    }
};