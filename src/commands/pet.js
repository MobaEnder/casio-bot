const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const User = require("../models/User");
const { COLORS, money, vnd, bar, casinoEmbed, safeEdit, sleep } = require("../utils/ui");
const {
    SPECIES, RARITY_INFO, EGGS, FOODS, MAX_PETS, MAX_LEVEL, EVOLVE_LEVELS,
    expNeeded, stageOf, hatchEgg, petStats, petPower, petDisplay, emojiToImage,
} = require("../utils/petData");
const PetBattle = require("../utils/petBattle");

// ================== VẼ CHI TIẾT 1 PET ==================
function petDetailEmbed(pet, ownerName, extraLine = "") {
    const d = petDisplay(pet);
    const s = petStats(pet);
    const stage = stageOf(pet.level);
    const nextEvo = EVOLVE_LEVELS.find((lv) => lv > pet.level);
    const sp = SPECIES[pet.species];
    const need = expNeeded(pet.level);

    return casinoEmbed({ color: sp.rarity === "E" ? COLORS.gold : sp.rarity === "R" ? COLORS.blue : COLORS.green, title: `${d.emoji} ${d.name.toUpperCase()} — Lv.${pet.level}` })
        .setThumbnail(d.image)
        .setDescription(
            (extraLine ? `${extraLine}\n${"─".repeat(25)}\n` : "") +
            `> 🏷️ Dạng: **${d.formName}** (tiến hóa ${stage + 1}/5) • ${d.rarity}\n` +
            `> 🧬 Tố chất (IV): **${Math.round(pet.iv * 100)}%**\n` +
            `> ⚡ **Lực chiến: \`${money(petPower(pet))}\`**\n\n` +
            `💠 **EXP:** \`${pet.exp}/${need}\`\n${bar(pet.exp / need, 12, "🟩", "⬛")}\n` +
            (nextEvo
                ? `🧬 Tiến hóa tiếp theo: **Lv.${nextEvo}** → ${sp.stages[EVOLVE_LEVELS.indexOf(nextEvo) + 1].emoji} **${sp.stages[EVOLVE_LEVELS.indexOf(nextEvo) + 1].name}**`
                : `👑 **ĐÃ ĐẠT DẠNG TỐI THƯỢNG!**`)
        )
        .addFields(
            { name: "❤️ HP", value: `\`${s.hp}\``, inline: true },
            { name: "⚔️ ATK", value: `\`${s.atk}\``, inline: true },
            { name: "🛡️ DEF", value: `\`${s.def}\``, inline: true },
            { name: "💨 SPD", value: `\`${s.spd}\``, inline: true },
            { name: "🏆 Thắng", value: `\`${pet.wins || 0}\``, inline: true },
            { name: "💀 Thua", value: `\`${pet.losses || 0}\``, inline: true }
        )
        .setFooter({ text: `Chủ nhân: ${ownerName} • Cho ăn để lên cấp và tiến hóa!` });
}

