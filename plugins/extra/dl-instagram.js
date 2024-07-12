import axios from "axios";
import chalk from "chalk";
import settings from "../settings.js";

const commands = {
  command: ["insta", "instagram", "ig"],
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
          text: "👍",
          key: msg.key,
        },
      });
      if (!subCommand) {
        await sock.sendMessage(sender, {
          text: "Please provide an Instagram URL.",
        });
        return;
      }

      try {
        console.log(
          chalk.green(`Downloading Instagram media for: `) + chalk.white(sender)
        );

        // Ensure proper encoding of the Instagram URL
        const apiUrl = `https://guruapi.tech/api/igdlv1?url=${subCommand}`;

        const response = await axios.get(apiUrl);

        // Log the JSON result received from the API
        // console.log("API Response:");
        // console.log(response.data);

        if (response.data.success && response.data.data.length > 0) {
          const mediaData = response.data.data[0];
          const mediaType = mediaData.type;
          const mediaURL = mediaData.url_download;
          console.log(chalk.bgRed.bold.white(mediaURL));
          // let cap = `Here is your downloaded Instagram ${mediaType.toUpperCase()}.`;

          // Prepare message options based on media type
          const mediaOptions = {
            // caption: cap,
          };

          if (mediaType === "video") {
            mediaOptions.video = { url: mediaURL };
          } else if (mediaType === "image") {
            mediaOptions.image = { url: mediaURL };
          } else {
            throw new Error("Unsupported media type");
          }

          // Send media to WhatsApp
          await sock.sendMessage(sender, mediaOptions);
        } else {
          await sock.sendMessage(sender, {
            text: "Failed to download media. Please try again later.",
          });
        }
      } catch (error) {
        console.error(
          chalk.red(`Error downloading Instagram media for: `) +
            chalk.white(sender),
          error
        );
        await sock.sendMessage(sender, {
          text: "Failed to download media. Please try again later.",
        });
      }
    }
  }
}
