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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nganhang")
        .setDescription("🏦 Ngân hàng Trung ương - Gửi tiết kiệm lãi suất 4%/giờ"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        // Tính toán lãi suất tạm tính hiện tại
        let interest = 0;
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / (1000 * 60 * 60);
            if (hours >= 1) {
                // Công thức lãi 4% mỗi giờ
                interest = Math.floor(user.bankMoney * (Math.pow(1.04, Math.floor(hours)) - 1));
            }
        }

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🏦 NGÂN HÀNG DISCORD")
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription(
                `Chào mừng **${interaction.user.username}**,\n\n` +
                `💰 Ví tiền: **${user.money.toLocaleString()} VND**\n` +
                `🏦 Ngân hàng: **${user.bankMoney.toLocaleString()} VND**\n` +
                `📈 Lãi suất tích lũy: **+${interest.toLocaleString()} VND** *(4%/h)*\n\n` +
                `*Lưu ý: Lãi chỉ được tính sau mỗi 1 giờ gửi tiền.*`
            )
            .setFooter({ text: "Tin nhắn sẽ tự hủy sau 30 giây" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("bank_deposit").setLabel("Gửi Tiền").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("bank_withdraw").setLabel("Rút Tiền").setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            withResponse: true
        });

        // Tự động xóa tin nhắn sau 30s
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
        }, 30000);
    },

    // ================= XỬ LÝ NÚT BẤM =================
    async handleButton(interaction) {
        const action = interaction.customId.split("_")[1]; // deposit hoặc withdraw
        
        const modal = new ModalBuilder()
            .setCustomId(`bank_modal_${action}`)
            .setTitle(action === "deposit" ? "📥 GỬI TIỀN TIẾT KIỆM" : "📤 RÚT TIỀN NGÂN HÀNG");

        const input = new TextInputBuilder()
            .setCustomId("bank_amount")
            .setLabel("Nhập số tiền hoặc 'all'")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ví dụ: 500000 hoặc all")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    // ================= XỬ LÝ MODAL =================
    async handleModal(interaction) {
        const action = interaction.customId.split("_")[2];
        let amountInput = interaction.fields.getTextInputValue("bank_amount").toLowerCase();
        let user = await User.findOne({ userId: interaction.user.id });

        let amount = 0;
        if (amountInput === "all") {
            amount = action === "deposit" ? user.money : user.bankMoney;
        } else {
            amount = parseInt(amountInput);
        }

        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({ content: "❌ Số tiền không hợp lệ!", flags: 64 });
        }

        // --- XỬ LÝ GỬI TIỀN ---
        if (action === "deposit") {
            if (user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền mặt!", flags: 64 });
            
            // Trước khi gửi mới, nếu đang có tiền trong bank thì chốt lãi cũ luôn
            if (user.bankMoney > 0) {
                const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / (1000 * 60 * 60);
                if (hours >= 1) {
                    const interest = Math.floor(user.bankMoney * (Math.pow(1.04, Math.floor(hours)) - 1));
                    user.bankMoney += interest;
                }
            }

            user.money -= amount;
            user.bankMoney += amount;
            user.lastDepositAt = new Date(); // Reset mốc thời gian tính lãi
            await user.save();

            return interaction.reply({ content: `✅ Đã gửi **${amount.toLocaleString()} VND** vào ngân hàng!`, flags: 64 });
        }

        // --- XỬ LÝ RÚT TIỀN ---
        if (action === "withdraw") {
            if (user.bankMoney < amount) return interaction.reply({ content: "❌ Ngân hàng không đủ tiền!", flags: 64 });

            // Tính lãi trước khi rút
            const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / (1000 * 60 * 60);
            let interest = 0;
            if (hours >= 1) {
                interest = Math.floor(user.bankMoney * (Math.pow(1.04, Math.floor(hours)) - 1));
            }

            // Nếu rút "tất cả", báo cho họ biết tiền lãi
            const isAll = amount >= user.bankMoney;
            
            user.bankMoney -= amount;
            user.money += (amount + (isAll ? interest : 0)); // Chỉ cộng lãi khi rút hết hoặc chốt sổ
            
            // Nếu rút một phần, cộng lãi tích lũy vào gốc luôn rồi tính mốc mới
            if (!isAll && interest > 0) {
                user.bankMoney += interest;
                user.lastDepositAt = new Date();
            }

            await user.save();

            let msg = `✅ Đã rút **${amount.toLocaleString()} VND** về ví!`;
            if (interest > 0) msg += `\n🎁 Bạn nhận được **${interest.toLocaleString()} VND** tiền lãi!`;
            
            return interaction.reply({ content: msg, flags: 64 });
        }
    }
};