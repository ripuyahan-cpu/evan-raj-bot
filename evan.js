const { spawn, exec, execSync } = require("child_process");
const axios = require("axios");
const logger = require("./utils/log");
const express = require('express');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const figlet = require("figlet");
const moment = require("moment-timezone");

// ============================================================
// ╔═══════════════════════════════════════════════════════════╗
// ║   ✨ EVAN RAJ BOT - STYLISH LAUNCHER v2.0 ✨           ║
// ║   🔥 Auto-Update | Secure | Ultra-Fast                 ║
// ╚═══════════════════════════════════════════════════════════╝
// ============================================================

// ================== STYLISH BANNER ===========================
function showBanner() {
    console.clear();
    console.log(chalk.hex('#00ffff').bold('╔' + '═'.repeat(58) + '╗'));
    console.log(chalk.hex('#00ffff').bold('║') + chalk.hex('#ff00ff').bold('  ✨ EVAN RAJ BOT LAUNCHER v2.0 ✨  ') + chalk.hex('#00ffff').bold('║'));
    console.log(chalk.hex('#00ffff').bold('╠' + '═'.repeat(58) + '╣'));

    figlet.text('EVAN RAJ', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    }, (err, data) => {
        if (!err) {
            const lines = data.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8b00ff'];
                    let coloredLine = '';
                    for (let i = 0; i < line.length; i++) {
                        const colorIndex = i % colors.length;
                        coloredLine += chalk.hex(colors[colorIndex])(line[i]);
                    }
                    console.log(chalk.hex('#00ffff').bold('║') + coloredLine + chalk.hex('#00ffff').bold('║'));
                }
            }
        } else {
            console.log(chalk.hex('#ff00ff').bold('║   🚀 EVAN RAJ BOT   ║'));
        }

        console.log(chalk.hex('#00ffff').bold('╠' + '═'.repeat(58) + '╣'));
        console.log(chalk.hex('#00ffff').bold('║') + chalk.hex('#ffff00').bold('  🔥 AUTO-UPDATE ENABLED  ') + chalk.hex('#00ff00').bold('  🔒 SECURE  ') + chalk.hex('#ff00ff').bold('  ⚡ FAST  ') + chalk.hex('#00ffff').bold('║'));
        console.log(chalk.hex('#00ffff').bold('╚' + '═'.repeat(58) + '╝'));

        showSystemInfo();
        setTimeout(() => startBotLauncher(), 500);
    });
}

// ================== SYSTEM INFO ==============================
function showSystemInfo() {
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log('\n' + chalk.hex('#00ffff').bold('═'.repeat(60)));
    console.log(chalk.hex('#ff00ff').bold('📊 SYSTEM INFORMATION'));
    console.log(chalk.hex('#00ffff').bold('═'.repeat(60)));
    console.log(chalk.hex('#00ff88')(`  🟢 Node.js   : ${process.version}`));
    console.log(chalk.hex('#ffaa00')(`  🟡 Platform  : ${process.platform.toUpperCase()} (${process.arch})`));
    console.log(chalk.hex('#ff44aa')(`  🟣 Memory    : ${memoryUsage} MB`));
    console.log(chalk.hex('#00ffff').bold('═'.repeat(60)) + '\n');
}

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

// ================== STYLISH LOGGER ========================
const log = (message, tag = "[ INFO ]") => {
    const time = moment().tz("Asia/Dhaka").format("HH:mm:ss");
    let coloredTag = tag;
    if (tag.includes("START")) coloredTag = chalk.green.bold(tag);
    else if (tag.includes("ERROR")) coloredTag = chalk.red.bold(tag);
    else if (tag.includes("UPDATE")) coloredTag = chalk.yellow.bold(tag);
    else if (tag.includes("LOAD")) coloredTag = chalk.magenta.bold(tag);
    else if (tag.includes("SYSTEM")) coloredTag = chalk.cyan.bold(tag);
    else if (tag.includes("STABLE")) coloredTag = chalk.green.bold(tag);
    else if (tag.includes("CRON")) coloredTag = chalk.blue.bold(tag);
    else if (tag.includes("FATAL")) coloredTag = chalk.bgRed.white.bold(tag);
    console.log(chalk.gray(`[${time}]`) + ' ' + coloredTag + ' ' + message);
};

// ================== LOAD APPSTATE ==========================
let appStateFile = resolve(
    join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json")
);
let appState;

try {
    appState = require(appStateFile);
    log(global.getText("system", "loadAppStateSuccess"), "[ START ]");
} catch (error) {
    log(global.getText("system", "loadAppStateFail"), "[ ERROR ]");
    process.exit(1);
}

