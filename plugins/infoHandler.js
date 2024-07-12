import chalk from "chalk";
import settings from "../settings.js";

const commands = {
  info: ["info"],
};

const commandInfo = {
  menu: "Sends menu with all commands of the bot",
  ping: "Sends ping speed",
  weather: `Sends weather info\n\n👉 _Usage:_\n*${settings.prefix}weather Agdz*`,
  insta: `Downloads Images Or Reels from instagram\n\n👉 _Usage:_\n*${settings.prefix}insta URL from instagram*`,
  apk: `Downloads android apps from Play Store\n\n👉 _Usage:_\n*${settings.prefix}apk Facebook Lite*`,
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
    const subCommand = parts[1];

    if (commands.info.includes(command)) {
      if (subCommand && commandInfo[subCommand]) {
        console.log(
          chalk.green(`Sending info about ${subCommand} to: `) +
            chalk.white(sender)
        );
        await sock.sendMessage(sender, { text: commandInfo[subCommand] });
      } else {
        console.log(
          chalk.red("Unknown sub-command received from: ") + chalk.white(sender)
        );
        await sock.sendMessage(sender, {
          text: "Unknown sub-command. Type !menu for the menu.",
        });
      }
    }
  }
}
