// console.log("✅ Getting started...");

// import { join, dirname } from "path";
// import { createRequire } from "module";
// import { fileURLToPath } from "url";
// import { setupMaster, fork } from "cluster";
// import { watchFile, unwatchFile } from "fs";
// import { createInterface } from "readline";
// import express from "express";
// import chalk from "chalk";
// import os from "os";
// import { promises as fsPromises } from "fs";

// const __dirname = dirname(fileURLToPath(import.meta.url));
// const require = createRequire(__dirname); // Bring in the ability to create the 'require' method
// const { name, author } = require(join(__dirname, "./package.json")); // https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
// const rl = createInterface(process.stdin, process.stdout);

// const app = express();
// const port = process.env.PORT || 8080;

// app.listen(port, () => {
//   console.log(chalk.green(`🌐 Port ${port} is available`));
// });

// var isRunning = false;

// async function start(file) {
//   if (isRunning) return;
//   isRunning = true;
//   // const currentFilePath = new URL(import.meta.url).pathname;
//   const currentFilePath = fileURLToPath(import.meta.url);
//   let args = [join(__dirname, file), ...process.argv.slice(2)];

//   setupMaster({
//     exec: args[0],
//     args: args.slice(1),
//   });
//   let p = fork();
//   p.on("message", (data) => {
//     console.log("[RECEIVED]", data);
//     switch (data) {
//       case "reset":
//         p.process.kill();
//         isRunning = false;
//         start.apply(this, arguments);
//         break;
//       case "uptime":
//         p.send(process.uptime());
//         break;
//     }
//   });

//   //---
//   console.log(chalk.bold.blue`\n--Server info--`);
//   console.log(
//     chalk.yellow(`\n🖥️  ${os.type()}, ${os.release()} - ${os.arch()}`)
//   );
//   const ramInGB = os.totalmem() / (1024 * 1024 * 1024);
//   console.log(chalk.yellow(`💾 Total RAM: ${ramInGB.toFixed(2)} GB`));
//   const freeRamInGB = os.freemem() / (1024 * 1024 * 1024);
//   console.log(chalk.yellow(`💽 Free RAM: ${freeRamInGB.toFixed(2)} GB`));
//   console.log(chalk.yellow(`📃 Script by Y0U5SEF`));

//   const packageJsonPath = join(dirname(currentFilePath), "./package.json");

//   try {
//     const packageJsonData = await fsPromises.readFile(packageJsonPath, "utf-8");
//     const packageJsonObj = JSON.parse(packageJsonData);
//     console.log(chalk.blue.bold(`\n📦 Package information`));
//     console.log(chalk.cyan(`Bot Name: ${packageJsonObj.name}`));
//     console.log(chalk.cyan(`Version: ${packageJsonObj.version}`));
//     console.log(chalk.cyan(`Description: ${packageJsonObj.description}`));
//     console.log(chalk.cyan(`Author: ${packageJsonObj.author}`));
//   } catch (err) {
//     console.error(chalk.red(`❌ Could not read package.json file: ${err}`));
//   }

//   console.log(chalk.blue.bold(`\n⏰ Current Time`));
//   const currentTime = new Date().toLocaleString();
//   console.log(chalk.cyan(`${currentTime}\n`));

//   setInterval(() => {}, 1000);
// }

// start("Connect.js");

// file: index.js

import express from "express";

console.log("✅ Getting started...");

import { join, dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { setupMaster, fork } from "cluster";
import { watchFile, unwatchFile } from "fs";
import { createInterface } from "readline";
import chalk from "chalk";
import os from "os";
import { promises as fsPromises } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname); // Bring in the ability to create the 'require' method
const { name, author } = require(join(__dirname, "./package.json")); // https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
const rl = createInterface(process.stdin, process.stdout);

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(chalk.green(`🌐 Port ${port} is available`));
});

// Define routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

var isRunning = false;

async function start(file) {
  if (isRunning) return;
  isRunning = true;
  // const currentFilePath = new URL(import.meta.url).pathname;
  const currentFilePath = fileURLToPath(import.meta.url);
  let args = [join(__dirname, file), ...process.argv.slice(2)];

  setupMaster({
    exec: args[0],
    args: args.slice(1),
  });
  let p = fork();
  p.on("message", (data) => {
    console.log("[RECEIVED]", data);
    switch (data) {
      case "reset":
        p.process.kill();
        isRunning = false;
        start.apply(this, arguments);
        break;
      case "uptime":
        p.send(process.uptime());
        break;
    }
  });

  //---
  console.log(chalk.bold.blue`\n--Server info--`);
  console.log(
    chalk.yellow(`\n🖥️  ${os.type()}, ${os.release()} - ${os.arch()}`)
  );
  const ramInGB = os.totalmem() / (1024 * 1024 * 1024);
  console.log(chalk.yellow(`💾 Total RAM: ${ramInGB.toFixed(2)} GB`));
  const freeRamInGB = os.freemem() / (1024 * 1024 * 1024);
  console.log(chalk.yellow(`💽 Free RAM: ${freeRamInGB.toFixed(2)} GB`));
  console.log(chalk.yellow(`📃 Script by Y0U5SEF`));

  const packageJsonPath = join(dirname(currentFilePath), "./package.json");

  try {
    const packageJsonData = await fsPromises.readFile(packageJsonPath, "utf-8");
    const packageJsonObj = JSON.parse(packageJsonData);
    console.log(chalk.blue.bold(`\n📦 Package information`));
    console.log(chalk.cyan(`Bot Name: ${packageJsonObj.name}`));
    console.log(chalk.cyan(`Version: ${packageJsonObj.version}`));
    console.log(chalk.cyan(`Description: ${packageJsonObj.description}`));
    console.log(chalk.cyan(`Author: ${packageJsonObj.author}`));
  } catch (err) {
    console.error(chalk.red(`❌ Could not read package.json file: ${err}`));
  }

  console.log(chalk.blue.bold(`\n⏰ Current Time`));
  const currentTime = new Date().toLocaleString();
  console.log(chalk.cyan(`${currentTime}\n`));

  setInterval(() => {}, 1000);
}

start("Connect.js");