function feedButtons(petId, user) {
    const f = user.petFood || {};
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pet_feed_${petId}_banhquy`).setLabel(`Bánh Quy (${f.banhquy || 0})`).setEmoji("🍪").setStyle(ButtonStyle.Secondary).setDisabled(!(f.banhquy > 0)),
        new ButtonBuilder().setCustomId(`pet_feed_${petId}_thit`).setLabel(`Thịt (${f.thit || 0})`).setEmoji("🍖").setStyle(ButtonStyle.Primary).setDisabled(!(f.thit > 0)),
        new ButtonBuilder().setCustomId(`pet_feed_${petId}_daitiec`).setLabel(`Đại Tiệc (${f.daitiec || 0})`).setEmoji("🍱").setStyle(ButtonStyle.Success).setDisabled(!(f.daitiec > 0)),
        new ButtonBuilder().setCustomId(`pet_release_${petId}`).setLabel("Thả").setEmoji("🕊️").setStyle(ButtonStyle.Danger)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pet")
        .setDescription("🐾 Hệ thống thú cưng: nở trứng, nuôi, tiến hóa, PvP!")
        .addSubcommand((sc) => sc.setName("shop").setDescription("🏪 Mua trứng & thức ăn"))
        .addSubcommand((sc) => sc.setName("tui").setDescription("🎒 Xem túi pet & kho thức ăn"))
        .addSubcommand((sc) =>
            sc.setName("pvp").setDescription("⚔️ Đấu pet với người khác (1v1 → 3v3)")
                .addIntegerOption((o) => o.setName("tiencuoc").setDescription("Tiền cược").setRequired(true).setMinValue(1000))
                .addIntegerOption((o) => o.setName("doihinh").setDescription("Số pet mỗi bên (1-3)").setRequired(true).setMinValue(1).setMaxValue(3))
                .addUserOption((o) => o.setName("doithu").setDescription("Tag người thách đấu (để trống = kèo mở)"))
        )
        .addSubcommand((sc) =>
            sc.setName("doiten").setDescription("✏️ Đặt biệt danh cho pet")
                .addIntegerOption((o) => o.setName("so").setDescription("Số thứ tự pet trong túi").setRequired(true).setMinValue(1).setMaxValue(6))
                .addStringOption((o) => o.setName("ten").setDescription("Tên mới (tối đa 20 ký tự)").setRequired(true).setMaxLength(20))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        // ================== 🏪 SHOP ==================
        if (sub === "shop") {
            const embed = casinoEmbed({ color: COLORS.purple, title: "🏪 ✦ TIỆM THÚ CƯNG DIỆU KỲ ✦ 🐾" })
                .setThumbnail(emojiToImage("🥚"))
                .setDescription(
                    `> 💼 Ví: **\`${money(user.money)} VND\`** • 🎒 Pet: **${(user.pets || []).length}/${MAX_PETS}**\n${"─".repeat(25)}\n` +
                    `**🥚 TRỨNG PET** *(mua là nở ngay, ra loài ngẫu nhiên!)*\n` +
                    Object.entries(EGGS).map(([k, e]) =>
                        `> ${e.name} — \`${money(e.price)}\`\n>  ⚪${e.weights.C}% 🔵${e.weights.R}% 🌈${e.weights.E}%`
                    ).join("\n") +
                    `\n\n**🍖 THỨC ĂN** *(cho pet ăn để lên cấp)*\n` +
                    Object.entries(FOODS).map(([k, f]) => `> ${f.name} — \`${money(f.price)}\` (+${f.exp} EXP)`).join("\n")
                )
                .setFooter({ text: "🧬 Tiến hóa tại Lv.30 / 60 / 90 / 120 — thay hình đổi dạng!" });

            const eggRow = new ActionRowBuilder().addComponents(
                ...Object.entries(EGGS).map(([k, e]) =>
                    new ButtonBuilder().setCustomId(`pet_egg_${k}`).setLabel(e.name.replace(/^\S+ /, "")).setEmoji(e.name.split(" ")[0]).setStyle(k === "huyenthoai" ? ButtonStyle.Danger : k === "vang" ? ButtonStyle.Primary : ButtonStyle.Secondary)
                )
            );
            const foodRow = new ActionRowBuilder().addComponents(
                ...Object.entries(FOODS).map(([k, f]) =>
                    new ButtonBuilder().setCustomId(`pet_food_${k}`).setLabel(f.name.replace(/^\S+ /, "")).setEmoji(f.name.split(" ")[0]).setStyle(ButtonStyle.Success)
                )
            );
            return interaction.reply({ embeds: [embed], components: [eggRow, foodRow] });
        }

        // ================== 🎒 TÚI PET ==================
        if (sub === "tui") {
            const pets = user.pets || [];
            if (pets.length === 0) {
                return interaction.reply({ content: "🎒 Túi pet trống trơn! Ghé `/pet shop` mua trứng nở bé đầu tiên nào 🥚", flags: 64 });
            }

            const f = user.petFood || {};
            const list = pets.map((p, i) => {
                const d = petDisplay(p);
                return `\`${i + 1}.\` ${d.emoji} **${d.name}** — Lv.${p.level} • ${d.rarity} • ⚡\`${money(petPower(p))}\``;
            }).join("\n");

            const embed = casinoEmbed({ color: COLORS.cyan, title: `🎒 CHUỒNG PET CỦA ${interaction.user.username.toUpperCase()}` })
                .setThumbnail(petDisplay(pets[0]).image)
                .setDescription(
                    `${list}\n${"─".repeat(25)}\n` +
                    `🍱 **Kho thức ăn:** 🍪 ${f.banhquy || 0} • 🍖 ${f.thit || 0} • 🍱 ${f.daitiec || 0}\n` +
                    `👇 *Chọn pet để xem chi tiết & cho ăn*`
                );

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("pet_view")
                    .setPlaceholder("🐾 Chọn pet để chăm sóc...")
                    .addOptions(pets.map((p, i) => {
                        const d = petDisplay(p);
                        return { label: `${d.name} — Lv.${p.level}`.slice(0, 100), value: p.id, emoji: d.emoji.length <= 4 ? d.emoji : "🐾" };
                    }))
            );
            return interaction.reply({ embeds: [embed], components: [menu], flags: 64 });
        }

        // ================== ✏️ ĐỔI TÊN ==================
        if (sub === "doiten") {
            const idx = interaction.options.getInteger("so") - 1;
            const name = interaction.options.getString("ten").trim();
            const pets = user.pets || [];
            if (!pets[idx]) return interaction.reply({ content: `❌ Không có pet số ${idx + 1} trong túi!`, flags: 64 });

            pets[idx].nickname = name;
            user.markModified("pets");
            await user.save();
            const d = petDisplay(pets[idx]);
            return interaction.reply({ content: `✏️ Đã đặt tên cho ${d.emoji} bé là **${name}**! Cưng hết nấc 🥰`, flags: 64 });
        }

        // ================== ⚔️ PVP ==================
        if (sub === "pvp") {
            return PetBattle.createLobby(interaction, user);
        }
    },

    // ================== NÚT BẤM ==================
    async handleButton(interaction) {
        const parts = interaction.customId.split("_");
        const action = parts[1];

        // PvP giao cho module riêng
        if (["pvpjoin", "pvppick"].includes(action)) return PetBattle.handleButton(interaction);

        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = await User.create({ userId: interaction.user.id });

        // --- 🥚 MUA TRỨNG & NỞ ---
        if (action === "egg") {
            const eggType = parts[2];
            const egg = EGGS[eggType];
            if (!egg) return;

            if ((user.pets || []).length >= MAX_PETS) {
                return interaction.reply({ content: `❌ Chuồng đã đầy ${MAX_PETS} bé! Thả bớt (trong /pet tui) rồi mua tiếp.`, flags: 64 });
            }
            if (user.money < egg.price) {
                return interaction.reply({ content: `❌ Cần ${vnd(egg.price)} để mua ${egg.name}! Ví còn ${vnd(user.money)}.`, flags: 64 });
            }

            user.money -= egg.price;
            const newPet = hatchEgg(eggType);
            if (!user.pets) user.pets = [];
            user.pets.push(newPet);
            user.markModified("pets");
            await user.save();

            // 🎬 ANIMATION NỞ TRỨNG
            await interaction.reply({
                embeds: [casinoEmbed({ color: COLORS.orange, title: "🥚 TRỨNG ĐANG NỞ..." })
                    .setThumbnail(emojiToImage("🥚"))
                    .setDescription(`> 🥚 *lắc... lắc...*\n> 💸 Đã trừ ${vnd(egg.price)}`)],
            });
            await sleep(1300);
            await safeEdit(interaction, {
                embeds: [casinoEmbed({ color: COLORS.orange, title: "🐣 RẠN VỎ RỒI...!" })
                    .setThumbnail(emojiToImage("🐣"))
                    .setDescription(`> 🐣 *tách... tách... có gì đó chui ra!*`)],
            });
            await sleep(1300);

            const d = petDisplay(newPet);
            const sp = SPECIES[newPet.species];
            await safeEdit(interaction, {
                embeds: [casinoEmbed({
                    color: sp.rarity === "E" ? COLORS.gold : sp.rarity === "R" ? COLORS.blue : COLORS.green,
                    title: `${sp.rarity === "E" ? "🌈✨" : sp.rarity === "R" ? "🔵" : "⚪"} NỞ RA: ${d.formName.toUpperCase()}!`,
                })
                    .setThumbnail(d.image)
                    .setDescription(
                        `# ${d.emoji}\n` +
                        `> 🏷️ Loài: **${sp.baseName}** • ${RARITY_INFO[sp.rarity].label}\n` +
                        `> 🧬 Tố chất (IV): **${Math.round(newPet.iv * 100)}%** ${newPet.iv >= 1.1 ? "🔥 CỰC PHẨM!" : newPet.iv >= 1.0 ? "✨ Tốt" : ""}\n` +
                        `> ⚡ Lực chiến khởi điểm: \`${money(petPower(newPet))}\`\n\n` +
                        `🧬 Chuỗi tiến hóa: ${sp.stages.map((s) => s.emoji).join(" → ")}\n` +
                        `💼 Ví còn: ${vnd(user.money)}`
                    )
                    .setFooter({ text: "🍖 Mua thức ăn ở /pet shop rồi vào /pet tui cho bé ăn lên cấp!" })],
            });
            return;
        }

        // --- 🍖 MUA THỨC ĂN ---
        if (action === "food") {
            const foodType = parts[2];
            const food = FOODS[foodType];
            if (!food) return;
            if (user.money < food.price) return interaction.reply({ content: `❌ Cần ${vnd(food.price)}! Ví còn ${vnd(user.money)}.`, flags: 64 });

            user.money -= food.price;
            if (!user.petFood) user.petFood = {};
            user.petFood[foodType] = (user.petFood[foodType] || 0) + 1;
            user.markModified("petFood");
            await user.save();

            return interaction.reply({
                content: `✅ Đã mua **${food.name}** (+${food.exp} EXP khi cho ăn)!\n🍱 Kho: 🍪 ${user.petFood.banhquy || 0} • 🍖 ${user.petFood.thit || 0} • 🍱 ${user.petFood.daitiec || 0} • 💼 Ví: ${vnd(user.money)}`,
                flags: 64,
            });
        }

        // --- 🍽️ CHO ĂN (từ màn chi tiết pet) ---
        if (action === "feed") {
            await interaction.deferUpdate();
            const petId = parts[2];
            const foodType = parts[3];
            const food = FOODS[foodType];
            const pet = (user.pets || []).find((p) => p.id === petId);
            if (!pet || !food) return;
            if (!(user.petFood?.[foodType] > 0)) return interaction.followUp({ content: "❌ Hết loại thức ăn này! Mua thêm ở /pet shop.", flags: 64 });
            if (pet.level >= MAX_LEVEL) return interaction.followUp({ content: "👑 Bé đã đạt cấp tối đa 120, no rồi không ăn nữa!", flags: 64 });

            user.petFood[foodType] -= 1;
            user.markModified("petFood");

            const oldStage = stageOf(pet.level);
            pet.exp += food.exp;
            let levelsGained = 0;
            while (pet.exp >= expNeeded(pet.level) && pet.level < MAX_LEVEL) {
                pet.exp -= expNeeded(pet.level);
                pet.level += 1;
                levelsGained++;
            }
            if (pet.level >= MAX_LEVEL) pet.exp = 0;
            const newStage = stageOf(pet.level);
            user.markModified("pets");
            await user.save();

            let statusLine = `🍽️ Măm măm **${food.name}** (+${food.exp} EXP)${levelsGained > 0 ? ` → **LÊN ${levelsGained} CẤP!** 🎉` : ""}`;

            // 🧬 TIẾN HÓA!
            if (newStage > oldStage) {
                const sp = SPECIES[pet.species];
                const newForm = sp.stages[newStage];
                await interaction.editReply({
                    embeds: [casinoEmbed({ color: COLORS.gold, title: "🧬✨ TIẾN HÓAAAA!!! ✨🧬" })
                        .setThumbnail(emojiToImage(newForm.emoji))
                        .setDescription(
                            `# ${sp.stages[oldStage].emoji} ➜ ${newForm.emoji}\n` +
                            `> 🎊 **${sp.stages[oldStage].name}** đã tiến hóa thành **${newForm.name}**!\n` +
                            `> 📈 Toàn bộ chỉ số **x1.25** • Lực chiến mới: \`${money(petPower(pet))}\``
                        )],
                    components: [],
                });
                await sleep(2500);
                statusLine = `🧬 Vừa tiến hóa thành **${newForm.name}**! Mạnh vượt bậc!`;
            }

            return interaction.editReply({
                embeds: [petDetailEmbed(pet, interaction.user.username, statusLine)],
                components: [feedButtons(pet.id, user)],
            });
        }

        // --- 🕊️ THẢ PET ---
        if (action === "release") {
            await interaction.deferUpdate();
            const petId = parts[2];
            const idx = (user.pets || []).findIndex((p) => p.id === petId);
            if (idx === -1) return;
            const d = petDisplay(user.pets[idx]);
            user.pets.splice(idx, 1);
            user.markModified("pets");
            await user.save();
            return interaction.editReply({
                embeds: [casinoEmbed({ color: COLORS.dark, title: "🕊️ TẠM BIỆT NGƯỜI BẠN NHỎ..." })
                    .setThumbnail(d.image)
                    .setDescription(`> ${d.emoji} **${d.name}** đã được thả về thiên nhiên.\n> *"Hẹn gặp lại ở một kiếp pet khác..."* 😢`)],
                components: [],
            });
        }
    },

    // ================== MENU CHỌN PET ==================
    async handleMenu(interaction) {
        if (interaction.customId === "pet_view") {
            await interaction.deferUpdate();
            const user = await User.findOne({ userId: interaction.user.id });
            const pet = (user?.pets || []).find((p) => p.id === interaction.values[0]);
            if (!pet) return;
            return interaction.editReply({
                embeds: [petDetailEmbed(pet, interaction.user.username)],
                components: [feedButtons(pet.id, user)],
            });
        }
        if (interaction.customId.startsWith("pet_pvppick")) return PetBattle.handleMenu(interaction);
    },
};