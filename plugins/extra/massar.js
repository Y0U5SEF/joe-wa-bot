import chalk from "chalk";
import * as baileys from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encode, decode } from "node-base64-image";
import { createSticker, StickerTypes } from "wa-sticker-formatter";
import { firefox } from "playwright";
import settings from "../settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userSessions = {};
let activeTask = false;

const commands = {
  massar: ["massar"],
};

export async function handleMessage(sock, msg) {
  const messageBody =
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  const sender = msg.key.remoteJid;

  if (messageBody.toLowerCase().startsWith(`${settings.prefix}massar`)) {
    userSessions[sender] = { step: "askStudentNumber" };
    if (userSessions[sender].browser) {
      try {
        await userSessions[sender].browser.close();
        console.log("Existing browser instance closed.");
      } catch (error) {
        console.error("Error closing browser instance:", error);
      }
    }
    await sock.sendMessage(sender, { text: "*عطيني الرقم ديال مسار ديالك*" });
  } else if (userSessions[sender]) {
    await handleUserSession(sock, sender, messageBody);
  }
}

// Include all the functions from the original script here:
// validateStudentNumber, handleUserSession, handleStudentCredentials,
// handleTaskSelection, fetchGrades, getUserInput, AddPhoneNumber,
// handleUserResponse, validatePhoneNumber

