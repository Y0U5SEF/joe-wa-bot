import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import settings from "../settings.js";
import { reciterList, surahList, surahData } from "../lib/quranData.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import chalk from "chalk";
import ffmpeg from 'fluent-ffmpeg';
import { Mixer } from 'audio-mixer';
import wav from 'node-wav';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = {
  command: ["quran", "Quran", "coran", "القرآن الكريم", "القران الكريم", "قران", "قرآن"],
};

// Download whole surah
async function downloadWholeSurah(sock, sender, quranState, userState) {
  console.log(`Starting downloadWholeSurah for sender: ${sender}`);
  console.log(`Quran state:`, quranState);

  const reciter = reciterList.find((r) => r.id === quranState.reciter);
  const surahNumber = quranState.surah.toString().padStart(3, "0");

  console.log(`Selected reciter:`, reciter);
  console.log(`Surah number: ${surahNumber}`);

  if (!reciter || !reciter.mp3quran) {
    console.log(`Error: Reciter not found or missing mp3quran property`);
    await sock.sendMessage(sender, {
      text: "عذرًا، لا يمكن تحميل السورة كاملة لهذا القارئ.",
    });
    return;
  }

  const url = `https://download.ourquraan.com/${reciter.mp3quran}/${surahNumber}.mp3`;

  console.log(`Download URL: ${url}`);

  try {
    console.log(`Sending initial message to user...`);
    await sock.sendMessage(sender, {
      text: `⏳ ${settings.Wait}`,
    });

    console.log(`Starting download...`);
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
    });
    console.log(`Download completed. Response status: ${response.status}`);

    const tmpDir = path.join(__dirname, "../tmp");
    console.log(`Temporary directory: ${tmpDir}`);
    if (!fs.existsSync(tmpDir)) {
      console.log(`Creating temporary directory...`);
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const fileName = `${surahNumber}_full.mp3`;
    const filePath = path.join(tmpDir, fileName);
    console.log(`Saving file to: ${filePath}`);

    await writeFileAsync(filePath, response.data);
    console.log(`File saved successfully`);

    const surahName = surahData[quranState.surah].name;
    console.log(`Surah name: ${surahName}`);

    const reciterImageUrl = reciter
      ? reciter.image
      : "https://placehold.co/400x400/png";

    let doc = {
      audio: {
        url: filePath,
      },
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${surahName}_full.mp3`,
      contextInfo: {
        externalAdReply: {
          title: `سورة ${surahName}`,
          body: reciter.title,
          thumbnailUrl: reciterImageUrl,
          sourceUrl: null,
          mediaType: 2,
          renderLargerThumbnail: false,
        },
      },
    };

    console.log(`Sending audio message to user...`);
    await sock.sendMessage(sender, doc);
    console.log(`Audio message sent successfully`);

    console.log(`Deleting temporary file...`);
    await unlinkAsync(filePath);
    console.log(`Temporary file deleted`);

    console.log(`Resetting user state...`);
    delete userState[sender].quran;
    console.log(`User state reset`);
  } catch (error) {
    console.error("Error in downloadWholeSurah:", error);
    console.log(`Sending error message to user...`);
    await sock.sendMessage(sender, {
      text: "حدث خطأ أثناء تحميل السورة. الرجاء المحاولة مرة أخرى.",
    });
  }

  console.log(`downloadWholeSurah completed for sender: ${sender}`);
}

// Download One Ayah
async function singleAyah(sock, sender, quranState, userState, ayahNumber) {
  const reciter = reciterList.find((r) => r.id === quranState.reciter);
  const surahNumber = quranState.surah.toString().padStart(3, "0");
  const formattedAyah = ayahNumber.toString().padStart(3, "0");

  // Get the total number of ayahs for the selected surah
  const totalAyahs = surahData[surahNumber].numberOfAyahs;

  // Validate the ayahNumber
  if (isNaN(ayahNumber) || ayahNumber < 1 || ayahNumber > totalAyahs) {
    await sock.sendMessage(sender, {
      text: `اختيار غير صحيح، الرجاء اختيار آية من 1 إلى ${totalAyahs}.`,
    });
    return;
  }

  if (!reciter || !reciter.id) {
    await sock.sendMessage(sender, {
      text: "عذرًا، لا يمكن تحميل الآية لهذا القارئ.",
    });
    return;
  }

  const url = `https://everyayah.com/data/${reciter.id}/${surahNumber}${formattedAyah}.mp3`;
  // console.log(chalk.bgRed.bold.yellow(url));

  try {
    await sock.sendMessage(sender, {
      text: `⏳ ${settings.Wait}`,
    });

    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
    });

    const tmpDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const fileName = `${surahNumber}${formattedAyah}.mp3`;
    const filePath = path.join(tmpDir, fileName);

    await writeFileAsync(filePath, response.data);

    const surahName = surahData[surahNumber].name;
    const reciterImageUrl = reciter
      ? reciter.image
      : "https://placehold.co/400x400/png";

    let doc = {
      audio: {
        url: filePath,
      },
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${surahName}_${formattedAyah}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: `سورة ${surahName} | الآية ${ayahNumber}`,
          body: reciter.title,
          thumbnailUrl: reciterImageUrl,
          sourceUrl: null,
          mediaType: 2,
          renderLargerThumbnail: false,
        },
      },
    };

    await sock.sendMessage(sender, doc);
    await unlinkAsync(filePath);

    delete userState[sender].quran;
  } catch (error) {
    console.error("Error in singleAyah:", error);
    await sock.sendMessage(sender, {
      text: "حدث خطأ أثناء تحميل الآية. الرجاء المحاولة مرة أخرى.",
    });
  }
}


