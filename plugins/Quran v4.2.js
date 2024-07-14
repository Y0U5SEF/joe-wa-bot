import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
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
  command: ["quran", "coran", "القرآن الكريم", "القران الكريم", "قران", "قرآن"],
};

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
    // console.log(
    //   "Current user state:",
    //   JSON.stringify(userState[sender], null, 2)
    // );
    // console.log("Received message:", JSON.stringify(msg, null, 2));

    const messageContent = msg.message?.conversation;

    // Step 1: Ask for reciter
    const commandWords = commands.command;
    if (
      commandWords.some((cmd) => messageContent === `${settings.prefix}${cmd}`)
    ) {
      const title = "السلام عليكم 👋";
      const text = `*هذا البوت يمكنك من تحميل القرآن الكريم بصوت أشهر القراء بحيث يمكنك :*
✅ *تحميل سورة كاملة*
✅ *تحميل مجموعة آيات محددة*
✅ *تحميل آية واحدة*

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
      console.log(
        "Updated user state:",
        JSON.stringify(userState[sender], null, 2)
      );
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
      console.log(
        "Updated user state:",
        JSON.stringify(userState[sender], null, 2)
      );

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
        const buttons = [
          ["تحميل السورة كاملة", `whole_surah`],
          ["اختيار مجموعة آيات", `ayah_range`],
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

        console.log(
          "Created interactive message:",
          JSON.stringify(interactiveMessage, null, 2)
        );

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
        console.log("Entering download option selection handler");
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

        console.log("Selected option:", selectedOption);

        switch (selectedOption) {
          case "whole_surah":
            console.log("Whole surah option selected");
            await downloadWholeSurah(
              sock,
              sender,
              userState[sender].quran,
              userState
            );
            break;
          case "ayah_range":
            await sock.sendMessage(sender, {
              text: "الرجاء إدخال نطاق الآيات (مثال: 1-10)",
            });
            userState[sender].quran.step = "entering_ayah_range";
            break;
          case "single_ayah":
            await sock.sendMessage(sender, { text: "الرجاء إدخال رقم الآية:" });
            userState[sender].quran.step = "entering_ayah";
            break;
        }

        return;
      }

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