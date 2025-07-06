require("dotenv").config();
const { Client } = require("revolt.js");
const fetch = require("node-fetch");
const psListImport = require("ps-list");
const psList = psListImport.default || psListImport;
const fs = require("fs");
const path = require("path");

const client = new Client();
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS);

const gamesPath = path.join(__dirname, "games.json"); // Update to an API at some point and allow developers to add their own applications??
const games = JSON.parse(fs.readFileSync(gamesPath, "utf-8"));

const config = {
  enableLastfm: process.env.ENABLE_LASTFM === "true",
  enableGameDetection: process.env.ENABLE_GAME_DETECTION === "true",
  defaultStatusText: process.env.DEFAULT_STATUS_TEXT || "Just chilling 😎",
  defaultPresence: process.env.DEFAULT_PRESENCE || "Online",
  emoji: {
    music: process.env.STATUS_EMOJI_MUSIC || "🎧",
    game: process.env.STATUS_EMOJI_GAME || "🎮"
  },
  lastfm: {
    username: process.env.LASTFM_USERNAME,
    apiKey: process.env.LASTFM_API_KEY
  }
};

async function getNowPlaying(username) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.lastfm.apiKey}&format=json&limit=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const track = data.recenttracks?.track?.[0];

    if (!track || track["@attr"]?.nowplaying !== "true") return null;

    const song = `${track.name} - ${track.artist["#text"]}`;
    return `${config.emoji.music} Listening: ${song}`;
  } catch (err) {
    console.error("❌ Failed to fetch Last.fm data:", err);
    return null;
  }
}

async function detectRunningGame() {
  try {
    const processes = await psList();
    const sysInfo = await si.processes();

    for (const proc of processes) {
      const exe = proc.name.toLowerCase();

      if (exe === "code.exe") {
        const cmd = proc.cmd || "";
        const parts = cmd.split(/["\s]/).filter(p => p);
        const projectPath = parts.find(p =>
          p &&
          !p.toLowerCase().includes("code.exe") &&
          fs.existsSync(p) &&
          fs.lstatSync(p).isDirectory()
        );
        // I honestly don't know why this isn't detecting what you're actually doing, I am probably just dumb, I'll revisit this later
        const folderName = projectPath ? path.basename(projectPath) : "Amazing Projects";
        if (currentGameExe !== "code.exe") { // You can make this anything you want :3
          currentGameExe = "code.exe";
          gameStartTime = Date.now();
        }
        return `💻 Creating ${folderName} on VSC`;
      }

      const matchingGame = games.find(game => game.exe.toLowerCase() === exe);
      if (matchingGame) {
        if (currentGameExe !== exe) {
          currentGameExe = exe;
          const gameProc = sysInfo.list.find(p => p.name.toLowerCase() === exe);
          gameStartTime = gameProc?.started ? new Date(gameProc.started).getTime() : Date.now();
        }
        const elapsed = formatElapsedTime(gameStartTime);
        return `${config.emoji.game} Playing: ${matchingGame.name} ${elapsed}`;
      }
    }

    currentGameExe = null;
    gameStartTime = null;
    return null;
  } catch (err) {
    console.error("❌ Error detecting running games:", err);
    return null;
  }
}


let lastStatus = "";
let statusIndex = 0;
const statusTypes = ["Listening", "Playing"];

async function updateStatus() {
  let statusText = null;

  if (statusTypes[statusIndex] === "Listening" && config.enableLastfm) {
    statusText = await getNowPlaying(config.lastfm.username);
  } else if (statusTypes[statusIndex] === "Playing" && config.enableGameDetection) {
    statusText = await detectRunningGame();
  }

  if (!statusText) statusText = config.defaultStatusText;

  if (statusText === lastStatus) return;

  try {
    await client.api.patch("/users/@me", {
      status: {
        text: statusText,
        presence: config.defaultPresence,
      },
    });
    console.log(`✅ Status updated: ${statusText}`);
    lastStatus = statusText;
  } catch (err) {
    console.error("❌ Failed to update status:", err);
  }

  statusIndex = (statusIndex + 1) % statusTypes.length;
}

function updateStatusLoop() {
  setInterval(updateStatus, UPDATE_INTERVAL_MS);
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.username}`);
  await updateStatus();
  updateStatusLoop();
});

client.loginBot({ token: process.env.USER_TOKEN });