// Download a range of ayat
// async function ayahRange(sock, sender, quranState, userState, range) {
//   const [startAyah, endAyah] = range.split("-").map(Number);
//   const reciter = reciterList.find((r) => r.id === quranState.reciter);
//   const surahNumber = quranState.surah.toString().padStart(3, "0");

//   if (!reciter || !reciter.id || isNaN(startAyah) || isNaN(endAyah)) {
//     await sock.sendMessage(sender, {
//       text: "عذرًا، لا يمكن تحميل الآيات لهذا القارئ.",
//     });
//     return;
//   }

//   const tmpDir = path.join(__dirname, "../tmp");
//   if (!fs.existsSync(tmpDir)) {
//     await fs.mkdir(tmpDir, { recursive: true });
//   }

//   const audioFiles = [];
//   try {
//     await sock.sendMessage(sender, {
//       text: `⏳ ${settings.Wait}`,
//     });

//     for (let i = startAyah; i <= endAyah; i++) {
//       const formattedAyah = i.toString().padStart(3, "0");
//       const url = `https://everyayah.com/data/${reciter.id}/${surahNumber}${formattedAyah}.mp3`;
//       console.log(url);

//       const response = await axios({
//         method: "get",
//         url: url,
//         responseType: 'arraybuffer'
//       });

//       const fileName = `${surahNumber}${formattedAyah}.wav`;
//       const filePath = path.join(tmpDir, fileName);

//       // Convert MP3 to WAV (this is a simplified conversion and may not work for all MP3s)
//       const wavData = wav.encode([new Float32Array(response.data)], {
//         sampleRate: 44100,
//         float: true,
//         bitDepth: 32
//       });

//       await fs.writeFile(filePath, Buffer.from(wavData));
//       audioFiles.push(filePath);
//     }

//     const outputFilePath = path.join(tmpDir, `${surahNumber}_${startAyah}-${endAyah}.wav`);

//     // Merge audio files
//     const mixer = new Mixer({
//       channels: 1,
//       bitDepth: 32,
//       sampleRate: 44100,
//       clearInterval: 250
//     });

//     for (const file of audioFiles) {
//       const input = await fs.readFile(file);
//       const decoded = wav.decode(input);
//       mixer.input({
//         sampleRate: decoded.sampleRate,
//         channels: decoded.channelData.length,
//         bitDepth: decoded.bitDepth,
//         buffer: () => {
//           const chunk = decoded.channelData[0].slice(0, 4096);
//           decoded.channelData[0] = decoded.channelData[0].slice(4096);
//           return chunk.length ? chunk : null;
//         }
//       });
//     }

//     const outputStream = fs.createWriteStream(outputFilePath);
//     mixer.pipe(outputStream);

//     await new Promise((resolve) => {
//       outputStream.on('finish', resolve);
//     });

//     const surahName = surahData[quranState.surah].name;
//     const reciterImageUrl = reciter
//       ? reciter.image
//       : "https://placehold.co/400x400/png";

//     let doc = {
//       audio: {
//         url: outputFilePath,
//       },
//       mimetype: "audio/wav",
//       ptt: false,
//       fileName: `${surahName}_${startAyah}-${endAyah}.wav`,
//       contextInfo: {
//         externalAdReply: {
//           title: `سورة ${surahName} | الآيات ${startAyah} إلى ${endAyah}`,
//           body: reciter.title,
//           thumbnailUrl: reciterImageUrl,
//           sourceUrl: null,
//           mediaType: 2,
//           renderLargerThumbnail: false,
//         },
//       },
//     };

//     await sock.sendMessage(sender, doc);

//     // Clean up temporary files
//     for (const file of audioFiles) {
//       await fs.unlink(file);
//     }
//     await fs.unlink(outputFilePath);

//     delete userState[sender].quran;
//   } catch (error) {
//     console.error("Error in ayahRange:", error);
//     await sock.sendMessage(sender, {
//       text: "حدث خطأ أثناء تحميل الآيات. الرجاء المحاولة مرة أخرى.",
//     });

