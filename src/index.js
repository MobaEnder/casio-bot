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
connectDB();

// ===== CONFIG =====
const TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

if (!TOKEN || !APP_ID) {
  console.error("❌ Thiếu BOT_TOKEN hoặc APP_ID trong .env");
  process.exit(1);
}

// ===== CLIENT =====
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
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if (!command?.data || !command?.execute) {
      console.warn(`⚠️ ${file} thiếu data hoặc execute`);
      continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

loadFolder("commands");
loadFolder("cogs");

// ===== REGISTER SLASH COMMANDS =====
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔄 Đang đăng ký slash commands...");

    if (DEV_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(APP_ID, DEV_GUILD_ID),
        { body: commands }
      );
      console.log("✅ Đã đăng ký GUILD commands (dev mode)");
    } else {
      await rest.put(Routes.applicationCommands(APP_ID), {
        body: commands,
      });
      console.log("✅ Đã đăng ký GLOBAL commands");
    }
  } catch (error) {
    console.error("❌ Lỗi đăng ký slash commands:", error);
  }
})();

// ===== INTERACTION HANDLER =====
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      return await command.execute(interaction);
    }

    // Buttons
    if (interaction.isButton()) {
      const taixiu = require("./commands/taixiu");
      const baucua = require("./commands/baucua");
      const vaytien = require("./commands/vaytien");
      const duangua = require("./commands/duangua");
      const daga = require("./commands/daga");
      const reset = require("./commands/reset");
      const daoham = require("./commands/daoham");
      const tuimu = require("./commands/tuimu");
      const baicao = require("./commands/baicao");

      if (interaction.customId.startsWith("taixiu_") && taixiu.handleButton)
        return await taixiu.handleButton(interaction);

      if (interaction.customId.startsWith("baucua_") && baucua.handleButton)
        return await baucua.handleButton(interaction);

      if (interaction.customId.startsWith("vaytien:") && vaytien.handleButton)
        return await vaytien.handleButton(interaction);
      
      if (interaction.customId.startsWith("duangua_") && duangua.handleButton)
        return await duangua.handleButton(interaction);

      if (interaction.customId.startsWith("daga_") && daga.handleButton)
        return await daga.handleButton(interaction);
      
      if (interaction.customId.startsWith("reset_") && reset.handleButton)
        return await reset.handleButton(interaction);

      if (interaction.customId.startsWith("daoham_") && daoham.handleButton)
        return await daoham.handleButton(interaction);

      if (interaction.customId.startsWith("tuimu_") && tuimu.handleButton)
        return await tuimu.handleButton(interaction);

      if (interaction.customId.startsWith("baicao_") && baicao.handleButton)
        return await baicao.handleButton(interaction);
      
    }

    // Modals
    if (interaction.isModalSubmit()) {
      const taixiu = require("./commands/taixiu");
      const baucua = require("./commands/baucua");
      const duangua = require("./commands/duangua");
      const daga = require("./commands/daga");
      const daoham = require("./commands/daoham");
      const tuimu = require("./commands/tuimu");
      const baicao = require("./commands/baicao");

      if (interaction.customId.startsWith("taixiu_modal_") && taixiu.handleModal)
        return await taixiu.handleModal(interaction);

      if (interaction.customId.startsWith("baucua_modal_") && baucua.handleModal)
        return await baucua.handleModal(interaction);

      if (interaction.customId.startsWith("duangua_modal_") && duangua.handleModal)
        return await duangua.handleModal(interaction);

      if (interaction.customId.startsWith("daga_modal_") && daga.handleModal)
        return await daga.handleModal(interaction);

      if (interaction.customId.startsWith("daoham_modal_") && daoham.handleModal)
        return await daoham.handleModal(interaction);

      if (interaction.customId.startsWith("tuimu_") && tuimu.handleModal)
        return await tuimu.handleModal(interaction);

      if (interaction.customId.startsWith("baicao_") && baicao.handleModal)
        return await baicao.handleModal(interaction);
      
    }
  } catch (error) {
    console.error("❌ Interaction error:", error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Có lỗi xảy ra!");
      } else {
        await interaction.reply({ content: "❌ Có lỗi xảy ra!", flags: 64 });
      }
    } catch {}
  }
});

// ===== READY =====
client.once(Events.ClientReady, client => {
  console.log(`🤖 Bot online: ${client.user.tag}`);
});

// ===== LOGIN =====
client.login(TOKEN);
