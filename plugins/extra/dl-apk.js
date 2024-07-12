import axios from "axios";
import chalk from "chalk";
import settings from "../settings.js";
import { search, download } from "aptoide-scraper";
// import fs from "fs";

const commands = {
  command: ["apk"],
};

export async function handleMessage(sock, msg) {
  const messageBody =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "No text";
  const sender = msg.key.remoteJid;

  if (messageBody.startsWith(settings.prefix)) {
    const parts = messageBody.slice(settings.prefix.length).trim().split(" ");
    const command = parts[0];
    const subCommand = parts.slice(1).join(" "); // Join all parts after the command
    console.log(subCommand);

    if (commands.command.includes(command)) {
      await sock.sendMessage(sender, {
        react: {
          text: "🤖",
          key: msg.key,
        },
      });
      if (!subCommand) {
        await sock.sendMessage(sender, {
          text: "Please provide an app name.",
        });
        return;
      }

      try {
        // Search for the APK
        let searchResults = await search(subCommand);
        if (searchResults.length === 0) {
          console.log(`No results found for ${subCommand}`);
          return;
        }

        // Select the first result (or you can implement logic to select a specific one)
        const apkInfo = searchResults[0];
        console.log(`Found APK: ${apkInfo.name}, Package name: ${apkInfo.id}`);

        // Download the APK details
        let downloadInfo = await download(apkInfo.id);
        console.log(`Downloading ${downloadInfo.name}...`);
        console.log(`Size: ${downloadInfo.size}`);
        console.log(`Download Link: ${downloadInfo.dllink}`);

        // Download the APK file
        // const response = await axios({
        //   url: downloadInfo.dllink,
        //   method: "GET",
        //   responseType: "stream",
        // });

        const cap = `📱 *Name:* ${apkInfo.name}\n📦 *Package:* ${apkInfo.id}\n💾 *Size:* ${downloadInfo.size}`;

        await sock.sendMessage(sender, {
          document: { url: downloadInfo.dllink },
          mimetype: "application/vnd.android.package-archive",
          fileName: apkInfo.name,
          caption: cap,
        });

        // Save the APK to a file
        // const path = `./${downloadInfo.name}.apk`;
        // const writer = fs.createWriteStream(path);

        // response.data.pipe(writer);

        // writer.on("finish", () => {
        //   console.log(`Downloaded ${downloadInfo.name} to ${path}`);
        // });

        // writer.on("error", (err) => {
        //   console.error(`Error downloading ${downloadInfo.name}:`, err);
        // });
      } catch (error) {
        console.error(
          chalk.red(`Error downloading apk for: `) + chalk.white(sender),
          error
        );
        await sock.sendMessage(sender, {
          text: "Failed to download apk. Please try again later.",
        });
      }
    }
  }
}
