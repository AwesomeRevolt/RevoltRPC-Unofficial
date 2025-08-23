"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config.js");
const revolt_js_1 = require("revolt.js");
const ps_list_1 = __importDefault(require("ps-list"));
const psList = ps_list_1.default;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const systeminformation_1 = __importDefault(require("systeminformation"));
const client = new revolt_js_1.Client();
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS) || 15000;
const GAMES_URL = "https://raw.githubusercontent.com/AwesomeRevolt/RevoltRPC-Unofficial/main/games.json";
let games = [];
// Pulls from GitHub json so shit be updated :D 
async function loadGames() {
    try {
        const res = await fetch(GAMES_URL).catch((e) => {
            console.error("❌ Fetch error:", e);
            throw e;
        });
        if (!(res === null || res === void 0 ? void 0 : res.ok))
            throw new Error(`Failed to fetch games.json: ${res === null || res === void 0 ? void 0 : res.status} ${res === null || res === void 0 ? void 0 : res.statusText}`);
        try {
            games = await res.json();
            console.log(`✅ Loaded ${games.length} games!`);
        }
        catch (jsonErr) {
            console.error("❌ Failed to parse games.json from GitHub:", jsonErr);
            games = [];
        }
    }
    catch (err) {
        console.error("❌ Failed to load games.json from GitHub, falling back to local file:", err); // Does as it says, fallback to local games.json 
        try {
            const gamesPath = path_1.default.join(__dirname, "..", "games.json");
            const raw = fs_1.default.readFileSync(gamesPath, "utf-8");
            try {
                games = JSON.parse(raw);
                console.log(`📂 Loaded ${games.length} games from local fallback`);
            }
            catch (jsonErr) {
                console.error("❌ Could not parse local fallback games.json:", jsonErr);
                games = [];
            }
        }
        catch (localErr) {
            console.error("❌ Could not load local fallback games.json:", localErr);
            games = [];
        }
    }
}
const config = {
    enableLastfm: process.env.ENABLE_LASTFM === "true",
    enableGameDetection: process.env.ENABLE_GAME_DETECTION === "true",
    defaultStatusText: process.env.DEFAULT_STATUS_TEXT || "Just chilling 😎",
    defaultPresence: (process.env.DEFAULT_PRESENCE || "Online"),
    emoji: {
        music: process.env.STATUS_EMOJI_MUSIC || "🎧",
        game: process.env.STATUS_EMOJI_GAME || "🎮",
    },
    lastfm: {
        username: process.env.LASTFM_USERNAME,
        apiKey: process.env.LASTFM_API_KEY,
    },
};
function formatElapsedTime(ms) {
    try {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60)
            .toString()
            .padStart(2, "0");
        const seconds = (totalSeconds % 60).toString().padStart(2, "0");
        return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
    }
    catch (err) {
        console.error("❌ formatElapsedTime error:", err);
        return "00:00";
    }
}
async function getNowPlaying(username) {
    var _a, _b, _c, _d, _e;
    if (!username)
        return null;
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.lastfm.apiKey}&format=json&limit=1`;
    try {
        const res = await fetch(url).catch((e) => {
            console.error("❌ Fetch error (Last.fm):", e);
            throw e;
        });
        if (!(res === null || res === void 0 ? void 0 : res.ok))
            throw new Error(`Bad response from Last.fm: ${res === null || res === void 0 ? void 0 : res.status}`);
        const data = await res.json().catch((e) => {
            console.error("❌ Failed to parse Last.fm JSON:", e);
            throw e;
        });
        const track = (_b = (_a = data.recenttracks) === null || _a === void 0 ? void 0 : _a.track) === null || _b === void 0 ? void 0 : _b[0];
        if (!track || ((_c = track["@attr"]) === null || _c === void 0 ? void 0 : _c.nowplaying) !== "true")
            return null;
        const song = `${track.name} - ${(_e = (_d = track.artist) === null || _d === void 0 ? void 0 : _d["#text"]) !== null && _e !== void 0 ? _e : "Unknown"}`;
        return `${config.emoji.music} Listening: ${song}`;
    }
    catch (err) {
        console.error("❌ Failed to fetch Last.fm data:", err);
        return null;
    }
}
async function detectRunningGame() {
    try {
        const processes = await psList().catch((e) => {
            console.error("❌ psList failed:", e);
            return [];
        });
        const sysInfo = await systeminformation_1.default.processes().catch((e) => {
            console.error("❌ systeminformation.processes failed:", e);
            return { list: [] };
        });
        let currentGameExe = null;
        let gameStartTime = null;
        for (const proc of processes) {
            let exe;
            try {
                exe = proc.name.toLowerCase();
            }
            catch (_a) {
                continue;
            }
            // TODO: Make this easier to configure externally, so people can add their own "special cases" easier.
            if (exe === "code.exe") {
                try {
                    const cmd = proc.cmd || "";
                    const parts = cmd.split(/["\s]/).filter((p) => p);
                    const projectPath = parts.find((p) => p &&
                        !p.toLowerCase().includes("code.exe") &&
                        fs_1.default.existsSync(p) &&
                        fs_1.default.lstatSync(p).isDirectory());
                    const folderName = projectPath ? path_1.default.basename(projectPath) : "Awesome Projects";
                    if (currentGameExe !== "code.exe") {
                        currentGameExe = "code.exe";
                        gameStartTime = Date.now();
                    }
                    return `💻 Creating ${folderName} on VSC`;
                }
                catch (err) {
                    console.error("❌ Error detecting VSCode project:", err);
                }
            }
            try {
                const matchingGame = games.find((game) => game.exe.toLowerCase() === exe);
                if (matchingGame) {
                    if (currentGameExe !== exe) {
                        currentGameExe = exe;
                        try {
                            const gameProc = sysInfo.list.find((p) => p.name.toLowerCase() === exe);
                            gameStartTime = (gameProc === null || gameProc === void 0 ? void 0 : gameProc.started)
                                ? new Date(gameProc.started).getTime()
                                : Date.now();
                        }
                        catch (_b) {
                            gameStartTime = Date.now();
                        }
                    }
                    const elapsed = formatElapsedTime(Date.now() - (gameStartTime !== null && gameStartTime !== void 0 ? gameStartTime : Date.now()));
                    return `${config.emoji.game} Playing: ${matchingGame.name} ${elapsed}`;
                }
            }
            catch (err) {
                console.error("❌ Error matching game:", err);
            }
        }
        return null;
    }
    catch (err) {
        console.error("❌ detectRunningGame error:", err);
        return null;
    }
}
let lastStatus = "";
let statusIndex = 0;
const statusTypes = ["Listening", "Playing"];
let statusText = null;
async function updateStatus(maxRetries = 5, delay = 2000) {
    try {
        if (!config.enableLastfm)
            statusIndex = 1;
        if (!config.enableGameDetection)
            statusIndex = 0;
        let musicText = null;
        let gameText = null;
        try {
            if (config.enableLastfm)
                musicText = await getNowPlaying(config.lastfm.username);
        }
        catch (e) {
            console.error("❌ getNowPlaying failed:", e);
        }
        try {
            if (config.enableGameDetection)
                gameText = await detectRunningGame();
        }
        catch (e) {
            console.error("❌ detectRunningGame failed:", e);
        }
        if (statusTypes[statusIndex] === "Listening" && musicText) {
            statusText = musicText;
            statusIndex = 1;
        }
        else if (statusTypes[statusIndex] === "Playing" && gameText) {
            statusText = gameText;
            statusIndex = 0;
        }
        else if (musicText) {
            statusText = musicText;
        }
        else if (gameText) {
            statusText = gameText;
        }
        else {
            statusText = config.defaultStatusText;
        }
        if (statusText === lastStatus)
            return;
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                await client.api.patch(`/users/@me`, {
                    status: {
                        text: statusText,
                        presence: config.defaultPresence,
                    },
                });
                console.log(`✅ Status updated: ${statusText}`);
                lastStatus = statusText;
                break;
            }
            catch (err) {
                attempt++;
                console.error(`❌ Failed to update status (Attempt ${attempt}/${maxRetries}):`, err);
                if (attempt >= maxRetries) {
                    console.error("⚠️ Max retries reached. Giving up.");
                    break;
                }
                const retryDelay = delay * attempt;
                console.log(`⏳ Retrying in ${retryDelay}ms...`);
                await new Promise(res => setTimeout(res, retryDelay));
            }
        }
    }
    catch (err) {
        console.error("❌ updateStatus error:", err);
    }
}
function updateStatusLoop() {
    try {
        setInterval(() => {
            updateStatus().catch((e) => console.error("❌ updateStatus loop error:", e));
        }, UPDATE_INTERVAL_MS);
    }
    catch (err) {
        console.error("❌ updateStatusLoop error:", err);
    }
}
client.once("ready", async () => {
    var _a;
    try {
        console.log(`✅ Logged in as ${(_a = client.user) === null || _a === void 0 ? void 0 : _a.username}`);
        await loadGames();
        await updateStatus();
        updateStatusLoop();
    }
    catch (err) {
        console.error("❌ Startup error:", err);
    }
});
(async () => {
    try {
        if (!process.env.USER_TOKEN)
            throw new Error("User token is required");
        //@ts-expect-error revolt.js typings are wrong here
        await client.loginBot({ token: process.env.USER_TOKEN });
    }
    catch (err) {
        console.error("❌ Fatal login error:", err);
        process.exit(1);
    }
})();
//# sourceMappingURL=index.js.map