//     // Clean up temporary files in case of error
//     for (const file of audioFiles) {
//       await fs.unlink(file).catch(() => {});
//     }
//   }
// }

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
  if (!userState[sender]) {
    userState[sender] = {};
  }

  try {
    const messageContent = msg.message?.conversation;

    // Step 1: Ask for reciter
    const commandWords = commands.command;
    if (
      commandWords.some((cmd) => messageContent === `${settings.prefix}${cmd}`)
    ) {
      const title = "السلام عليكم 👋";
      const text = `*هذا البوت يمكنك من تحميل القرآن الكريم بصوت أشهر القراء بحيث يمكنك :*
✅ *تحميل سورة كاملة*
✅ *تحميل آية محددة*

*لا تنسونا من دعائكم لوالدي بالرحمة والمغفرة لعلكم أقرب إلى الله منزلة* ❤️

Buy me a coffee
https://www.buymeacoffee.com/Y0U5SEF`;
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
        const text = `لقد تم تحديد القارئ *${selectedReciterName}*`;
        const buttonText = "اختيار سورة";

        const listSections = [
          {
            title: "Surahs",
            rows: surahList,
          },
        ];

        await sendList(
          sock,
          sender,
          title,
          text,
          buttonText,
          listSections,
          msg
        );
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

        const text = `لقد تم اختيار سورة *${selectedSurahName}*`;

        userState[sender].quran.surah = selectedSurahId;
        userState[sender].quran.step = "selecting_download_option";

        // Define the buttons
        // const buttons = [
        //   ["تحميل السورة كاملة", `whole_surah`],
        //   ["اختيار مجموعة آيات", `ayah_range`],
        //   ["تحميل آية واحدة", `single_ayah`],
        // ];
        const buttons = [
          ["تحميل السورة كاملة", `whole_surah`],
          ["تحميل آية واحدة", `single_ayah`],
        ];

        const dynamicButtons = buttons.map((btn) => ({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: btn[0],
            id: btn[1],
          }),
        }));

        const interactiveMessage = {
          body: { text },
          footer: { text: "" },
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

        await sock.relayMessage(sender, msgL.message, {
          messageId: msgL.key.id,
        });

        return;
      }

      // Handle download option selection
      if (
        (msg.message?.interactiveResponseMessage ||
          msg.message?.buttonsResponseMessage ||
          msg.message?.templateButtonReplyMessage) &&
        userState[sender].quran.step === "selecting_download_option"
      ) {
        let selectedOption;

        if (msg.message?.interactiveResponseMessage) {
          selectedOption = JSON.parse(
            msg.message.interactiveResponseMessage.nativeFlowResponseMessage
              .paramsJson
          ).id;
        } else if (msg.message?.buttonsResponseMessage) {
          selectedOption = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message?.templateButtonReplyMessage) {
          selectedOption = msg.message.templateButtonReplyMessage.selectedId;
        }

        switch (selectedOption) {
          case "whole_surah":
            await downloadWholeSurah(
              sock,
              sender,
              userState[sender].quran,
              userState
            );
            break;
          // case "ayah_range":
          //   await sock.sendMessage(sender, {
          //     text: "الرجاء إدخال نطاق الآيات (مثال: 1-10)",
          //   });
          //   userState[sender].quran.step = "entering_ayah_range";

          //   break;
          case "single_ayah":
            await sock.sendMessage(sender, { text: "الرجاء إدخال رقم الآية:" });
            userState[sender].quran.step = "entering_ayah";
            break;
        }

        return;
      }

      // Handle single ayah input
      if (userState[sender].quran.step === "entering_ayah") {
        const ayahNumber = parseInt(messageContent.trim(), 10);
        if (!isNaN(ayahNumber)) {
          await singleAyah(
            sock,
            sender,
            userState[sender].quran,
            userState,
            ayahNumber
          );
        } else {
          await sock.sendMessage(sender, {
            text: "الرجاء إدخال رقم آية صحيح.",
          });
        }
        return;
      }

// Handle ayah range input
// if (userState[sender].quran.step === "entering_ayah_range") {
//   const range = messageContent.trim();
//   const [start, end] = range.split('-').map(num => parseInt(num, 10));
  
//   if (!isNaN(start) && !isNaN(end) && start <= end) {
//     await ayahRange(sock, sender, userState[sender].quran, userState, range);
//   } else {
//     await sock.sendMessage(sender, {
//       text: "الرجاء إدخال نطاق آيات صحيح (مثال: 1-10).",
//     });
//   }
//   return;
// }

      // Handle ayah range input (not implemented in your provided code)
      // Add your logic for handling ayah range input here

      // Clear the user state for Quran downloader
      delete userState[sender].quran;
    }
  } catch (error) {
    console.error("Error in handleMessage:", error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `An error occurred.\n${error}`,
    });
  }
}

export default { handleMessage, commands };
