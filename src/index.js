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

// BỔ SUNG: Import Model User và hàm loanChecker
const User = require("./models/User"); 
const checkLoans = require("./utils/loanChecker");

connectDB();

// ===== LƯỚI AN TOÀN TOÀN CỤC: CHỐNG CRASH =====
// Bắt mọi Promise bị reject mà không có .catch (VD: lỗi trong setTimeout của các game)
// Nếu không có 2 handler này, 1 lỗi nhỏ như ChannelNotCached sẽ làm SẬP CẢ BOT (exit code 1)
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [Unhandled Rejection]:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [Uncaught Exception]:", err);
});

// ===== CONFIG =====
const TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;

// 🔒 KHÓA KÊNH: bot chỉ hoạt động trong các kênh này (điền ALLOWED_CHANNEL_IDS=id1,id2 vào env)
// Để trống = bot hoạt động ở mọi nơi như cũ
const ALLOWED_CHANNELS = process.env.ALLOWED_CHANNEL_IDS
  ? process.env.ALLOWED_CHANNEL_IDS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const isChannelAllowed = (channelId) => ALLOWED_CHANNELS.length === 0 || ALLOWED_CHANNELS.includes(channelId);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages, // ⭐ Cần cho hệ thống EXP đếm tin nhắn
  ],
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

// ===== REGISTER SLASH COMMANDS (NÂNG CẤP LÊN GLOBAL) =====
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    console.log("⏳ Đang đăng ký Slash Commands hệ thống (Global)...");
    
    // Đăng ký trực tiếp lên toàn cầu thay vì theo từng Guild
    await rest.put(Routes.applicationCommands(APP_ID), { body: commands });
    
    console.log("✅ Đã đăng ký Slash Commands thành công trên toàn hệ thống!");
  } catch (e) { 
    console.error("❌ Lỗi khi đăng ký lệnh:", e); 
  }
})();

