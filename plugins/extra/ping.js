// import chalk from "chalk";
// import settings from "../settings.js";

// const pong = "pong";

// const commands = {
//   command: ["ping"]
// };

// export async function handleMessage(sock, msg) {
//   const messageBody = msg.message.conversation || msg.message.extendedTextMessage?.text || "No text";
//   const sender = msg.key.remoteJid;

//   if (messageBody.startsWith(settings.prefix)) {
//     const parts = messageBody.slice(settings.prefix.length).trim().toLowerCase().split(" ");
//     const command = parts[0];

//     if (commands.command.includes(command)) {
//       console.log(chalk.green("Sending ping to: ") + chalk.white(sender));
//       await sock.sendMessage(sender, { text: pong });
//     }
//   }
// }

import chalk from "chalk";
import settings from "../settings.js";
import { addCommand, handler } from "../handler.js";

const pong = "pong";


export async function handleMessage(sock, msg) {
  const messageBody = msg.message.conversation || msg.message.extendedTextMessage?.text || "No text";
  const sender = msg.key.remoteJid;

  if (messageBody.startsWith(settings.prefix)) {
    const parts = messageBody.slice(settings.prefix.length).trim().toLowerCase().split(" ");
    const command = parts[0];

    if (handler.command.includes(command)) {
      console.log(chalk.green("Sending ping to: ") + chalk.white(sender));
      await sock.sendMessage(sender, { text: pong });
    }
  }
}


handler.command = ["ping", "peed"];

export default handler;