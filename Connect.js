import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { Boom } from "@hapi/boom";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises"; // Using fs.promises for consistency
import chalk from "chalk";
import chokidar from "chokidar";
import settings from "./settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: "silent" });
const store = makeInMemoryStore({
  logger: logger.child({ level: "silent", stream: "store" }),
});

let plugins = {};
let userState = {};
const startTime = Date.now();

const DB_FILE = path.join(__dirname, "database.json");

// Database functions
async function initDatabase() {
  try {
    await fs.access(DB_FILE);
    const data = await readDatabase();
    if (!data.users) {
      await writeDatabase({ users: {} });
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeDatabase({ users: {} });
    } else {
      console.error(chalk.red(`Error initializing database: ${error.message}`));
    }
  }
}

async function readDatabase() {
  try {
    const data = await fs.readFile(DB_FILE, "utf8");
    return data.trim() ? JSON.parse(data) : { users: {} };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { users: {} };
    }
    if (error instanceof SyntaxError) {
      console.error(
        chalk.red(`Invalid JSON in database file: ${error.message}`)
      );
      await fs.rename(DB_FILE, `${DB_FILE}.backup-${Date.now()}`);
      return { users: {} };
    }
    console.error(chalk.red(`Error reading database: ${error.message}`));
    return { users: {} };
  }
}

async function writeDatabase(data) {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(chalk.red(`Error writing to database: ${error.message}`));
  }
}

async function updateUser(jid, userData) {
  try {
    const db = await readDatabase();
    db.users[jid] = { ...db.users[jid], ...userData };
    await writeDatabase(db);
  } catch (error) {
    console.error(chalk.red(`Error updating user: ${error.message}`));
  }
}

// async function loadPlugin(file) {
//   if (file.endsWith(".js")) {
//     try {
//       // Unload existing plugin if loaded
//       if (plugins[file]) {
//         delete require.cache[require.resolve(`./plugins/${file}`)];
//         delete plugins[file];
//         console.log(chalk.yellow(`Unloaded ${file}`));
//       }

//       const plugin = await import(`./plugins/${file}?update=${Date.now()}`);
//       plugins[file] = plugin;
//       console.log(chalk.green(`Loaded ${file}`));
//     } catch (error) {
//       console.error(chalk.red(`Error loading ${file}: ${error.message}`));
//     }
//   }
// }
async function loadPlugin(file) {
  if (file.endsWith(".js")) {
    try {
      // Unload existing plugin if loaded
      if (plugins[file]) {
        delete plugins[file];
        console.log(chalk.yellow(`Unloaded ${file}`));
      }

      const pluginPath = `./plugins/${file}`;
      // Import the plugin using dynamic import
      const plugin = await import(`${pluginPath}?update=${Date.now()}`);
      plugins[file] = plugin;
      console.log(chalk.green(`Loaded ${file}`));
    } catch (error) {
      console.error(chalk.red(`Error loading ${file}: ${error.message}`));
    }
  }
}

async function loadAllPlugins() {
  const pluginsDir = path.join(__dirname, "plugins");
  const files = await fs.readdir(pluginsDir);

  for (const file of files) {
    await loadPlugin(file);
  }
}

