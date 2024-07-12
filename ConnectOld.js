// // File: Connect.js

// import {
//   makeWASocket,
//   useMultiFileAuthState,
//   DisconnectReason,
//   fetchLatestBaileysVersion,
//   makeInMemoryStore,
// } from "@whiskeysockets/baileys";
// import pino from "pino";
// import { Boom } from "@hapi/boom";
// import path from "path";
// import { fileURLToPath } from "url";
// import fs from "fs";
// import chalk from "chalk";
// import chokidar from "chokidar";

// // Import settings
// import settings from "./settings.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const logger = pino({ level: "silent" });

// const store = makeInMemoryStore({
//   logger: logger.child({ level: "silent", stream: "store" }),
// });

// let plugins = {};

// // Function to dynamically load a plugin
// async function loadPlugin(file) {
//   if (file.endsWith(".js")) {
//     try {
//       const plugin = await import(`./plugins/${file}?update=${Date.now()}`);
//       plugins[file] = plugin;
//       console.log(chalk.green(`Loaded ${file}`));
//     } catch (error) {
//       console.error(chalk.red(`Error loading ${file}: ${error.message}`));
//     }
//   }
// }

// // Function to load all plugins initially
// async function loadAllPlugins() {
//   const pluginsDir = path.join(__dirname, "plugins");
//   const files = fs.readdirSync(pluginsDir);

//   for (const file of files) {
//     await loadPlugin(file);
//   }
// }

// async function connectToWhatsApp() {
//   const { state, saveCreds } = await useMultiFileAuthState(
//     path.join(__dirname, "session")
//   );
//   const { version, isLatest } = await fetchLatestBaileysVersion();
//   console.log(`Using WA v${version.join(".")}, isLatest: ${isLatest}`);

//   const sock = makeWASocket({
//     version,
//     logger,
//     printQRInTerminal: true,
//     auth: state,
//     browser: [settings.botName, "Chrome", "1.0.0"],
//   });

//   store.bind(sock.ev);

//   await loadAllPlugins();

//   const watcher = chokidar.watch(path.join(__dirname, "plugins"), {
//     ignored: /(^|[\/\\])\../, // ignore dotfiles
//     persistent: true,
//   });

//   watcher.on("change", async (filePath) => {
//     const fileName = path.basename(filePath);
//     // console.log(chalk.green.bold(`${fileName} has been updated.`));
//     await loadPlugin(fileName);
//   });

//   sock.ev.on("connection.update", (update) => {
//     const { connection, lastDisconnect } = update;
//     if (connection === "close") {
//       const shouldReconnect =
//         lastDisconnect.error instanceof Boom &&
//         lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
//       console.log(
//         "Connection closed due to ",
//         lastDisconnect.error,
//         ", reconnecting ",
//         shouldReconnect
//       );
//       if (shouldReconnect) {
//         connectToWhatsApp();
//       }
//     } else if (connection === "open") {
//       console.log(chalk.yellow("╔───────────────────────────────"));
//       console.log(
//         chalk.yellow("│ ") + chalk.bold.yellow("Opened connection ✅")
//       );
//       console.log(chalk.yellow("╚───────────────────────────────"));
//     }
//   });

//   sock.ev.on("creds.update", saveCreds);

//   sock.ev.on("messages.upsert", async (m) => {
//     const msg = m.messages[0];
//     if (!msg.key.fromMe && m.type === "notify") {
//       const sender = msg.key.remoteJid;
//       const pushName = msg.pushName || "Unknown";
//       const messageTime = new Date(
//         msg.messageTimestamp * 1000
//       ).toLocaleTimeString();
//       const messageBody =
//         msg.message.conversation ||
//         msg.message.extendedTextMessage?.text ||
//         "No text";

//       console.log("\n" + chalk.yellow("╔───────────────────────────────"));
//       console.log(
//         chalk.yellow("│ ") + chalk.green("🤖 New Message Received! 📩")
//       );
//       console.log(chalk.yellow("╠───────────────────────────────"));
//       console.log(
//         chalk.yellow("│ ") + chalk.blue("👤 Sender: ") + chalk.white(pushName)
//       );
//       console.log(
//         chalk.yellow("│ ") +
//           chalk.blue("📞 Number: ") +
//           chalk.white(sender.split("@")[0])
//       );
//       console.log(
//         chalk.yellow("│ ") + chalk.blue("🕒 Time: ") + chalk.white(messageTime)
//       );
//       console.log(
//         chalk.yellow("│ ") +
//           chalk.blue("💬 Message: ") +
//           chalk.white(messageBody)
//       );
//       console.log(chalk.yellow("╚───────────────────────────────"));

//       // Handle messages with plugins
//       // for (const file in plugins) {
//       //   await plugins[file].handleMessage(sock, msg);
//       // }
//       for (const file in plugins) {
//         try {
//           await plugins[file].handleMessage(sock, msg);
//         } catch (error) {
//           console.error(`Error in plugin ${file}:`, error);
//         }
//       }
//     }
//   });
// }

