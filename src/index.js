const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  Collection,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const connectDB = require("./database/mongo");
const { checkCooldown } = require("./utils/cooldowns");
connectDB();

// ===== CONFIG =====
const TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ===== LOAD COMMANDS =====
client.commands = new Collection();
const commands = [];

function loadFolder(folderPath) {
  const fullPath = path.join(__dirname, folderPath);
  if (!fs.existsSync(fullPath)) return;
  const files = fs.readdirSync(fullPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(fullPath, file);
    const command = require(filePath);
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    }
  }
}

loadFolder("commands");
loadFolder("cogs");

// Register Slash Commands (Giữ nguyên logic của bạn)
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    if (DEV_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(APP_ID, DEV_GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
    }
    console.log("✅ Đã đăng ký Slash Commands");
  } catch (e) { console.error(e); }
})();

// ===== INTERACTION HANDLER (ĐÃ TỐI ƯU) =====
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 1. XỬ LÝ SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const cooldown = checkCooldown(interaction.user.id, interaction.commandName);
      if (cooldown) {
        return interaction.reply({ content: `⏳ Chờ **${cooldown}** nữa để dùng lại **/${interaction.commandName}**`, flags: 64 });
      }
      return await command.execute(interaction);
    }

    // 2. XỬ LÝ BUTTONS (Tự động tìm command theo ID)
    if (interaction.isButton()) {
        // Tách ID: "baucua_nai" -> lấy "baucua"
        const commandName = interaction.customId.split(/[_-]/)[0]; 
        const command = client.commands.get(commandName);
        
        if (command && command.handleButton) {
            return await command.handleButton(interaction);
        }
    }

    // 3. XỬ LÝ MODALS (Tự động tìm command theo ID)
    if (interaction.isModalSubmit()) {
        const commandName = interaction.customId.split(/[_-]/)[0];
        const command = client.commands.get(commandName);

        if (command && command.handleModal) {
            return await command.handleModal(interaction);
        }
    }

    // 4. XỬ LÝ STRING SELECT MENU (Dành cho SHOP mới)
    if (interaction.isStringSelectMenu()) {
        const commandName = interaction.customId.split(/[_-]/)[0];
        const command = client.commands.get(commandName);

        // Nếu shop sử dụng handleMenu hoặc logic bên trong execute của shop
        if (command && command.handleMenu) {
            return await command.handleMenu(interaction);
        }
    }

  } catch (error) {
    console.error("❌ Error:", error);
    const msg = { content: "❌ Có lỗi xảy ra khi thực hiện lệnh!", flags: 64 };
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
    else await interaction.reply(msg);
  }
});

client.once(Events.ClientReady, c => console.log(`🤖 Bot online: ${c.user.tag}`));
client.login(TOKEN);