function handleConnectionUpdate(update) {
  const { connection, lastDisconnect } = update;
  if (connection === "close") {
    const shouldReconnect =
      lastDisconnect.error instanceof Boom &&
      lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
    console.log(
      "Connection closed due to ",
      lastDisconnect.error,
      ", reconnecting ",
      shouldReconnect
    );
    if (shouldReconnect) {
      connectToWhatsApp();
    }
  } else if (connection === "open") {
    console.log(chalk.yellow("╭──────────────────────"));
    console.log(
      chalk.yellow("│ ") + chalk.bold.greenBright("✅ Opened connection")
    );
    console.log(chalk.yellow("╰──────────────────────"));
  }
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

async function handleMessages(sock, m) {
  const msg = m.messages[0];
  if (!msg.key.fromMe && m.type === "notify") {
    const sender = msg.key.remoteJid;
    if (!userState[sender]) {
      userState[sender] = {};
    }

    const pushName = msg.pushName || "Unknown";
    const messageTime = new Date(msg.messageTimestamp * 1000).toLocaleString();
    const messageBody = msg.message?.conversation || "(No text)";

    const isCommand = messageBody.startsWith(settings.prefix);

    if (isCommand) {
      const command = messageBody
        .slice(settings.prefix.length)
        .trim()
        .split(" ")[0];

      console.log("\n" + chalk.yellow("╭───────────────────────────────"));
      console.log(chalk.yellow("│ ") + chalk.green("🔧 Command Detected!"));
      console.log(chalk.yellow("├───────────────────────────────"));
      console.log(
        chalk.yellow("│ ") + chalk.blue("👤 Sender: ") + chalk.white(pushName)
      );
      console.log(
        chalk.yellow("│ ") +
          chalk.blue("📞 Number: ") +
          chalk.white(sender.split("@")[0])
      );
      console.log(
        chalk.yellow("│ ") + chalk.blue("🕒 Time: ") + chalk.white(messageTime)
      );
      console.log(
        chalk.yellow("│ ") + chalk.blue("💬 Command: ") + chalk.white(command)
      );
      console.log(chalk.yellow("╰───────────────────────────────"));
    } else {
      console.log("\n" + chalk.yellow("╭───────────────────────────────"));
      console.log(chalk.yellow("│ ") + chalk.green("📩 New Message Received!"));
      console.log(chalk.yellow("├───────────────────────────────"));
      console.log(
        chalk.yellow("│ ") + chalk.blue("👤 Sender: ") + chalk.white(pushName)
      );
      console.log(
        chalk.yellow("│ ") +
          chalk.blue("📞 Number: ") +
          chalk.white(sender.split("@")[0])
      );
      console.log(
        chalk.yellow("│ ") + chalk.blue("🕒 Time: ") + chalk.white(messageTime)
      );
      console.log(
        chalk.yellow("│ ") +
          chalk.blue("💬 Message: ") +
          chalk.white(messageBody)
      );
      console.log(chalk.yellow("╰───────────────────────────────"));
    }

    try {
      let userData = {
        id: sender,
        name: pushName,
        isGroup: sender.endsWith("@g.us"),
      };

      await updateUser(sender, userData);

      if (isCommand && messageBody === `${settings.prefix}alive`) {
        const uptime = Date.now() - startTime;
        const formattedUptime = formatUptime(uptime);
        const monospace = "```";
        await sock.sendMessage(sender, {
          text: `*Bot has been up for:*⏱️ \n${monospace}${formattedUptime}${monospace}`,
        });
        return;
      }

      for (const file in plugins) {
        try {
          await plugins[file].handleMessage(sock, msg, userState);
        } catch (error) {
          logger.error(`Error in plugin ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling message: ${error.message}`);
    }
  }
}

async function connectToWhatsApp() {
  try {
    await initDatabase();
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(__dirname, "session")
    );
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: true,
      auth: state,
      browser: [settings.botName, "Chrome", "1.0.0"],
    });

    store.bind(sock.ev);

    await loadAllPlugins();

    const watcher = chokidar.watch(path.join(__dirname, "plugins"), {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
    });

    watcher.on("change", async (filePath) => {
      const fileName = path.basename(filePath);
      await loadPlugin(fileName);
    });

    sock.ev.on("connection.update", handleConnectionUpdate);
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", async (m) => {
      await handleMessages(sock, m);
    });

    process.on("SIGINT", () => {
      console.log(chalk.yellow("\nGracefully shutting down..."));
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      sock.ev.removeAllListeners("messages.upsert");
      watcher.close();
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red(`Failed to connect: ${error.message}`));
  }
}

connectToWhatsApp();