// ================== LOAD MODULES ===========================
function loadModules() {
    log(chalk.hex('#ffaa00')('📂 Loading modules...'), "[ LOAD ]");

    const commandFolders = readdirSync(join(__dirname, "includes", "commands"))
        .filter(file => file.endsWith(".js") && !file.includes("example"));

    for (const file of commandFolders) {
        try {
            const command = require(join(__dirname, "includes", "commands", file));
            if (!command.config || !command.run) throw new Error("Invalid command structure");
            if (global.client.commands.has(command.config.name)) throw new Error(`Duplicate: ${command.config.name}`);
            global.client.commands.set(command.config.name, command);
            log(chalk.hex('#00ff88')(`  ✅ Loaded Command: ${command.config.name}`), "[ LOAD ]");
        } catch (error) {
            log(chalk.red(`  ❌ Failed: ${file} - ${error.message}`), "[ ERROR ]");
        }
    }

    const eventFolders = readdirSync(join(__dirname, "includes", "events"))
        .filter(file => file.endsWith(".js"));

    for (const file of eventFolders) {
        try {
            const event = require(join(__dirname, "includes", "events", file));
            if (!event.config || !event.run) throw new Error("Invalid event structure");
            global.client.events.set(event.config.name, event);
            log(chalk.hex('#66ccff')(`  ✅ Loaded Event: ${event.config.name}`), "[ LOAD ]");
        } catch (error) {
            log(chalk.red(`  ❌ Failed: ${file} - ${error.message}`), "[ ERROR ]");
        }
    }
}

// ================== AUTO-UPDATE ============================
async function checkForUpdates() {
    const repoURL = global.config.updateRepoURL;
    if (!repoURL) {
        log(chalk.yellow("⚠️ No updateRepoURL found. Skipping update check."), "[ UPDATE ]");
        return;
    }

    try {
        delete require.cache[require.resolve('./package.json')];
        const localPkg = require("./package.json");
        const { data: remotePkg } = await axios.get(repoURL, { timeout: 8000 });

        if (remotePkg.version && localPkg.version !== remotePkg.version) {
            log(chalk.bgYellow.black.bold(` 🔄 NEW VERSION AVAILABLE! `), "[ UPDATE ]");
            log(chalk.hex('#ff8800')(`  📦 Local: ${localPkg.version} → Remote: ${remotePkg.version}`), "[ UPDATE ]");
            log(chalk.hex('#00ccff')("  ⬇️ Downloading updates from GitHub..."), "[ UPDATE ]");

            execSync('git fetch origin && git reset --hard origin/main', {
                stdio: 'inherit',
                cwd: __dirname
            });

            log(chalk.hex('#00ff88')("  📦 Installing new dependencies..."), "[ UPDATE ]");
            execSync('npm install', {
                stdio: 'inherit',
                cwd: __dirname
            });

            log(chalk.bgGreen.black.bold(` ✅ UPDATE SUCCESSFUL! `), "[ UPDATE ]");
            log(chalk.hex('#ff00ff')("  🔄 Restarting EVAN RAJ BOT..."), "[ UPDATE ]");

            const { spawn } = require('child_process');
            spawn(process.argv[0], process.argv.slice(1), {
                detached: true,
                stdio: 'inherit'
            }).unref();
            process.exit(0);
        } else {
            log(chalk.green(`✅ EVAN RAJ BOT is up to date (${localPkg.version})`), "[ UPDATE ]");
        }
    } catch (error) {
        log(chalk.red(`⚠️ Update failed: ${error.message}`), "[ UPDATE ERROR ]");
    }
}

// ================== CRON JOBS ==============================
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
                if (err) return log(chalk.red(`Cron error: ${err}`), "[ CRON ]");
                for (const thread of threads) {
                    if (thread.isGroup && thread.threadID !== api.getCurrentUserID()) {
                        api.sendMessage(sch.msg, thread.threadID);
                    }
                }
            });
        }, { scheduled: true, timezone: "Asia/Dhaka" });
    }
}

// ================== START BOT ==============================
async function startBotLauncher() {
    login({ appState }, async (err, api) => {
        if (err) {
            log(JSON.stringify(err), "[ LOGIN ERROR ]");
            return;
        }

        api.setOptions({ forceLogin: true });
        global.client.api = api;

        loadModules();
        setupCronJobs(api);

        log(chalk.bgGreen.black.bold(' 🚀 EVAN RAJ BOT ONLINE '), "[ SYSTEM ]");
        log(chalk.hex('#00ff88')(`  📦 Commands: ${global.client.commands.size} | Events: ${global.client.events.size}`), "[ SYSTEM ]");
        log(chalk.hex('#ffaa00')(`  ⏰ Started at: ${moment().tz("Asia/Dhaka").format("HH:mm:ss")}`), "[ SYSTEM ]");

        setTimeout(checkForUpdates, 5000);
        setInterval(checkForUpdates, 21600000);

        api.listenMqtt((err, event) => {
            if (err) {
                log(chalk.red(`Listen error: ${err}`), "[ LISTEN ERROR ]");
                return;
            }

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
                    log(chalk.red(`Command error: ${error}`), "[ COMMAND ERROR ]");
                }
            }
        });
    });
}

// ================== ERROR HANDLING =========================
process.on("unhandledRejection", (err) => {
    log(chalk.bgRed.white(`💀 Unhandled Rejection: ${err.stack || err}`), "[ FATAL ]");
});

process.on("uncaughtException", (err) => {
    log(chalk.bgRed.white(`💀 Uncaught Exception: ${err.stack || err}`), "[ FATAL ]");
});

// ================== START ==================================
showBanner();
