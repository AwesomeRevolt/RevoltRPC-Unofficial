import "dotenv/config.js";
import { Client } from "revolt.js";
import psListImport from "ps-list";
const psList = psListImport;
import fs from "fs"
import path from "path"
import si from "systeminformation";
const client = new Client();
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS);

const gamesPath = path.join(__dirname, "..", "games.json"); // Update to an API at some point and allow developers to add their own applications??
const games: Array<{exe: string, name: string}> = JSON.parse(fs.readFileSync(gamesPath, "utf-8"));

const config = {
  enableLastfm: process.env.ENABLE_LASTFM === "true",
  enableGameDetection: process.env.ENABLE_GAME_DETECTION === "true",
  defaultStatusText: process.env.DEFAULT_STATUS_TEXT || "Just chilling 😎",
  defaultPresence: (process.env.DEFAULT_PRESENCE || "Online") as "Online" | "Idle" | "Focus" | "Busy" | "Invisible" | null | undefined,
  emoji: {
    music: process.env.STATUS_EMOJI_MUSIC || "🎧",
    game: process.env.STATUS_EMOJI_GAME || "🎮"
  },
  lastfm: {
    username: process.env.LASTFM_USERNAME,
    apiKey: process.env.LASTFM_API_KEY
  }
};
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return hours > 0
      ? `${hours}:${minutes}:${seconds}` // e.g., 1:02:15
      : `${minutes}:${seconds}`;         // e.g., 02:15
}

async function getNowPlaying(username: string | null | undefined) {
  if(!username) throw new Error("Username is required");
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
    let currentGameExe = null;
    let gameStartTime = null;
    for (const proc of processes) {
      const exe = proc.name.toLowerCase();

      if (exe === "code.exe") {
        const cmd = proc.cmd || "";
        const parts = cmd.split(/["\s]/).filter((p: any) => p);
        const projectPath = parts.find((p: any) =>
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
        const elapsed = formatElapsedTime(Date.now() - gameStartTime!);
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
let statusText: string | null = null;

async function updateStatus() {
  if (!config.enableLastfm) statusIndex = 1; // Start with Playing if Last.fm is disabled
  if (!config.enableGameDetection) statusIndex = 0; // Start with Listening if game detection is disabled

  let musicText: string | null = null;
  let gameText: string | null = null;

  if (config.enableLastfm) {
    musicText = await getNowPlaying(config.lastfm.username);
  }

  if (config.enableGameDetection) {
    gameText = await detectRunningGame();
  }

  if (statusTypes[statusIndex] === "Listening" && musicText) {
    statusText = musicText;
    statusIndex = 1; // Switch to Playing next
  } else if (statusTypes[statusIndex] === "Playing" && gameText) {
    statusText = gameText;
    statusIndex = 0; // Switch to Listening next
  } else if (musicText) {
    // Fall back to music if it's available
    statusText = musicText;
  } else if (gameText) {
    // Or fall back to game if available
    statusText = gameText;
  } else {
    // Default fallback
    statusText = config.defaultStatusText;
  }

  if (statusText === lastStatus) return;

  try {
    await client.api.patch(`/users/@me`, {
      status: {
        text: statusText,
        presence: config.defaultPresence,
      }
    });
    console.log(`✅ Status updated: ${statusText}`);
    lastStatus = statusText;
  } catch (err) {
    console.error("❌ Failed to update status:", err);
  }
}


function updateStatusLoop() {
  setInterval(updateStatus, UPDATE_INTERVAL_MS);
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.username}`);
  await updateStatus();
  updateStatusLoop();
});

(async () => {
  if(!process.env.USER_TOKEN) throw new Error("User token is required");
  //@ts-expect-error - This does work, but it's not typed correctly
  await client.loginBot({token: process.env.USER_TOKEN})
})();
