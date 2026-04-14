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

const games = new Map(); // messageId -> game data

const EMOJIS = {
    nai: "🦌",
    bau: "🎃",
    ga: "🐔",
    ca: "🐟",
    cua: "🦀",
    tom: "🦐",
};

const FACES = Object.keys(EMOJIS);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baucua")
        .setDescription("🎲 Sòng Bầu Cua Quý Tộc - Giao diện VIP & Tỉ lệ 50/50"),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        if (user.banned) {
            return interaction.reply({
                content: "⛔ Bạn đã bị cấm khỏi sòng bài do vi phạm chính sách!",
                flags: 64,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("🌟 SÒNG BẦU CUA THƯỢNG LƯU 🌟")
            .setDescription(
                "```fix\n💎 CHÀO MỪNG CÁC ĐẠI GIA ĐẾN VỚI CASINO 💎\n```\n" +
                "👉 **Luật chơi:** Chọn linh vật để đặt cược. Ăn gấp đôi nếu trúng 1 mặt, gấp ba nếu trúng 2 mặt!\n\n" +
                "⏳ Nhà cái sẽ xóc sau **30 giây**..."
            )
            .setFooter({ text: "💰 Chúc các đại gia hên xui may mắn!" })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("baucua_nai").setLabel("🦌 Nai").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("baucua_bau").setLabel("🎃 Bầu").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("baucua_ga").setLabel("🐔 Gà").setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("baucua_ca").setLabel("🐟 Cá").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("baucua_cua").setLabel("🦀 Cua").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("baucua_tom").setLabel("🦐 Tôm").setStyle(ButtonStyle.Success)
        );

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            fetchReply: true,
        });

        games.set(msg.id, {
            bets: new Map(), // userId -> { face, amount }
            endsAt: Date.now() + 30000,
        });

        // ⏳ Xử lý sau 30 giây
        setTimeout(async () => {
            const game = games.get(msg.id);
            if (!game) return;

            let rolls = [];
            const betFaces = Array.from(new Set(Array.from(game.bets.values()).map(b => b.face)));

            // 🎲 LOGIC 50/50 VIP
            if (betFaces.length === 0) {
                rolls = Array.from({ length: 3 }, () => FACES[Math.floor(Math.random() * FACES.length)]);
            } else {
                const isWin = Math.random() < 0.50; // 50% thắng hoặc thua
                if (isWin) {
                    const winningFace = betFaces[Math.floor(Math.random() * betFaces.length)];
                    rolls.push(winningFace); 
                    rolls.push(FACES[Math.floor(Math.random() * 6)]);
                    rolls.push(FACES[Math.floor(Math.random() * 6)]);
                } else {
                    const loseFaces = FACES.filter(f => !betFaces.includes(f));
                    rolls = Array.from({ length: 3 }, () => loseFaces[Math.floor(Math.random() * loseFaces.length)]);
                }
            }
            rolls.sort(() => Math.random() - 0.5);

            let winners = [];
            let losers = [];

            for (const [userId, bet] of game.bets.entries()) {
                const uData = await User.findOne({ userId });
                if (!uData) continue;

                let usedBuffs = [];
                const matchCount = rolls.filter(r => r === bet.face).length;

                if (matchCount > 0) {
                    // --- LOGIC THẮNG ---
                    if (uData.buffs?.winRateBoost > 0) {
                        usedBuffs.push(`🍀 Luck ${uData.buffs.winRateBoost * 100}%`);
                        uData.buffs.winRateBoost = 0;
                    }
                    const profit = bet.amount * matchCount;
                    const totalReturn = bet.amount + profit;
                    
                    uData.money += totalReturn;
                    uData.stats.win++;
                    winners.push(`✅ <@${userId}> +**${profit.toLocaleString()}** (x${matchCount} ${EMOJIS[bet.face]})${usedBuffs.length ? ` [${usedBuffs.join(", ")}]` : ""}`);
                } else {
                    // --- LOGIC THUA ---
                    let lostAmt = bet.amount;
                    if (uData.buffs?.shield > 0) {
                        const refund = Math.floor(bet.amount * uData.buffs.shield);
                        uData.money += refund;
                        lostAmt -= refund;
                        usedBuffs.push(`🔰 Khiên ${uData.buffs.shield * 100}%`);
                        uData.buffs.shield = 0;
                    }
                    if (uData.buffs?.winRateBoost > 0) {
                        usedBuffs.push(`🍀 Luck ${uData.buffs.winRateBoost * 100}%`);
                        uData.buffs.winRateBoost = 0;
                    }
                    uData.stats.lose++;
                    losers.push(`❌ <@${userId}> -**${lostAmt.toLocaleString()}** (${EMOJIS[bet.face]})${usedBuffs.length ? ` [${usedBuffs.join(", ")}]` : ""}`);
                }
                uData.stats.gamblePlayed++;
                await uData.save();
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(0xffd
 
