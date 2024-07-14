import chalk from "chalk";
import settings from "../settings.js";
import { generateWAMessageFromContent } from "@whiskeysockets/baileys";

const commands = {
  command: ["btn"],
};

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
        const menuMessage = `
TEXT`;
        // Define the buttons
        const buttons = [
          ["🎵 Music", `${settings.prefix}music`],
          ["📹 Video", `${settings.prefix}video`],
          ["📚 Books", `${settings.prefix}books`],
          ["🎮 Games", `${settings.prefix}games`],
          ["🍔 Food", `${settings.prefix}food`],
        ];

        const dynamicButtons = buttons.map((btn) => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: btn[0],
            id: btn[1],
          }),
        }));

        const interactiveMessage = {
          body: { text: menuMessage },
          footer: { text: "Select an option" },
          header: {
            hasMediaAttachment: false,
            imageMessage: null,
            videoMessage: null,
          },
          nativeFlowMessage: {
            buttons: dynamicButtons,
            messageParamsJson: "",
          },
        };

        let msgL = generateWAMessageFromContent(
          sender,
          {
            viewOnceMessage: {
              message: {
                interactiveMessage,
              },
            },
          },
          { userJid: sock.user.jid, quoted: msg }
        );

        // Send the message
        await sock.relayMessage(sender, msgL.message, {
          messageId: msgL.key.id,
        });

        console.log(chalk.green("Message sent successfully!"));
      } catch (error) {
        console.error(chalk.red("Failed to send message: "), error);
      }
    }
  }
}
