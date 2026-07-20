const { SlashCommandBuilder } = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, countdown, casinoEmbed, sleep } = require("../utils/ui");

const COOLDOWN = 2 * 60 * 60 * 1000; // 2 tiếng (giữ nguyên)

const SNEAK_FLAVOR = [
    "🌙 Đêm khuya thanh vắng... bạn đeo bao tay, trèo qua hàng rào...",
    "🔦 Bạn lẻn qua cửa sổ, camera quay đi chỗ khác đúng lúc...",
    "🐕 Suýt bị chó nhà nó phát hiện, may mà có cục xương phòng thân...",
    "🥷 Bạn nín thở bò qua phòng khách như ninja chính hiệu...",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antrom")
        .setDescription("🕵️ Lẻn vào nhà và hack luôn tài khoản ngân hàng của người khác")
        .addUserOption((opt) =>
            opt.setName("target").setDescription("Đối tượng xui xẻo bạn muốn nhắm tới").setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("target");

        // 1. Chặn tự trộm & trộm bot
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "❌ Bạn định tự móc túi chính mình à? Đừng ngáo thế chứ!", flags: 64 });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: "🤖 Trộm nhà bot à? Nhà nó toàn dây điện thôi, không có gì đâu!", flags: 64 });
        }

        const thief = await User.findOne({ userId: interaction.user.id });
        const victim = await User.findOne({ userId: targetUser.id });

        // 🐛 FIX: kiểm tra null TRƯỚC khi đọc dữ liệu (bản cũ crash nếu nạn nhân chưa có tài khoản)
        if (!thief) {
            return interaction.reply({ content: "❌ Bạn chưa có tài khoản! Dùng /daily để khởi tạo đã.", flags: 64 });
        }
        if (!victim) {
            return interaction.reply({ content: "🤷 Người này chưa từng chơi casino — nhà trống hoác, trộm gì bây giờ!", flags: 64 });
        }
        if (thief.banned) return interaction.reply({ content: "🚫 Bạn đang bị giam, trộm cắp gì nữa!", flags: 64 });

        // 🐛 FIX: model lưu là bankMoney, bản cũ đọc victim.bank nên hack bank luôn = 0
        const victimBank = victim.bankMoney || 0;
        const victimTotalWealth = victim.money + victimBank;

        // 2. Nạn nhân phải có tổng tiền > 5k (giữ nguyên)
        if (victimTotalWealth < 5000) {
            return interaction.reply({ content: "🤌 Đối tượng này quá nghèo, tổng tài sản không có nổi 5k. Bỏ qua đi!", flags: 64 });
        }

        // 3. Cooldown 2h — đếm ngược trực tiếp
        const lastThief = thief.lastThief || 0;
        if (Date.now() - lastThief < COOLDOWN) {
            const readyAt = lastThief + COOLDOWN;
            return interaction.reply({
                content: `🚨 **Cảnh sát đang tuần tra gắt gao!** Bạn đang trong danh sách đen.\n⏳ Nằm vùng thêm, hành nghề lại được ${countdown(readyAt)}`,
                flags: 64,
            });
        }

        // 4. Tỉ lệ thành công theo bảo vệ (giữ nguyên)
        let winChance = 0.35;
        const security = victim.securityLevel || 0;
        if (security === 3) winChance -= 0.30;
        else if (security === 2) winChance -= 0.20;
        else if (security === 1) winChance -= 0.10;
        if (winChance < 0.05) winChance = 0.05;

        const isSuccess = Math.random() < winChance;
        thief.lastThief = Date.now();

        const guardNames = ["không có ai canh", "💂 Cận Vệ Tập Sự", "🎖️ lính gác chuyên nghiệp", "🛡️ Đặc Nhiệm Hoàng Gia"];

        // 🎬 MÀN 1: LÊN KẾ HOẠCH
        await interaction.reply({
            embeds: [casinoEmbed({ color: COLORS.dark, title: "🗺️ PHI VỤ THẾ KỶ — GIAI ĐOẠN TRINH SÁT" })
                .setDescription(
                    `> 🎯 Mục tiêu: **${targetUser.username}**\n` +
                    `> 💰 Tài sản ước tính: *"khá là dày ví"*\n` +
                    `> 🛡️ An ninh: **${guardNames[security]}** (tỉ lệ thành công ~${Math.round(winChance * 100)}%)\n\n` +
                    `*Đang chờ trời tối...*`
                )],
        });
        await sleep(1800);

        // 🎬 MÀN 2: ĐỘT NHẬP
        await interaction.editReply({
            embeds: [casinoEmbed({ color: COLORS.purple, title: "🥷 ĐANG ĐỘT NHẬP..." })
                .setDescription(`> ${SNEAK_FLAVOR[Math.floor(Math.random() * SNEAK_FLAVOR.length)]}\n\n*Tim đập chân run...*`)],
        });
        await sleep(1800);

        // 🎬 MÀN 3: KẾT QUẢ
        if (isSuccess) {
            // Cuỗm 5-12% tiền mặt + hack 2-8% bank (giữ nguyên tỉ lệ)
            const stolenWallet = Math.floor(victim.money * (Math.random() * (0.12 - 0.05) + 0.05));
            const stolenBank = Math.floor(victimBank * (Math.random() * (0.08 - 0.02) + 0.02));
            const totalStolen = stolenWallet + stolenBank;

            victim.money -= stolenWallet;
            victim.bankMoney = victimBank - stolenBank; // 🐛 FIX: giờ trừ đúng field
            thief.money += totalStolen;

            await victim.save();S
            await thief.save();

            await interaction.editReply({
                embeds: [casinoEmbed({ color: COLORS.green, title: "🥷 PHI VỤ THÀNH CÔNG RỰC RỠ! 🥷" })
                    .setThumbnail("https://i.pinimg.com/736x/6b/0d/ac/6b0dac51c8700766a8146361bb4a84b7.jpg")
                    .setDescription(
                        `\`\`\`\n  🏠💨 🥷💰 (chuồn êm)\n\`\`\`` +
                        `Bạn đã lẻn vào nhà và hack luôn SmartBanking của <@${targetUser.id}>!`
                    )
                    .addFields(
                        { name: "💵 Móc ví", value: `\`+${money(stolenWallet)}\``, inline: true },
                        { name: "💳 Hack bank", value: `\`+${money(stolenBank)}\``, inline: true },
                        { name: "💰 Tổng thu hoạch", value: `**\`+${money(totalStolen)} VND\`**`, inline: true },
                        { name: "🏦 Ví của bạn giờ", value: vnd(thief.money), inline: false }
                    )
                    .setFooter({ text: "Mau chuồn lẹ trước khi chủ nhà check thông báo ngân hàng! 🏃💨" })],
            });
        } else {
            // Bị bắt: phạt 50-100k (giữ nguyên)
            const fine = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
            thief.money -= fine;
            await thief.save();

            await interaction.editReply({
                embeds: [casinoEmbed({ color: COLORS.red, title: "🚔 TÓM GỌN! BẠN ĐÃ BỊ CÔNG AN BẮT!" })
                    .setThumbnail("https://www.thanglongwaterpuppet.org/wp-content/uploads/2025/10/1_chu-ao-xanh-xuat-hien-trong-meme-khien-tinh-huong-nho-nhat-tro-nen-vui-nhon.jpg")
                    .setDescription(
                        `\`\`\`\n  🚨👮 🥷⛓️ (còng số 8)\n\`\`\`` +
                        `Đen thôi đỏ quên đi! <@${targetUser.id}> đã mai phục sẵn và tóm sống bạn giao cho đồn.`
                    )
                    .addFields(
                        { name: "💸 Tiền phạt", value: `\`-${money(fine)}\``, inline: true },
                        { name: "📉 Ví hiện tại", value: `\`${money(thief.money)}\` ${thief.money < 0 ? "**(NỢ 💸)**" : ""}`, inline: true },
                        { name: "⏳ Hành nghề lại", value: countdown(thief.lastThief + COOLDOWN), inline: true }
                    )
                    .setFooter({ text: "Lao động là vinh quang, hãy /work để trả nợ nhé! 👷" })],
            });
        }
    },
};