// Example of including one function:
function validateStudentNumber(studentNumber) {
  const regex = /^[\p{L}]\d{9}$/u;
  const isValid = regex.test(studentNumber);
  console.log(
    `Student number ${studentNumber} is ${isValid ? "valid" : "invalid"}`
  );
  return isValid;
}
async function handleUserSession(sock, from, text) {
  switch (userSessions[from].step) {
    case "askStudentNumber":
      if (validateStudentNumber(text)) {
        userSessions[from].studentNumber = text;
        userSessions[from].step = "askPassword";
        await sock.sendMessage(from, { text: "*عطيني كلمة السر*" });
      } else {
        await sock.sendMessage(from, {
          text: "*الرقم ديال مسار لي عطيتيني غالط. عفاك عطيني رقم مسار لي بحال هاد الشكل (X123456789)*",
        });
      }
      break;
    case "askPassword":
      userSessions[from].password = text;
      userSessions[from].step = "fetchData";
      await handleStudentCredentials(sock, from);
      break;
    case "taskSelection":
      await handleTaskSelection(sock, from, text);
      break;
  }
}
async function handleStudentCredentials(sock, from) {
  let browser = userSessions[from].browser || null;
  let context = userSessions[from].context || null;

  try {
    const studentNumber = userSessions[from].studentNumber.toUpperCase();
    const username = `${studentNumber}@taalim.ma`;
    const password = userSessions[from].password;

    if (!browser || !browser.isConnected()) {
      console.log("Launching browser...");
      browser = await firefox.launch({
        headless: false,
        executablePath: process.env.CHROME_BIN,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      context = await browser.newContext();
      userSessions[from].browser = browser;
      userSessions[from].context = context;
    }

    const LoginPage = await context.newPage();
    await LoginPage.goto("https://waliye.men.gov.ma/moutamadris/Account", {
      waitUntil: "load",
    });

    await LoginPage.fill('input[name="UserName"]', username);
    await LoginPage.fill('input[name="Password"]', password);
    console.log("Username:", username);
    console.log("Password:", password);
    await LoginPage.click("#btnSubmit");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await LoginPage.goto("https://waliye.men.gov.ma/moutamadris/Dashboard", {
      waitUntil: "load",
    });

    let loginSuccessful = false;
    let welcomeText = "";

    try {
      welcomeText = await LoginPage.$eval(
        ".welcomeWrapper .welcome .welcomeUser",
        (el) => el.textContent.trim()
      );
      loginSuccessful = true;
      // console.log("Welcome text:", welcomeText);
    } catch (error) {
      loginSuccessful = false;
      console.log("Welcome text element not found.");
    }

    if (loginSuccessful) {
      const nameParts = welcomeText
        .split(" ")
        .slice(1)
        .join(" ")
        .replace(/,$/, "");
      userSessions[from].step = "taskSelection";
      userSessions[from].LoginPage = LoginPage; // Store the login page
      try {
        await LoginPage.waitForSelector(".avatar img");
        // console.log("Avatar image selector found");
        const imageBase64 = await LoginPage.evaluate(() => {
          const imgElement = document.querySelector(".avatar img");
          return imgElement ? imgElement.src : null;
        });
        console.log(chalk.yellow("Extracted image base64"));
        if (imageBase64) {
          const url = imageBase64;
          const options = {
            string: true,
            headers: {
              "User-Agent": "my-app",
            },
          };
          const image = await encode(url, options);
          await decode(image, { fname: "avatar", ext: "jpg" });
          const StickerLocation = "avatar.jpg";
          const stickerMetadata = {
            type: StickerTypes.ROUNDED,
            pack: "MASSAR BOT",
            author: "@ussef.elabassi",
            categories: ["🌹"],
            quality: 5,
          };
          await sock.sendMessage(from, { text: `👋 *أهلا ${nameParts}*` });
          await new Promise((resolve) => setTimeout(resolve, 500));
          const sticker = await createSticker(StickerLocation, stickerMetadata);
          if (sticker) {
            await sock.sendMessage(from, { sticker });
          }
        } else {
          throw new Error("Image not found");
        }
      } catch (error) {
        await sock.sendMessage(from, { text: `👋 *أهلا ${nameParts}*` });
      }
      await sock.sendMessage(from, {
        text: `‏╮──────────────────────
  *سيفط الرقم ديال شنو بغيتي من هادشي:*
  ‏┤──────────────────────
  ‏││
  │┤1️⃣ *إضافة رقم الهاتف*
  │┤2️⃣ *تتبع النقط*
  ‏││
  ‏╯──────────────────────`,
      });
    } else {
      const errorMessage = await LoginPage.$eval(
        ".validation-summary-errors li",
        (el) => el.textContent.trim()
      );
      console.log("Login error message:", errorMessage);
      await sock.sendMessage(from, { text: `*${errorMessage}*` });
      userSessions[from].step = "askStudentNumber";
    }
  } catch (error) {
    console.log(chalk.red("An error occurred:"), error.message);
    await sock.sendMessage(from, { text: error.message });
    userSessions[from].step = "askStudentNumber";
  }
}

async function handleTaskSelection(sock, from, text) {
  if (activeTask) {
    // If a task is already active, return without doing anything
    return;
  }

  // Set the flag to true to indicate that a task is now active
  activeTask = true;

  const choice = parseInt(text);

  switch (choice) {
    case 1:
      await AddPhoneNumber(sock, from);
      break;
    //     case 1:
    //       await sock.sendMessage(from, {
    //         text: `
    // .هاد اللعيبة مزال مصايبتهاش. ختار شي خاصية أخرى

    // للتواصل مع المطور
    // insta: @ussef.elabassi
    // `,
    //       });
    //       await getConvocation(sock, from);
    //       break;
    case 2:
      // await sock.sendMessage(from, { text: "_*صبر نجيب ليك النقط*_" });
      await fetchGrades(sock, from);
      break;
    //     case 3:
    //       await sock.sendMessage(from, {
    //         text: `
    // .هاد اللعيبة مزال مصايبتهاش. ختار شي خاصية أخرى

    // للتواصل مع المطور
    // insta: @ussef.elabassi
    // `,
    //       });
    //       // Add your code to fetch and send the absence information
    //       break;
    //     case 4:
    //       await sock.sendMessage(from, {
    //         text: `
    // .هاد اللعيبة مزال مصايبتهاش. ختار شي خاصية أخرى

    // للتواصل مع المطور
    // insta: @ussef.elabassi
    // `,
    //       });
    //       // Add your code to fetch and send the exams schedule
    //       break;
    default:
      await sock.sendMessage(from, {
        text: "_*سيفط رقم من الأرقام لي فالقائمة*_",
      });
      break;
  }

  // Reset the flag to indicate that the task is finished
  activeTask = false;
}

async function fetchGrades(sock, from) {
  const browser = userSessions[from].browser;
  const LoginPage = userSessions[from].LoginPage;
  try {
    console.log("Navigating to marks page...");
    await LoginPage.goto(
      "https://waliye.men.gov.ma/moutamadris/TuteurEleves/GetNotesEleve",
      { waitUntil: "load" }
    );

    // await LoginPage.screenshot({ path: "viewport.png", type: "png" });

    console.log("Marks page loaded.");

    // Wait for both select elements to be available
    await LoginPage.waitForSelector("#SelectedAnnee");
    await LoginPage.waitForSelector("#SelectedSession");

    // Get the options from the first select element (academicYearOptions)
    const academicYearOptions = await LoginPage.evaluate(() => {
      const selectElement = document.querySelector("#SelectedAnnee");
      const optionElements = Array.from(selectElement.options);
      return optionElements.map((option) => option.innerText.trim());
    });

    // Get the options from the second select element (semesterOptions)
    const semesterOptions = await LoginPage.evaluate(() => {
      const selectElement = document.querySelector("#SelectedSession");
      const optionElements = Array.from(selectElement.options);
      const filteredOptions = optionElements.filter(
        (option) => option.value !== "3"
      );
      return filteredOptions.map((option) => option.innerText.trim());
    });

    const academicYearSelect = await LoginPage.$("#SelectedAnnee");
    const semesterSelect = await LoginPage.$("#SelectedSession");

    const academicYearList = academicYearOptions
      .slice(1)
      .map((option, index) => `${index + 1}️⃣ ${option}`)
      .join("\n");
    await sock.sendMessage(from, {
      text: `*اختار السنة الدراسية:*\n\n${academicYearList}`,
    });

    const academicYearChoice = await getUserInput(sock, from);
    const selectedAcademicYear = academicYearOptions[academicYearChoice];
    await academicYearSelect.selectOption(selectedAcademicYear);
    console.log(`Season: ${selectedAcademicYear}`);

    const semesterList = semesterOptions
      .slice(1)
      .map((option, index) => `${index + 1}️⃣ ${option}`)
      .join("\n");
    await sock.sendMessage(from, {
      text: `*اختار الدورة:*\n\n${semesterList}`,
    });

    const semesterChoice = await getUserInput(sock, from);
    const selectedSemester = semesterOptions[semesterChoice];
    await semesterSelect.selectOption(selectedSemester);
    console.log(`Semester: ${selectedSemester}`);

    console.log("Clicking search button...");
    const searchButton = await LoginPage.$("#btnSearchNotes");
    await searchButton.click();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // await LoginPage.screenshot({ path: "check1.png" });

    try {
      const fullDetailsTab = await LoginPage.$('a[href="#tab_notes_exam"]');
      await fullDetailsTab.click();
      await LoginPage.waitForSelector("#tab_notes_exam");

      const marksData = await LoginPage.evaluate(() => {
        const rows = document.querySelectorAll(
          "#tab_notes_exam table tbody tr"
        );
        const subjects = [];
        rows.forEach((row) => {
          const cells = row.querySelectorAll("td");
          const subjectName = cells[0].innerText.trim();
          const mark = cells[1].innerText.trim();
          subjects.push({ subjectName, mark });
        });

        const averageMarkElement = document.querySelector(
          "#tab_notes_exam div:nth-child(2) div:nth-child(1) span"
        );
        const averageMark = averageMarkElement
          ? averageMarkElement.innerText.trim()
          : "❌";

        const examAverageMarkElement = document.querySelector(
          "#tab_notes_exam div:nth-child(2) div:nth-child(2) span"
        );
        const examAverageMark =
          examAverageMarkElement && examAverageMarkElement.innerText.trim()
            ? examAverageMarkElement.innerText.trim()
            : "❌";

        return { subjects, averageMark, examAverageMark };
      });

      const formattedData = `‏╮──────────────────
  │ 📊 *نقط المراقبة المستمرة*
  ‏┤──────────────────
  ${marksData.subjects
    .map((subject) => `│┤ 📒 ${subject.subjectName}:   *${subject.mark}*`)
    .join("\n")}
  ‏╯──────────────────
  ‏╮──────────────────
  │ ✒️ *معدل الدورة*: *${marksData.averageMark}*
  ‏╯──────────────────
  ‏╮──────────────────
  │ ✒️ *معدل الامتحان*: *${marksData.examAverageMark}*
  ‏╯──────────────────`;

      await sock.sendMessage(from, { text: formattedData });
    } catch (error) {
      console.error("Error fetching the data:", error);
      await sock.sendMessage(from, { text: "Error" });
    }

    try {
      const BayanNataij = await LoginPage.$('a[href="#tab_chart"]');
      await BayanNataij.click();
      await LoginPage.waitForSelector("#chart");
      // Get the element handle
      const element = await LoginPage.$("#chart"); // Replace with your element's selector
      // Take a screenshot of the element
      const screenshotPath = "chart.png";
      await element.screenshot({ path: screenshotPath });
      //
      // const media = MessageMedia.fromFilePath(screenshotPath);
      // const options = {
      //     caption: 'بيان النتائج الدراسية',
      //     mimetype: Mimetype.jpeg,
      // };
      // send the screenshot
      await sock.sendMessage(from, {
        image: { url: screenshotPath },
        caption: "بيان النتائج الدراسية",
      });
      // Clean up screenshot file
      fs.unlinkSync(screenshotPath);
    } catch (error) {}
  } catch (error) {
    console.log(chalk.red("An error occurred:"), error.message);
    await sock.sendMessage(from, { text: error.message });
  } finally {
    // await browser.close();
    // console.log(chalk.red.bgCyan.bold("Browser closed."));
  }
}

async function getUserInput(sock, from) {
  return new Promise((resolve) => {
    const getUserInputListener = async (m) => {
      if (
        m.messages[0].key.remoteJid === from &&
        m.messages[0].message.conversation
      ) {
        // Check if there's no active task before processing the input
        if (activeTask) {
          const choice = parseInt(m.messages[0].message.conversation);
          if (!isNaN(choice)) {
            sock.ev.off("messages.upsert", getUserInputListener);
            resolve(choice);
          } else {
            await sock.sendMessage(from, {
              text: "Error, please type a valid number",
            });
          }
        } else {
          await sock.sendMessage(from, {
            text: "There is no task currently in progress.",
          });
        }
      }
    };

    sock.ev.on("messages.upsert", getUserInputListener);
  });
}

async function AddPhoneNumber(sock, fromUser) {
  const browser = userSessions[fromUser].browser;
  const LoginPage = userSessions[fromUser].LoginPage;
  try {
    await LoginPage.goto(
      "https://waliye.men.gov.ma/moutamadris/TuteurEleves/GetInfoEleve",
      { waitUntil: "load" }
    );

    // Wait for the select element to be available
    await LoginPage.waitForSelector("#Operateur");

    // Get the options from the select element
    const Operators = await LoginPage.evaluate(() => {
      const SelectOperatorElement = document.querySelector("#Operateur");
      const OperatorOptionElements = Array.from(SelectOperatorElement.options);
      return OperatorOptionElements.map((option) => ({
        text: option.innerText.trim(),
        value: option.value,
      }));
    });

    const OperatorsList = Operators.slice(1, -1)
      .map((option, index) => `${index + 1}️⃣ ${option.text}`)
      .join("\n");
    await sock.sendMessage(fromUser, {
      text: `*اختر مزود الخدمة ديالك:*\n\n${OperatorsList}`,
    });

    const OperatorSelect = await LoginPage.$("#Operateur");

    const OperatorChoice = await getUserInput(sock, fromUser);
    const SelectedOperator = Operators[OperatorChoice - 1].value;
    await OperatorSelect.selectOption(SelectedOperator);
    console.log(`Operator Chosen: ${Operators[OperatorChoice - 1].text}`);

    await LoginPage.screenshot({
      path: "full_page_screenshot.png",
      fullPage: true,
    });

    // Update the user session step after selecting the operator
    userSessions[fromUser].step = "askStudentPhoneNumber";

    await sock.sendMessage(fromUser, { text: "*دابا عطيني النمرة*" });
  } catch (error) {
    console.error("Error in AddPhoneNumber function:", error);
  }
}

async function handleUserResponse(sock, fromUser, text) {
  switch (userSessions[fromUser].step) {
    case "askStudentPhoneNumber":
      const phoneNumber = await getUserInput(sock, fromUser);
      if (validatePhoneNumber(phoneNumber)) {
        userSessions[fromUser].phoneNumber = phoneNumber;
      } else {
        await sock.sendMessage(fromUser, {
          text: "عطيني اصاحبي نمرة مقادة",
        });
      }
      break;
    default:
      await sock.sendMessage(fromUser, {
        text: "_*سيفط رقم من الأرقام لي فالقائمة*_",
      });
      break;
  }
}

function validatePhoneNumber(phoneNumber) {
  // Remove any non-digit characters from the input
  const cleanedNumber = phoneNumber.replace(/\D/g, "");
  // Check if the cleaned number has exactly 10 digits
  if (cleanedNumber.length === 10) {
    console.log(chalk.greenBright(`Valid phone number: ${phoneNumber}`));
    return true; // Return true for a valid phone number
  } else {
    console.log(chalk.redBright(`Invalid phone number: ${phoneNumber}`));
    return false; // Return false for an invalid phone number
  }
}

// ... Include all other functions here ...

// Remove the connectToWhatsApp function and any other connection-related code

// Export the necessary functions and objects
export { userSessions, activeTask };
