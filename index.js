const { spawn, exec } = require("child_process");
const axios = require("axios");
const logger = require("./utils/log");
const express = require('express');
const path = require('path');
const fs = require('fs');

// ============================================================
// ╔═══════════════════════════════════════════════════════════╗
// ║   🚀 EVAN RAJ BOT LAUNCHER 🚀                           ║
// ║   ⚡ Cyber Mirai Framework                              ║
// ║   👑 Powered by EVAN RAJ                               ║
// ╚═══════════════════════════════════════════════════════════╝
// ============================================================

const BOT_NAME = "👑 EVAN RAJ";

// 📢 Show stylish banner at startup
function showBanner() {
    const banner = `
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║     🚀 ███████╗██╗   ██╗ █████╗ ███╗   ██╗             ║
    ║     🚀 ██╔══██║██║   ██║██╔══██╗████╗  ██║             ║
    ║     🚀 ███████║██║   ██║███████║██╔██╗ ██║             ║
    ║     🚀 ██╔══██║╚██╗ ██╔╝██╔══██║██║╚██╗██║             ║
    ║     🚀 ███████║ ╚████╔╝ ██║  ██║██║ ╚████║             ║
    ║     🚀 ╚══════╝  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝             ║
    ║                                                          ║
    ║              🔥 BOT LAUNCHER v2.0 🔥                    ║
    ║           👨‍💻 Maintained by EVAN RAJ 👨‍💻               ║
    ║           ⚡ Cyber Mirai | Auto-Update ⚡               ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    `;
    console.log(banner);
}

///////////////////////////////////////////////////////////
//========= 🌐 Create website for dashboard/uptime ======//
///////////////////////////////////////////////////////////
const app = express();
const port = process.env.PORT || 8080;

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.listen(port, () => {
    logger(`🌐 Server running on port ${port} for ${BOT_NAME} ✅`, "[ STARTING ]");
}).on('error', (err) => {
    if (err.code === 'EACCES') {
        logger(`🚫 Permission denied. Cannot bind to port ${port}.`, "[ Error ]");
    } else {
        logger(`❌ Server error: ${err.message}`, "[ Error ]");
    }
});

/////////////////////////////////////////////////////////
//========= ⚡ Improved Bot Launcher with Auto-Update ==//
/////////////////////////////////////////////////////////

global.countRestart = global.countRestart || 0;
let botProcess = null;
let isShuttingDown = false;
let currentStartTime = Date.now();

// 📦 Local package.json read (with cache bypass)
function getLocalPackage() {
    delete require.cache[require.resolve('./package.json')];
    return require('./package.json');
}

// 🔄 Check for updates on GitHub (Managed by EVAN RAJ)
async function checkForUpdates(forceRestart = false) {
    try {
        const localPkg = getLocalPackage();
        logger(`📦 Checking for updates from GitHub...`, "[ UPDATE ]");
        const response = await axios.get(
            "https://raw.githubusercontent.com/islamickcyber404/CYBER-MARAI-BOT/refs/heads/main/package.json",
            { timeout: 10000 }
        );
        const remotePkg = response.data;

        if (remotePkg.version && localPkg.version !== remotePkg.version) {
            logger(`🎉 ${BOT_NAME} - New version found! Local: ${localPkg.version} ➜ Remote: ${remotePkg.version} 🚀`, "[ UPDATE ]");
            logger(`⬇️ ${BOT_NAME} is pulling latest changes from GitHub...`, "[ UPDATE ]");

            // Force pull to overwrite local changes (safe for bots)
            exec('git fetch origin && git reset --hard origin/main', { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    logger(`❌ ${BOT_NAME}'s update failed: ${error.message}`, "[ UPDATE ERROR ]");
                    return;
                }
                logger(`✅ ${BOT_NAME}'s Git pull successful! 🎉\n${stdout}`, "[ UPDATE ]");
                if (stderr) logger(`⚠️ ${stderr}`, "[ UPDATE WARN ]");

                // Reload local package after pull
                const newLocalPkg = getLocalPackage();
                logger(`📦 ${BOT_NAME} updated to version ${newLocalPkg.version} ✅`, "[ UPDATE ]");

                // Restart the bot process to apply changes
                if (botProcess && !botProcess.killed) {
                    logger(`🔪 Killing old process to apply ${BOT_NAME}'s updates... ⏳`, "[ UPDATE ]");
                    botProcess.kill('SIGTERM');
                }
                // Reset restart counter after successful update
                global.countRestart = 0;
                // Small delay to ensure old process exits, then start fresh
                setTimeout(() => startBot(`♻️ Restarting ${BOT_NAME} after auto-update...`), 2000);
            });
        } else {
            if (forceRestart) {
                logger(`✅ ${BOT_NAME} is already up to date. 📌`, "[ UPDATE ]");
            }
        }
    } catch (err) {
        // Don't crash the launcher if update check fails
        logger(`⚠️ ${BOT_NAME}'s update check failed: ${err.message}`, "[ UPDATE WARN ]");
    }
}

