import chalk from "chalk";
import weather from "weather-js";
import settings from "../settings.js";

const commands = {
  weather: ["weather"],
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
          text: "☀️",
          key: msg.key,
        },
      });
      if (!city) {
        await sock.sendMessage(sender, {
          text: "Please specify a city. Usage: !weather <city>",
        });
        return;
      }

      //   console.log(chalk.green("Fetching weather for: ") + chalk.white(city));
      const weatherInfo = await fetchWeather(city);
      await sock.sendMessage(sender, {
        text: weatherInfo,
      });
      await sock.sendMessage(sender, {
        react: {
          text: "👍",
          key: msg.key,
        },
      });
    }
  }
}

async function fetchWeather(city) {
  return new Promise((resolve, reject) => {
    weather.find({ search: city, degreeType: "C" }, (err, result) => {
      if (err) {
        resolve(`Error fetching weather data: ${err.message}`);
        return;
      }

      if (!result || result.length === 0) {
        resolve(`No weather data found for ${city}`);
        return;
      }

      const weatherData = result[0];
      const { location, current } = weatherData;

      const weatherInfo = `Weather in ${location.name}:
- Temperature: ${current.temperature}°C
- Sky: ${current.skytext}
- Feels like: ${current.feelslike}°C
- Humidity: ${current.humidity}%
- Wind: ${current.winddisplay}
`;

      resolve(weatherInfo);
    });
  });
}
