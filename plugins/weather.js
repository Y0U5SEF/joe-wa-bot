import WeatherMSN from "msn-weather-api";
import settings from "../settings.js";

const commands = {
  weather: ["weather", "طقس"],
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
    const city = parts.slice(1).join(" ");

    if (commands.weather.includes(command)) {
      await sock.sendMessage(sender, {
        react: {
          text: "⏳",
          key: msg.key,
        },
      });
      if (!city) {
        await sock.sendMessage(sender, {
          text: `كتب كلمة ${settings.prefix}طقس وتبع ليها المدينة لي بغيتي`,
        });
        return;
      }

      //   console.log(chalk.green("Fetching weather for: ") + chalk.white(city));
      try {
        const weatherInfo = await fetchWeather(city);
        await sock.sendMessage(sender, {
          text: weatherInfo,
        });
        await sock.sendMessage(sender, {
          react: {
            text: "✅",
            key: msg.key,
          },
        });
      } catch (error) {
        await sock.sendMessage(sender, {
          text: "There was an error fetching the weather. Please try again later.",
        });
      }
    }
  }
}

const weather = new WeatherMSN("ar", "c");

async function fetchWeather(city) {
  try {
    const current = await weather.getCurrentData(city);
    // const ForecastData = await weather.getForecastData(city);
    // console.log(ForecastData.icon);

    return `${settings.RTL}╮────────────────
│ _حالة الطقس في ${current.location}._
${settings.RTL}╯────────────────
${settings.RTL}┥🌤️ الحالة: *${current.weather}*
${settings.RTL}┥🌡️ درجة الحرارة: ${settings.LTR}*${current.temperature} °C*
${settings.RTL}┥💧 نسبة الرطوبة: *${current.humidity}*
${settings.RTL}┥💨 سرعة الرياح: *${current.windspeed}*
${settings.RTL}╯────────────────`;
  } catch (error) {
    throw new Error("Failed to fetch weather data.");
  }
}