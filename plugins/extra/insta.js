import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import settings from "../../settings.js";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = {
  insta: ["insta"],
};

export async function handleMessage(sock, msg) {
  const messageBody =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "No text";
  const sender = msg.key.remoteJid;

  if (messageBody.startsWith(settings.prefix)) {
    const parts = messageBody.slice(settings.prefix.length).trim().split(" ");
    const command = parts[0].toLowerCase();
    const url = parts.slice(1).join(" ");

    if (commands.insta.includes(command)) {
      if (!url) {
        await sock.sendMessage(sender, {
          text: "Please provide a URL. Usage: !insta <URL>",
        });
        return;
      }

      await sock.sendMessage(sender, {
        react: {
          text: "🔄",
          key: msg.key,
        },
      });
      await sock.sendMessage(sender, {
        text: `${settings.Wait}`,
      });

      try {
        const videoSend = await downloadInstagramVideo(url);
        await sock.sendMessage(sender, {
          video: { url: videoSend },
          caption: "Here is your video",
        });
      } catch (error) {
        await sock.sendMessage(sender, {
          text: `Failed to download video: ${error.message}`,
        });
      }

      await sock.sendMessage(sender, {
        react: {
          text: "👍",
          key: msg.key,
        },
      });
    }
  }
}

async function downloadInstagramVideo(url) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const downloadDir = path.resolve(__dirname, "../tmp");
  const videoPath = path.join(downloadDir, "video.mp4");

  await page.goto("https://saveinsta.app/en1");
  await page.fill("#s_input", url);
  await page.click(".btn.btn-default");

  try {
    await page.waitForSelector("#closeModalBtn", { timeout: 500 });
    await page.click("#closeModalBtn");
  } catch (e) {
    // Modal did not appear, continue
  }

  // Wait for the download button to appear
  await page.waitForSelector(
    'a.abutton.is-success.is-fullwidth.btn-premium[onclick*="click_download_video"]'
  );

  // Click the download button
  await page.evaluate(() => {
    const downloadButton = document.querySelector(
      'a.abutton.is-success.is-fullwidth.btn-premium[onclick*="click_download_video"]'
    );
    if (downloadButton) {
      downloadButton.click();
    } else {
      throw new Error("Download button not found");
    }
  });

  const downloadUrl = await page.evaluate(() => {
    const downloadButton = document.querySelector(
      'a.abutton.is-success.is-fullwidth.btn-premium[onclick*="click_download_video"]'
    );
    return downloadButton ? downloadButton.href : null;
  });

  if (!downloadUrl) {
    throw new Error("Download URL not found");
  }
  await browser.close();
  return downloadUrl;

  // // Wait for the download to complete
  // const [download] = await Promise.all([
  //   page.waitForEvent("download"),
  //   // Download triggered by the click above
  // ]);

  // await download.saveAs(videoPath);

  // return videoPath;
}
