const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  SlashCommandBuilder, 
  Routes 
} = require("discord.js");

const { REST } = require("@discordjs/rest");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

const TOKEN = "BOT_TOKEN";
const CLIENT_ID = "CLIENT_ID";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

//////////////////////////////
// ===== PET SYSTEM ===== //
//////////////////////////////

const PET_TYPES = {
  fire: {
    name: "🔥 Fire",
    buff: "+10% ATK | 5% Crit"
  },
  water: {
    name: "💧 Water",
    buff: "+15% HP | +10% DEF"
  },
  electric: {
    name: "⚡ Electric",
    buff: "+15% SPD | 10% Dodge"
  }
};

function getLevel(exp) {
  return Math.floor(exp / 1000) + 1;
}

function expBar(exp) {
  const current = exp % 1000;
  const percent = Math.floor((current / 1000) * 10);
  return "█".repeat(percent) + "░".repeat(10 - percent);
}

function embedColor(level) {
  if (level >= 90) return 0xFFD700;
  if (level >= 60) return 0x9B59B6;
  if (level >= 30) return 0x3498DB;
  return 0x2ECC71;
}

//////////////////////////////
// ===== SHARED SHOP ===== //
//////////////////////////////

async function generateShop() {
  const items = [];
  for (let i = 1; i <= 6; i++) {
    items.push({
      id: i,
      name: `Item ${i}`,
      price: 500 + Math.floor(Math.random() * 500),
      exp: 200 + Math.floor(Math.random() * 300),
      stock: Math.random() > 0.5 ? 2 : 3
    });
  }
  await db.set("shop", {
    items,
    reset: Date.now() + 3600000
  });
}

async function getShop() {
  let shop = await db.get("shop");
  if (!shop || Date.now() > shop.reset) {
    await generateShop();
    shop = await db.get("shop");
  }
  return shop;
}

//////////////////////////////
// ===== SLASH COMMANDS ===== //
//////////////////////////////

const commands = [
  new SlashCommandBuilder()
    .setName("pet")
    .setDescription("Chọn pet của bạn"),
  new SlashCommandBuilder()
    .setName("balo")
    .setDescription("Xem balo")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Xem balo người khác")
    ),
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Xem shop")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
})();

//////////////////////////////
// ===== COMMAND HANDLE ===== //
//////////////////////////////

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {

    /////////////////////////
    // PET COMMAND
    /////////////////////////
    if (interaction.commandName === "pet") {
      const user = await db.get(`user_${interaction.user.id}`);
      if (user?.pet) {
        return interaction.reply({ content: "Bạn đã có pet rồi!", ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("choose_fire")
          .setLabel("🔥 Fire")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("choose_water")
          .setLabel("💧 Water")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("choose_electric")
          .setLabel("⚡ Electric")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({
        content: "Chọn hệ pet:",
        components: [row]
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }

    /////////////////////////
    // BALO COMMAND
    /////////////////////////
    if (interaction.commandName === "balo") {
      const target = interaction.options.getUser("user") || interaction.user;
      const user = await db.get(`user_${target.id}`);

      if (!user?.pet) {
        return interaction.reply({ content: "Người này chưa có pet!", ephemeral: true });
      }

      const level = getLevel(user.exp);

      const embed = new EmbedBuilder()
        .setTitle(`Balo của ${target.username}`)
        .setColor(embedColor(level))
        .addFields(
          { name: "Hệ", value: PET_TYPES[user.pet].name },
          { name: "Buff", value: PET_TYPES[user.pet].buff },
          { name: "Level", value: level.toString() },
          { name: "EXP", value: `${user.exp} \n${expBar(user.exp)}` }
        );

      await interaction.reply({ embeds: [embed] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }

    /////////////////////////
    // SHOP COMMAND
    /////////////////////////
    if (interaction.commandName === "shop") {
      const shop = await getShop();

      const embed = new EmbedBuilder()
        .setTitle("🏪 SHOP CHUNG")
        .setColor(0xF1C40F);

      shop.items.forEach(i => {
        embed.addFields({
          name: `${i.id}. ${i.name} (x${i.stock})`,
          value: `Giá: ${i.price} | EXP: +${i.exp}`
        });
      });

      const row = new ActionRowBuilder();
      shop.items.forEach(i => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_${i.id}`)
            .setLabel(`Mua ${i.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(i.stock <= 0)
        );
      });

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }
  }

  /////////////////////////
  // BUTTON HANDLE
  /////////////////////////
  if (interaction.isButton()) {

    // CHOOSE PET
    if (interaction.customId.startsWith("choose_")) {
      const type = interaction.customId.split("_")[1];
      const exist = await db.get(`user_${interaction.user.id}`);
      if (exist?.pet) {
        return interaction.reply({ content: "Bạn đã có pet rồi!", ephemeral: true });
      }

      await db.set(`user_${interaction.user.id}`, {
        pet: type,
        exp: 0,
        coins: 5000
      });

      await interaction.update({
        content: `Bạn đã chọn hệ ${PET_TYPES[type].name}`,
        components: []
      });
    }

    // BUY ITEM
    if (interaction.customId.startsWith("buy_")) {
      const id = Number(interaction.customId.split("_")[1]);
      const shop = await getShop();
      const item = shop.items.find(i => i.id === id);

      if (!item || item.stock <= 0) {
        return interaction.reply({ content: "Hết hàng!", ephemeral: true });
      }

      const user = await db.get(`user_${interaction.user.id}`);
      if (!user?.pet) {
        return interaction.reply({ content: "Bạn chưa có pet!", ephemeral: true });
      }

      if (user.coins < item.price) {
        return interaction.reply({ content: "Không đủ tiền!", ephemeral: true });
      }

      user.coins -= item.price;
      user.exp += item.exp;
      item.stock--;

      await db.set(`user_${interaction.user.id}`, user);
      await db.set("shop", shop);

      const level = getLevel(user.exp);

      await interaction.reply({
        content: `Mua thành công! +${item.exp} EXP`
      });

      // EVOLUTION LOG
      if ([30, 60, 90].includes(level)) {
        interaction.channel.send({
          content: `🔥 ${interaction.user.username} đã đạt level ${level}!`
        });
      }

      setTimeout(() => interaction.deleteReply().catch(() => {}), 60000);
    }
  }
});

client.login(TOKEN);
