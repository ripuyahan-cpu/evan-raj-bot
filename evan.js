const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rmSync } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const logger = require("./utils/log");
const login = require("fca-priyansh");
const axios = require("axios");
const { Sequelize, sequelize } = require("./database/models");
const cron = require("node-cron");
const moment = require("moment-timezone");

// ============================================================
// ╔═══════════════════════════════════════════════════════════╗
// ║   🚀 EVAN RAJ BOT LAUNCHER                             ║
// ║   🔒 Safe Version - No Remote Control                  ║
// ║   📌 Version 2.0.0 - Clean & Secure                    ║
// ╚═══════════════════════════════════════════════════════════╝
// ============================================================

// ================== GLOBAL VARIABLES ========================
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleSchedule: [],
  handleReaction: [],
  handleReply: [],
  mainPath: process.cwd(),
  configPath: join(process.cwd(), "config.json")
};

global.data = {
  threadInfo: new Map(),
  threadData: new Map(),
  userName: new Map(),
  userBanned: new Map(),
  threadBanned: new Map(),
  commandBanned: new Map(),
  threadAllowNSFW: [],
  allUserID: [],
  allCurrenciesID: [],
  allThreadID: []
};

global.config = require(global.client.configPath);

// ================== LANGUAGE LOADER ========================
global.language = {};
try {
  const langFile = readFileSync(
    join(__dirname, "languages", global.config.language || "en") + ".lang",
    "utf8"
  );
  const langData = langFile.split("\n").filter(line => line.trim() && !line.startsWith("#"));
  
  for (const line of langData) {
    const separatorIndex = line.indexOf("=");
    const key = line.substring(0, separatorIndex).trim();
    const value = line.substring(separatorIndex + 1).trim().replace(/\\n/g, "\n");
    const [head, ...rest] = key.split(".");
    const subKey = rest.join(".");
    
    if (!global.language[head]) global.language[head] = {};
    global.language[head][subKey] = value;
  }
} catch (error) {
  logger(`⚠️ Language file not found! Using fallback.`, "[ WARN ]");
}

// ================== GETTEXT FUNCTION =======================
global.getText = function(...args) {
  const lang = global.language;
  if (!lang[args[0]] || !lang[args[0]][args[1]]) {
    throw new Error(`Missing language key: ${args[0]}.${args[1]}`);
  }
  let text = lang[args[0]][args[1]];
  for (let i = 2; i < args.length; i++) {
    text = text.replace(new RegExp(`%${i-1}`, "g"), args[i]);
  }
  return text;
};

// ================== LOAD APPSTATE ==========================
let appStateFile = resolve(
  join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json")
);
let appState;

try {
  appState = require(appStateFile);
  logger(global.getText("system", "loadAppStateSuccess"), "[ START ]");
} catch (error) {
  logger(global.getText("system", "loadAppStateFail"), "[ ERROR ]");
  process.exit(1);
}

// ================== COMMAND & EVENT LOADER =================
function loadModules() {
  const commandFolders = readdirSync(join(__dirname, "includes", "commands"))
    .filter(file => file.endsWith(".js") && !file.includes("example"));

  for (const file of commandFolders) {
    try {
      const command = require(join(__dirname, "includes", "commands", file));
      if (!command.config || !command.run) {
        throw new Error("Invalid command structure");
      }
      if (global.client.commands.has(command.config.name)) {
        throw new Error(`Duplicate command name: ${command.config.name}`);
      }
      global.client.commands.set(command.config.name, command);
      logger(global.getText("system", "loadedCommand", command.config.name), "[ LOAD ]");
    } catch (error) {
      logger(global.getText("system", "loadCommandError", file, error.message), "[ ERROR ]");
    }
  }

  const eventFolders = readdirSync(join(__dirname, "includes", "events"))
    .filter(file => file.endsWith(".js"));

  for (const file of eventFolders) {
    try {
      const event = require(join(__dirname, "includes", "events", file));
      if (!event.config || !event.run) {
        throw new Error("Invalid event structure");
      }
      global.client.events.set(event.config.name, event);
      logger(global.getText("system", "loadedEvent", event.config.name), "[ LOAD ]");
    } catch (error) {
      logger(global.getText("system", "loadEventError", file, error.message), "[ ERROR ]");
    }
  }
}