// ===== INTERACTION HANDLER =====
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 🔒 0. CHẶN TIN NHẮN RIÊNG (DM) — bot chỉ phục vụ trong server
    if (!interaction.guildId) {
        if (interaction.isRepliable()) {
            await interaction.reply({ content: "🚫 Bot không hoạt động trong tin nhắn riêng! Hãy vào server và dùng lệnh trong kênh casino nhé.", flags: 64 }).catch(() => {});
        }
        return;
    }

    // 🔒 0.5. KHÓA KÊNH — chỉ phục vụ trong kênh được cấu hình
    if (!isChannelAllowed(interaction.channelId)) {
        if (interaction.isRepliable()) {
            const channelList = ALLOWED_CHANNELS.map((id) => `<#${id}>`).join(", ");
            await interaction.reply({ content: `🚫 Bot chỉ hoạt động tại kênh: ${channelList}\nQua đó chơi nhé!`, flags: 64 }).catch(() => {});
        }
        return;
    }

    // 1. ĐẶC CÁCH: Kiểm tra nếu là lệnh /anxa hoặc là Admin thì bỏ qua check Ban
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",") : [];
    const isAnxaCommand = interaction.isChatInputCommand() && interaction.commandName === "anxa";
    const isAdmin = adminIds.includes(interaction.user.id);

    if (!isAnxaCommand && !isAdmin) {
        const userDB = await User.findOne({ userId: interaction.user.id });
        if (userDB && userDB.banned) {
            return interaction.reply({ 
                content: "🚫 Tài khoản của bạn đã bị BAN vĩnh viễn do vi phạm hoặc trốn nợ!", 
                flags: 64 
            });
        }
    }

    // 2. XỬ LÝ SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // 🐛 FIX COOLDOWN: bản cũ MIỄN cooldown cho admin -> bạn (admin) test nên tưởng cooldown hỏng!
      // Giờ admin cũng bị cooldown. Muốn khôi phục đặc quyền: đặt ADMIN_COOLDOWN_BYPASS=true trong env
      const { ADMIN_BYPASS } = require("./utils/cooldowns");
      if (!(isAdmin && ADMIN_BYPASS)) {
          const cooldown = checkCooldown(interaction.user.id, interaction.commandName);
          if (cooldown) {
            return interaction.reply({
              content: `⏳ Lệnh **/${interaction.commandName}** đang hồi chiêu!\n🔄 Dùng lại được <t:${Math.floor(cooldown.expiresAt / 1000)}:R> *(còn ${cooldown.timeLeftText})*`,
              flags: 64,
            });
          }
      }
      
      return await command.execute(interaction);
    }

    // 3. XỬ LÝ BUTTONS 
    if (interaction.isButton()) {
        const commandName = interaction.customId.split(/[_-]/)[0]; 
        const command = client.commands.get(commandName);
        if (command && command.handleButton) {
            return await command.handleButton(interaction);
        }
    }

    // 4. XỬ LÝ MODALS 
    if (interaction.isModalSubmit()) {
        const commandName = interaction.customId.split(/[_-]/)[0];
        const command = client.commands.get(commandName);
        if (command && command.handleModal) {
            return await command.handleModal(interaction);
        }
    }

    // 5. XỬ LÝ STRING SELECT MENU
    if (interaction.isStringSelectMenu()) {
        const commandName = interaction.customId.split(/[_-]/)[0];
        const command = client.commands.get(commandName);
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

// ===== ⭐ HỆ THỐNG LEVEL: 1 TIN NHẮN TRONG KÊNH CASINO = 1 EXP =====
// EXP cần để lên cấp tiếp theo = level hiện tại x 100 (Lv1->2: 100 exp, Lv2->3: 200 exp...)
const expNeeded = (level) => level * 100;

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;                    // Bỏ qua bot
    if (!message.guildId) return;                       // Bỏ qua DM
    if (!isChannelAllowed(message.channelId)) return;   // Chỉ tính EXP trong kênh casino

    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    user.exp += 1;
    user.totalMessages += 1;

    // 🎉 LÊN CẤP (có thể lên nhiều cấp liền nếu tồn exp)
    let leveledUp = false;
    while (user.exp >= expNeeded(user.level)) {
        user.exp -= expNeeded(user.level);
        user.level += 1;
        leveledUp = true;
    }

    if (leveledUp) {
        // 🎁 Thưởng lên cấp: level mới x 10.000 VND
        const reward = user.level * 10000;
        user.money += reward;
        message.channel.send(
            `🎉 **LEVEL UP!** <@${message.author.id}> đã đạt **Cấp ${user.level}** ⭐\n` +
            `🎁 Thưởng thăng cấp: **+${reward.toLocaleString("vi-VN")} VND** — chăm chat có khác!`
        ).catch(() => {});
    }

    await user.save();
  } catch (err) {
    console.error("❌ [EXP] Lỗi cộng kinh nghiệm:", err.message);
  }
});

// ===== KHỞI ĐỘNG BOT VÀ CHẠY VÒNG LẶP =====
client.once(Events.ClientReady, c => {
    console.log(`🤖 Bot online: ${c.user.tag}`);
    setInterval(() => {
        checkLoans(client);
    }, 60000); 
    console.log("⏱️ Đã kích hoạt hệ thống kiểm tra nợ tự động.");
});

// 🔁 Tự động thử đăng nhập lại khi Discord API trục trặc (lỗi 5xx)
async function loginWithRetry(attempt = 1) {
  try {
    await client.login(TOKEN);
    console.log("✅ Đăng nhập Discord thành công!");
  } catch (err) {
    const wait = Math.min(60, attempt * 10); // 10s, 20s, 30s... tối đa 60s
    console.error(`❌ Đăng nhập thất bại (lần ${attempt}): ${err.message}`);
    console.log(`🔁 Thử lại sau ${wait} giây...`);
    setTimeout(() => loginWithRetry(attempt + 1), wait * 1000);
  }
}
loginWithRetry();