// connectToWhatsApp();

// File: connect.js

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

// Import settings
import settings from "./settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: "silent" });

const store = makeInMemoryStore({
  logger: logger.child({ level: "silent", stream: "store" }),
});

let plugins = {};

// Function to dynamically load a plugin
async function loadPlugin(file) {
  if (file.endsWith(".js")) {
    try {
      const plugin = await import(`./plugins/${file}?update=${Date.now()}`);
      plugins[file] = plugin;
      console.log(chalk.green(`Loaded ${file}`));
    } catch (error) {
      console.error(chalk.red(`Error loading ${file}: ${error.message}`));
    }
  }
}

// Function to load all plugins initially
async function loadAllPlugins() {
  const pluginsDir = path.join(__dirname, "plugins");
  const files = fs.readdirSync(pluginsDir);

  for (const file of files) {
    await loadPlugin(file);
  }
}

// Function to handle connection updates
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

async function handleMessages(sock, m) {
  const msg = m.messages[0];
  if (!msg.key.fromMe && m.type === "notify") {
    const sender = msg.key.remoteJid;
    const pushName = msg.pushName || "Unknown";
    const messageTime = new Date(
      msg.messageTimestamp * 1000
    ).toLocaleTimeString();

    let messageBody = "No text";
    let interactiveType = "";
    let interactiveResponse = "";

    if (msg.message) {
      if (msg.message.conversation) {
        messageBody = msg.message.conversation;
      } else if (msg.message.extendedTextMessage) {
        messageBody = msg.message.extendedTextMessage.text;
      } else if (msg.message.interactiveResponseMessage) {
        messageBody = msg.message.interactiveResponseMessage.body.text;
        interactiveType = "Interactive Response";
        interactiveResponse = JSON.parse(
          msg.message.interactiveResponseMessage.nativeFlowResponseMessage
            .paramsJson
        ).id;
      } else if (msg.message.buttonsResponseMessage) {
        messageBody = msg.message.buttonsResponseMessage.selectedButtonId;
        interactiveType = "Button Response";
        interactiveResponse =
          msg.message.buttonsResponseMessage.selectedDisplayText;
      } else if (msg.message.listResponseMessage) {
        messageBody =
          msg.message.listResponseMessage.singleSelectReply.selectedRowId;
        interactiveType = "List Response";
        interactiveResponse = msg.message.listResponseMessage.title;
      } else if (msg.message.templateButtonReplyMessage) {
        messageBody = msg.message.templateButtonReplyMessage.selectedId;
        interactiveType = "Template Button Response";
        interactiveResponse =
          msg.message.templateButtonReplyMessage.selectedDisplayText;
      } else if (msg.message.reactionMessage) {
        messageBody = msg.message.reactionMessage.text;
        interactiveType = "Reaction";
      } else if (msg.message.viewOnceMessage) {
        const viewOnceContent = msg.message.viewOnceMessage.message;
        if (viewOnceContent.interactiveMessage) {
          messageBody = "Interactive Message";
          interactiveType = "List";
          interactiveResponse = viewOnceContent.interactiveMessage.header.title;
        }
      }
    }

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
      chalk.yellow("│ ") + chalk.blue("💬 Message: ") + chalk.white(messageBody)
    );
    if (interactiveType) {
      console.log(
        chalk.yellow("│ ") +
          chalk.blue("🔄 Interactive Type: ") +
          chalk.white(interactiveType)
      );
      console.log(
        chalk.yellow("│ ") +
          chalk.blue("🔄 Interactive Response: ") +
          chalk.white(interactiveResponse)
      );
    }
    console.log(chalk.yellow("╰───────────────────────────────"));

    for (const file in plugins) {
      try {
        await plugins[file].handleMessage(sock, msg);
      } catch (error) {
        console.error(`Error in plugin ${file}:`, error);
      }
    }
    // for (const file in plugins) {
    //   try {
    //     await plugins[file].handleMessage(sock, msg);
    //   } catch (error) {
    //     console.error(`Error in plugin ${file}:`, error);
    //     console.error(
    //       `Message: ${
    //         msg.message
    //           ? msg.message.conversation || msg.message.extendedTextMessage.text
    //           : "Unknown"
    //       }`
    //     );
    //   }
    // }
  }
}

async function connectToWhatsApp() {
  // const { state, saveCreds } = await useMultiFileAuthState(
  //   path.join(__dirname, "session")
  // );
  const { state, saveCreds } = await useMultiFileAuthState(
    settings.sessionPath
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
    // console.log(chalk.green.bold(`${fileName} has been updated.`));
    await loadPlugin(fileName);
  });

  sock.ev.on("connection.update", handleConnectionUpdate);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    await handleMessages(sock, m);
  });
}

connectToWhatsApp();
