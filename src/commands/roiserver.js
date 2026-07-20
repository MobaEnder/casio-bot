const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const { COLORS, casinoEmbed } = require("../utils/ui");

// Lấy danh sách ID admin từ file .env (giống setmoney.js)
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roiserver")
        .setDescription("🚪 [ADMIN] Bot rời khỏi TẤT CẢ server, trừ server có ID được nhập")
        .addStringOption((opt) =>
            opt.setName("giulai")
                .setDescription("ID của server DUY NHẤT muốn bot ở lại")
                .setRequired(true)
        ),

    async execute(interaction) {
        // 1. CHỈ ADMIN ĐƯỢC DÙNG
        if (!adminIds.includes(interaction.user.id)) {
            return interaction.reply({ content: "⛔ Lệnh này chỉ dành cho chủ bot!", flags: 64 });
        }

        const keepId = interaction.options.getString("giulai").trim();

        // 2. KIỂM TRA ID HỢP LỆ
        if (!/^\d{17,20}$/.test(keepId)) {
            return interaction.reply({ content: "❌ ID server không hợp lệ! ID Discord là dãy 17-20 chữ số.", flags: 64 });
        }

        const keepGuild = interaction.client.guilds.cache.get(keepId);
        if (!keepGuild) {
            return interaction.reply({
                content: `❌ Bot **không có mặt** trong server có ID \`${keepId}\`!\nKiểm tra lại ID kẻo bot rời nhầm hết server đấy. Dùng ID của server hiện tại: \`${interaction.guildId}\``,
                flags: 64,
            });
        }

        // 3. LIỆT KÊ CÁC SERVER SẼ RỜI
        const guildsToLeave = interaction.client.guilds.cache.filter((g) => g.id !== keepId);

        if (guildsToLeave.size === 0) {
            return interaction.reply({
                content: `✅ Bot hiện chỉ ở duy nhất server **${keepGuild.name}** — không có gì để rời!`,
                flags: 64,
            });
        }

        const listPreview = guildsToLeave
            .map((g) => `> 🚪 **${g.name}** — \`${g.id}\` (${g.memberCount ?? "?"} thành viên)`)
            .slice(0, 15)
            .join("\n");

        // 4. XÁC NHẬN 2 BƯỚC (tránh bấm nhầm thảm họa)
        const confirmEmbed = casinoEmbed({ color: COLORS.red, title: "⚠️ XÁC NHẬN RỜI SERVER HÀNG LOẠT" })
            .setDescription(
                `Bot sẽ **Ở LẠI**: ✅ **${keepGuild.name}** (\`${keepId}\`)\n\n` +
                `Bot sẽ **RỜI KHỎI ${guildsToLeave.size} server** sau:\n${listPreview}` +
                (guildsToLeave.size > 15 ? `\n> *...và ${guildsToLeave.size - 15} server khác*` : "") +
                `\n\n🔴 **Hành động này KHÔNG thể hoàn tác** (muốn quay lại phải mời bot thủ công từng server). Bạn có chắc chắn?`
            )
            .setFooter({ text: "⏰ Tự hủy sau 30 giây nếu không xác nhận" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("roiserver_confirm").setLabel("XÁC NHẬN RỜI HẾT").setEmoji("🚪").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("roiserver_cancel").setLabel("Hủy bỏ").setEmoji("↩️").setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [confirmEmbed], components: [row], flags: 64 });
        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            componentType: ComponentType.Button,
            time: 30000,
            max: 1,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "roiserver_cancel") {
                return i.update({
                    embeds: [casinoEmbed({ color: COLORS.green, title: "↩️ ĐÃ HỦY", description: "Bot vẫn ở nguyên tất cả server." })],
                    components: [],
                });
            }

            // 5. TIẾN HÀNH RỜI TỪNG SERVER
            await i.update({
                embeds: [casinoEmbed({ color: COLORS.orange, title: "🚪 ĐANG RỜI SERVER...", description: `Đang xử lý **${guildsToLeave.size}** server, vui lòng đợi...` })],
                components: [],
            });

            let leftCount = 0;
            let failed = [];

            for (const guild of guildsToLeave.values()) {
                try {
                    await guild.leave();
                    leftCount++;
                    console.log(`🚪 [roiserver] Đã rời: ${guild.name} (${guild.id})`);
                } catch (err) {
                    failed.push(`${guild.name} (\`${guild.id}\`)`);
                    console.error(`❌ [roiserver] Không rời được ${guild.name}:`, err.message);
                }
                // Nghỉ 1 giây giữa mỗi lần rời để tránh rate-limit của Discord
                await new Promise((r) => setTimeout(r, 1000));
            }

            // 6. BÁO CÁO KẾT QUẢ
            const resultEmbed = casinoEmbed({
                color: failed.length === 0 ? COLORS.green : COLORS.orange,
                title: "✅ HOÀN TẤT DỌN DẸP SERVER",
            }).setDescription(
                `🚪 Đã rời thành công: **${leftCount}/${guildsToLeave.size}** server\n` +
                `🏠 Bot hiện chỉ còn ở: **${keepGuild.name}**\n` +
                (failed.length ? `\n⚠️ **Rời thất bại (${failed.length}):**\n${failed.map((f) => `> ${f}`).join("\n")}` : "")
            );

            await interaction.editReply({ embeds: [resultEmbed], components: [] }).catch(() => {});
        });

        collector.on("end", async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({
                    embeds: [casinoEmbed({ color: COLORS.dark, title: "⏰ HẾT THỜI GIAN XÁC NHẬN", description: "Lệnh đã tự hủy. Bot vẫn ở nguyên tất cả server." })],
                    components: [],
                }).catch(() => {});
            }
        });
    },
};