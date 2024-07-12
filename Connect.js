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
import fs from "fs";
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

async function loadPlugin(file) {
  if (file.endsWith(".js")) {
    try {
      // Unload existing plugin if loaded
      if (plugins[file]) {
        delete require.cache[require.resolve(`./plugins/${file}`)];
        delete plugins[file];
        console.log(chalk.yellow(`Unloaded ${file}`));
      }

      const plugin = await import(`./plugins/${file}?update=${Date.now()}`);
      plugins[file] = plugin;
      console.log(chalk.green(`Loaded ${file}`));
    } catch (error) {
      console.error(chalk.red(`Error loading ${file}: ${error.message}`));
    }
  }
}

async function loadAllPlugins() {
  const pluginsDir = path.join(__dirname, "plugins");
  const files = fs.readdirSync(pluginsDir);

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

    const messageContent = msg.message?.conversation || "";

    if (messageContent === `${settings.prefix}alive`) {
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
        console.error(`Error in plugin ${file}:`, error);
      }
    }
  }
}

async function connectToWhatsApp() {
  try {
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