// ================== AUTO-UPDATE CHECKER (Safe) =============
async function checkForUpdates() {
  const repoURL = global.config.updateRepoURL;
  if (!repoURL) {
    logger("⚠️ No updateRepoURL found in config.json. Skipping update check.", "[ UPDATE ]");
    return;
  }

  try {
    const localPkg = require("./package.json");
    const { data: remotePkg } = await axios.get(repoURL, { timeout: 8000 });

    if (remotePkg.version && localPkg.version !== remotePkg.version) {
      logger(
        chalk.green.bold(`🔄 New version available! Local: ${localPkg.version} → Remote: ${remotePkg.version}`),
        "[ UPDATE ]"
      );
      logger(chalk.yellow("📌 Run 'git pull' manually to update."), "[ UPDATE ]");
    } else {
      logger(chalk.green("✅ Already up to date."), "[ UPDATE ]");
    }
  } catch (error) {
    logger(`⚠️ Update check failed: ${error.message}`, "[ UPDATE WARN ]");
  }
}

// ================== CRON SCHEDULES =========================
function setupCronJobs(api) {
  const schedules = [
    { time: "0 9 * * *", msg: "🌅 Good Morning! Have a great day!" },
    { time: "0 12 * * *", msg: "☀️ Good Afternoon! Stay positive!" },
    { time: "0 18 * * *", msg: "🌇 Good Evening! Relax and enjoy!" },
    { time: "0 21 * * *", msg: "🌙 Good Night! Sweet dreams!" }
  ];

  for (const sch of schedules) {
    cron.schedule(sch.time, () => {
      api.getThreadList(500, null, ["INBOX"], (err, threads) => {
        if (err) return logger(`Cron error: ${err}`, "[ CRON ]");
        for (const thread of threads) {
          if (thread.isGroup && thread.threadID !== api.getCurrentUserID()) {
            api.sendMessage(sch.msg, thread.threadID);
          }
        }
      });
    }, { scheduled: true, timezone: "Asia/Dhaka" });
  }
}

// ================== BOT LAUNCHER START =========================
async function startBotLauncher() {
  login({ appState }, async (err, api) => {
    if (err) {
      logger(JSON.stringify(err), "[ LOGIN ERROR ]");
      return;
    }

    api.setOptions({ forceLogin: true });
    global.client.api = api;

    // Load modules
    loadModules();
    setupCronJobs(api);

    // Log startup info
    logger(
      chalk.cyan.bold("🚀 EVAN RAJ BOT STARTED SUCCESSFULLY!"),
      "[ SYSTEM ]"
    );
    logger(
      chalk.cyan(`📦 Commands: ${global.client.commands.size} | Events: ${global.client.events.size}`),
      "[ SYSTEM ]"
    );
    logger(
      chalk.cyan(`⏰ Started at: ${moment().tz("Asia/Dhaka").format("HH:mm:ss")}`),
      "[ SYSTEM ]"
    );

    // Check for updates (non-blocking)
    setTimeout(checkForUpdates, 5000);

    // Periodic update check every 6 hours
    setInterval(checkForUpdates, 21600000);

    // Listen for events
    api.listenMqtt((err, event) => {
      if (err) {
        logger(`Listen error: ${err}`, "[ LISTEN ERROR ]");
        return;
      }

      // Route events to handlers
      if (event.type === "message" && event.body) {
        const prefix = global.config.PREFIX || "/";
        if (!event.body.startsWith(prefix)) return;

        const args = event.body.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = global.client.commands.get(commandName);
        if (!command) return;

        try {
          command.run({ api, event, args, prefix, commandName });
        } catch (error) {
          logger(`Command error: ${error}`, "[ COMMAND ERROR ]");
        }
      }
    });
  });
}

// ================== HANDLE UNCAUGHT ERRORS =================
process.on("unhandledRejection", (err) => {
  logger(`Unhandled Rejection: ${err.stack || err}`, "[ FATAL ]");
});

process.on("uncaughtException", (err) => {
  logger(`Uncaught Exception: ${err.stack || err}`, "[ FATAL ]");
});

// ================== START ==================================
logger(chalk.green.bold("=".repeat(50)), "[ START ]");
logger(chalk.cyan.bold("   🔥 EVAN RAJ BOT LAUNCHER 🔥"), "[ START ]");
logger(chalk.cyan.bold("   🛡️  Safe Version - No Remote Control"), "[ START ]");
logger(chalk.green.bold("=".repeat(50)), "[ START ]");

startBotLauncher();
