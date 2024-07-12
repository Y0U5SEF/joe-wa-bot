import chalk from "chalk";
import settings from "../settings.js";
import { generateWAMessageFromContent } from "@whiskeysockets/baileys";

const commands = {
  command: ["mika"],
};

const rtl = "‏";
const ltr = "‎";
const monospace = "```";
const prefix = settings.prefix;
const msgBcody = `${rtl}╮─────────────────────╭
${rtl}┥ 👨🏻‍💻 تطوير: _*YOUSSEF EL ABASSI*_
${rtl}┥ 🔗 انستا: _${ltr}*@ussef.elabassi*_
${rtl}┥ 🌐 واتساب: 212665167445
${rtl}╯─────────────────────╰
${rtl}╮─────── *تـيـليشارجي* ───────╭
${rtl}┥│ ${ltr}${monospace}${prefix}insta${monospace}${rtl}
${rtl}┥│ ${ltr}${monospace}${prefix}apk${monospace}${rtl}
${rtl}┥│ ${ltr}${monospace}${prefix}ping${monospace}${rtl}
${rtl}┥│ ${ltr}${monospace}${prefix}owner${monospace}${rtl}
${rtl}╯─────────────────────╰`;

export async function handleMessage(sock, msg) {
  const messageBody =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "No text";
  const sender = msg.key.remoteJid;

  if (messageBody.startsWith(settings.prefix)) {
    const parts = messageBody
      .slice(settings.prefix.length)
      .trim()
      .toLowerCase()
      .split(" ");
    const command = parts[0];

    if (commands.command.includes(command)) {
      try {
        // Define the message content
        let MenuMsg = {
          text: msgBcody,
          contextInfo: {
            externalAdReply: {
              title: settings.botName,
              body: settings.instagram,
              thumbnailUrl: "https://i.ibb.co/wM1t2Ch/bg.jpg",
              sourceUrl: null,
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          },
        };
        // Define the buttons

        // Send the message
        await sock.sendMessage(sender, MenuMsg);

        console.log(chalk.green("Message sent successfully!"));
      } catch (error) {
        console.error(chalk.red("Failed to send message: "), error);
      }
    }
  }
}
