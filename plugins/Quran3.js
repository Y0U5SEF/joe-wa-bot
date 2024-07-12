// File: plugins/quranDownloader.js
import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import chalk from "chalk";
import settings from "../settings.js";
import { reciterList, surahList, surahData } from "../lib/quranData.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = {
  command: ["quran"],
};

async function sendList(
  sock,
  jid,
  title,
  text,
  buttonText,
  listSections,
  quoted,
  options = {}
) {
  const message = {
    interactiveMessage: {
      header: {
        title: title,
        hasMediaAttachment: false,
      },
      body: { text: text },
      nativeFlowMessage: {
        buttons: [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: buttonText,
              sections: listSections,
            }),
          },
        ],
        messageParamsJson: "",
      },
    },
  };

  let msgL = generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message,
      },
    },
    { userJid: sock.user.jid, quoted }
  );

  try {
    await sock.relayMessage(jid, msgL.message, {
      messageId: msgL.key.id,
      ...options,
    });
  } catch (error) {
    console.error("Failed to send list:", error);
    throw error;
  }
}

export async function handleMessage(sock, msg, userState) {
  const sender = msg.key.remoteJid;
  const messageContent = msg.message?.conversation;

  // Initialize user state for Quran downloader
  if (!userState[sender]) {
    userState[sender] = {};
  }

  // Step 1: Ask for reciter
  if (messageContent === `${settings.prefix}quran`) {
    const title = "السلام عليكم ورحمة الله";
    const text = `\n*يمكنك تحميل آية محددة من القرآن الكريم بصوت أشهر القراء.*\n\n*رجاء قم باختيار القارئ من القائمة.*`;
    const buttonText = "اخـتيار الــقارئ";

    const listSections = [
      {
        title: "Reciters",
        rows: reciterList,
      },
    ];

    await sendList(sock, sender, title, text, buttonText, listSections, msg);
    userState[sender].quran = { step: "selecting_reciter" };
    return;
  }

  // Check if the current state is related to Quran downloader
  if (userState[sender].quran) {
    // Step 2: Handle reciter selection
    if (
      msg.message?.interactiveResponseMessage &&
      userState[sender].quran.step === "selecting_reciter"
    ) {
      const response = JSON.parse(
        msg.message.interactiveResponseMessage.nativeFlowResponseMessage
          .paramsJson
      );

      const selectedReciterId = response.id;
      const selectedReciter = reciterList.find(
        (reciter) => reciter.id === selectedReciterId
      );
      const selectedReciterName = selectedReciter
        ? selectedReciter.title
        : "Unknown Reciter";

      const title = "";
      const text = `لقد تم تحديد القارئ ${selectedReciterName}\n\nالرجاء اختيار سورة من القائمة`;
      const buttonText = "اختيار السورة";

      const listSections = [
        {
          title: "Surahs",
          rows: surahList,
        },
      ];

      await sendList(sock, sender, title, text, buttonText, listSections, msg);

      userState[sender].quran.reciter = selectedReciterId;
      userState[sender].quran.step = "selecting_surah";
      return;
    }

    // Step 3: Handle surah selection
    if (
      msg.message?.interactiveResponseMessage &&
      userState[sender].quran.step === "selecting_surah"
    ) {
      const selectedSurahId = JSON.parse(
        msg.message.interactiveResponseMessage.nativeFlowResponseMessage
          .paramsJson
      ).id;

      const selectedSurahName = surahData[selectedSurahId].name;

      const text = `لقد تم اختيار سورة ${selectedSurahName}\nرجاء قم بإدخال رقم الآية:`;

      userState[sender].quran.surah = selectedSurahId;
      userState[sender].quran.step = "entering_ayah";

      await sock.sendMessage(sender, { text });
      return;
    }

    // Step 4: Handle ayah input
    if (messageContent && userState[sender].quran.step === "entering_ayah") {
      const surahNumber = userState[sender].quran.surah;
      const totalAyahs = surahData[surahNumber].numberOfAyahs;
      const ayahNumber = parseInt(messageContent);

      if (isNaN(ayahNumber) || ayahNumber < 1 || ayahNumber > totalAyahs) {
        await sock.sendMessage(sender, {
          text: `اختيار غير صحيح، الرجاء اختيار آية من 1 إلى ${totalAyahs}.`,
        });
        return;
      }

      // Convert ayah number to three-digit format
      const formattedAyah = ayahNumber.toString().padStart(3, "0");

      // Construct the final URL
      const baseUrl = "https://everyayah.com/data/";
      const finalUrl = `${baseUrl}${userState[sender].quran.reciter}/${surahNumber}${formattedAyah}.mp3`;

      // In your handleMessage function, where you previously constructed the doc object:
      async function downloadAndSaveAudio(url, fileName) {
        const tmpDir = path.join(__dirname, "../tmp");
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const filePath = path.join(tmpDir, fileName);

        try {
          const response = await axios({
            method: "get",
            url: url,
            responseType: "arraybuffer",
          });
          await writeFileAsync(filePath, response.data);
          return filePath;
        } catch (error) {
          console.error("Error downloading file:", error);
          throw error;
        }
      }

      try {
        const fileName = `${surahNumber}${formattedAyah}.mp3`;
        const filePath = await downloadAndSaveAudio(finalUrl, fileName);

        const selectedReciter = reciterList.find(
          (reciter) => reciter.id === userState[sender].quran.reciter
        );

        const reciterName = selectedReciter
          ? selectedReciter.title
          : "Default Name";
        const reciterImageUrl = selectedReciter
          ? selectedReciter.image
          : "https://example.com/default-image.jpg";

        // Get the surah name
        const surahName = surahData[surahNumber].name;

        let doc = {
          audio: {
            url: filePath, // Use the local file path
          },
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${surahName}_${formattedAyah}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: `سورة ${surahName} | الآية ${ayahNumber}`,
              body: reciterName,
              thumbnailUrl: reciterImageUrl,
              sourceUrl: null,
              mediaType: 2,
              renderLargerThumbnail: false,
            },
          },
        };

        await sock.sendMessage(sender, doc);

        // Delete the file after sending
        await unlinkAsync(filePath);
      } catch (error) {
        console.error("Error in audio processing:", error);
        await sock.sendMessage(sender, {
          text: "حدث خطأ. الرجاء المحاولة من جديد",
        });
      }

      // Clear the user state for Quran downloader
      delete userState[sender].quran;
    }
  }
}

export default commands;
