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
        .setDescription("🏦 Ngân hàng Trung ương - Lãi suất 0.3%/giờ"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        // Tính toán lãi suất tạm tính
        let interest = 0;
        if (user.bankMoney > 0 && user.lastDepositAt) {
            const ms = Date.now() - new Date(user.lastDepositAt).getTime();
            const hours = ms / (1000 * 60 * 60);
            if (hours >= 1) {
                // Công thức lãi kép: Gốc * (1 + r)^n - Gốc (r = 0.3% = 0.003)
                interest = Math.floor(user.bankMoney * (Math.pow(1.003, Math.floor(hours)) - 1));
            }
        }

        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🏦 NGÂN HÀNG TRUNG ƯƠNG")
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription(
                `Chào **${interaction.user.username}**, tình trạng tài sản của bạn:\n\n` +
                `💵 Tiền mặt: **${user.money.toLocaleString()} VND**\n` +
                `🏦 Gửi tiết kiệm: **${user.bankMoney.toLocaleString()} VND**\n` +
                `📈 Lãi tích lũy: **+${interest.toLocaleString()} VND** *(0.3%/h)*\n\n` +
                `*Lãi suất sẽ được cộng dồn sau mỗi giờ gửi!*`
            )
            .setFooter({ text: "Tự động xóa sau 30 giây" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("nganhang_deposit")
                .setLabel("Gửi Tiền")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("nganhang_withdraw")
                .setLabel("Rút Tiền")
                .setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            withResponse: true
        });

        // Xóa tin nhắn sau 30s để tránh rác kênh
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
        }, 30000);
    },

    // ================= XỬ LÝ NÚT BẤM =================
    async handleButton(interaction) {
        // ID: nganhang_deposit -> action là deposit
        const action = interaction.customId.split("_")[1]; 
        
        const modal = new ModalBuilder()
            .setCustomId(`nganhang_modal_${action}`)
            .setTitle(action === "deposit" ? "📥 GỬI TIỀN" : "📤 RÚT TIỀN");

        const input = new TextInputBuilder()
            .setCustomId("amount_input")
            .setLabel("Số tiền hoặc nhập 'all'")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ví dụ: 100000 hoặc all")
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    },

    // ================= XỬ LÝ MODAL =================
    async handleModal(interaction) {
        // ID: nganhang_modal_deposit -> action là index 2
        const action = interaction.customId.split("_")[2];
        let val = interaction.fields.getTextInputValue("amount_input").toLowerCase();
        let user = await User.findOne({ userId: interaction.user.id });

        let amount = 0;
        if (val === "all") {
            amount = action === "deposit" ? user.money : user.bankMoney;
        } else {
            amount = parseInt(val);
        }

        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({ content: "❌ Số tiền không hợp lệ!", flags: 64 });
        }

        // --- LOGIC GỬI TIỀN ---
        if (action === "deposit") {
            if (user.money < amount) return interaction.reply({ content: "❌ Bạn không đủ tiền mặt!", flags: 64 });
            
            // Chốt lãi cũ nếu có trước khi nạp thêm
            if (user.bankMoney > 0 && user.lastDepositAt) {
                const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / (1000 * 60 * 60);
                if (hours >= 1) {
                    const interest = Math.floor(user.bankMoney * (Math.pow(1.003, Math.floor(hours)) - 1));
                    user.bankMoney += interest;
                }
            }

            user.money -= amount;
            user.bankMoney += amount;
            user.lastDepositAt = new Date(); // Reset mốc thời gian gửi
            await user.save();

            return interaction.reply({ content: `✅ Đã gửi **${amount.toLocaleString()} VND** vào ngân hàng!`, flags: 64 });
        }

        // --- LOGIC RÚT TIỀN ---
        if (action === "withdraw") {
            if (user.bankMoney < amount) return interaction.reply({ content: "❌ Ngân hàng không đủ tiền!", flags: 64 });

            // Tính lãi tại thời điểm rút
            let interest = 0;
            const hours = (Date.now() - new Date(user.lastDepositAt).getTime()) / (1000 * 60 * 60);
            if (hours >= 1) {
                interest = Math.floor(user.bankMoney * (Math.pow(1.003, Math.floor(hours)) - 1));
            }

            const isAll = (amount >= user.bankMoney);
            
            user.bankMoney -= amount;
            // Nếu rút hết thì cộng luôn lãi vào tiền mặt, nếu rút một phần thì chốt lãi vào gốc bank
            if (isAll) {
                user.money += (amount + interest);
                user.lastDepositAt = null;
            } else {
                user.money += amount;
                user.bankMoney += interest;
                user.lastDepositAt = new Date();
            }

            await user.save();

            let msg = `✅ Đã rút **${amount.toLocaleString()} VND** về ví tiền mặt!`;
            if (interest > 0) msg += `\n🎁 Bạn nhận được **${interest.toLocaleString()} VND** tiền lãi tích lũy!`;
            
            return interaction.reply({ content: msg, flags: 64 });
        }
    }
};