function startBot(message) {
    if (isShuttingDown) return;

    if (message) logger(message, "[ STARTING ]");

    // Reset counter if bot ran stable for > 60 seconds
    if (global.countRestart > 0 && (Date.now() - currentStartTime) > 60000) {
        global.countRestart = 0;
        logger(`✅ ${BOT_NAME} ran stable for 60s. Restart counter reset to 0. 🛡️`, "[ STABLE ]");
    }

    logger(`⚡ Spawning ${BOT_NAME} process...`, "[ LAUNCH ]");
    botProcess = spawn("node", ["--trace-warnings", "--async-stack-traces", "cyber.js"], {
        cwd: __dirname,
        stdio: "inherit",
        shell: true
    });

    currentStartTime = Date.now();

    botProcess.on("close", (codeExit) => {
        if (isShuttingDown) {
            logger(`🛑 ${BOT_NAME} bot process closed gracefully. 👋`, "[ SHUTDOWN ]");
            return;
        }

        if (codeExit !== 0 && global.countRestart < 5) {
            global.countRestart += 1;
            logger(`💥 ${BOT_NAME} bot exited with code ${codeExit}. Restarting... 🔁 (${global.countRestart}/5)`, "[ RESTARTING ]");
            // Wait 3 seconds before restart to avoid CPU spikes
            setTimeout(() => startBot(`⏳ Re-spawning ${BOT_NAME}...`), 3000);
        } else if (codeExit !== 0) {
            logger(`🚨 ${BOT_NAME} bot stopped permanently after ${global.countRestart} consecutive crashes. ❌`, "[ STOPPED ]");
            logger(`🛠️ Manual restart required or check cyber.js for errors. - ${BOT_NAME}`, "[ FATAL ]");
        } else {
            logger(`✅ ${BOT_NAME} bot exited normally with code ${codeExit}. 🎯`, "[ STOPPED ]");
        }
    });

    botProcess.on("error", (error) => {
        // Proper error logging (shows stack trace)
        logger(`🔥 Child process error (${BOT_NAME}): ${error.stack || error.message}`, "[ Error ]");
    });
}

////////////////////////////////////////////////
//========= 🛑 Graceful Shutdown Handler ======//
////////////////////////////////////////////////

function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger(`📡 Received ${signal}. ${BOT_NAME} launcher is shutting down gracefully... 🛑`, "[ SHUTDOWN ]");

    if (botProcess && !botProcess.killed) {
        logger(`⏳ Sending SIGTERM to ${BOT_NAME} bot...`, "[ SHUTDOWN ]");
        botProcess.kill('SIGTERM');
        // Force kill after 5 seconds if it doesn't exit
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                logger(`⚡ Force killing ${BOT_NAME} bot process... 💀`, "[ SHUTDOWN ]");
                botProcess.kill('SIGKILL');
            }
        }, 5000);
    }

    // Exit parent process after giving child time to clean up
    setTimeout(() => {
        logger(`👋 ${BOT_NAME} launcher exiting. Bye!`, "[ SHUTDOWN ]");
        process.exit(0);
    }, 1000);
}

// Catch system signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    logger(`💀 Uncaught Exception in ${BOT_NAME} launcher: ${err.stack}`, "[ FATAL ]");
    // Don't exit, just log
});

////////////////////////////////////////////////
//========= 🚀 Start Everything ==============//
////////////////////////////////////////////////

// 🖥️ Show the stylish banner first
showBanner();

// 1. Check for updates on startup (but don't block starting)
setTimeout(() => checkForUpdates(true), 3000);

// 2. Start the bot
startBot(`🚀 Starting ${BOT_NAME} Bot Launcher... ⚡`);

// 3. Periodic update check every 1 hour (3600000 ms)
setInterval(() => checkForUpdates(false), 3600000);

// 4. Final credit & status messages
logger(`🏆 ${BOT_NAME} Bot is now ONLINE and READY! ✅`, "[ CREDIT ]");
logger(`🔄 Auto-updater enabled for ${BOT_NAME}. Will check every hour. ⏰`, "[ SYSTEM ]");
logger(`💡 For support, contact @EVAN_RAJ on Telegram. 📱`, "[ SYSTEM ]");
