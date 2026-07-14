// ==========================================================
// ইসলামিক সাইবার চ্যাট - ডিঅবফাস্কেটেড (পাথ অপরিবর্তিত)
// মূল অবস্কিউরেটেড কোডের ১:১ ডিঅবফাস্কেটেড ভার্সন
// ==========================================================

const moment = require('moment-timezone');
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require('fs');
const { join, resolve } = require('path');
const { execSync } = require('child_process');
const logger = require('./utils/log');
const login = require('fca-priyansh');
const axios = require('axios');

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const listPackage = Object.keys(packageJson.dependencies || {});
const listbuiltinModules = require('module').builtinModules;

// ==================== গ্লোবাল অবজেক্ট ====================
global.client = new Object({
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: new Array(),
  handleSchedule: new Array(),
  handleReaction: new Array(),
  handleReply: new Array(),
  mainPath: process.cwd(),
  configPath: new String(),
  getTime: function (type) {
    const tz = 'Asia/Dhaka';
    switch (type) {
      case 'seconds': return '' + moment.tz(tz).format('ss');
      case 'minutes': return '' + moment.tz(tz).format('mm');
      case 'hours': return '' + moment.tz(tz).format('HH');
      case 'date': return '' + moment.tz(tz).format('DD');
      case 'month': return '' + moment.tz(tz).format('MM');
      case 'year': return '' + moment.tz(tz).format('YYYY');
      case 'fullTime': return '' + moment.tz(tz).format('HH:mm:ss');
      case 'fullDate': return '' + moment.tz(tz).format('DD/MM/YYYY');
      case 'fullYear': return '' + moment.tz(tz).format('YYYY');
      default: return '' + moment.tz(tz).format('HH:mm:ss DD/MM/YYYY');
    }
  }
});

global.data = new Object({
  threadInfo: new Map(),
  threadData: new Map(),
  userName: new Map(),
  userBanned: new Map(),
  threadBanned: new Map(),
  commandBanned: new Map(),
  threadAllowNSFW: new Array(),
  allUserID: new Array(),
  allCurrenciesID: new Array(),
  allThreadID: new Array()
});

global.modules = require('module');
global.config = new Object();
global.handleReaction = new Object();
global.handleReply = new Object();
global.eventRegistered = new Array();
global.handleSchedule = new Array();

// ==================== কনফিগ লোড ====================
let configValue;
try {
  global.client.configPath = join(global.client.mainPath, 'config.js');
  configValue = require(global.client.configPath);
  logger('Config Loaded Successfully!', '[ CONFIG ]');
} catch {
  if (existsSync(global.client.configPath.replace(/\.js/g, '.json'))) {
    configValue = readFileSync(global.client.configPath.replace(/\.js/g, '.json'), 'utf8');
    configValue = JSON.parse(configValue);
    logger('Found config file: ' + (global.client.configPath.replace(/\.js/g, '.json')));
  } else {
    logger('Config file not found!', 'ERROR');
    return;
  }
}

try {
  for (const key in configValue) {
    global.config[key] = configValue[key];
  }
  logger('Config values loaded to global!');
} catch {
  logger('Failed to load config values into global!', 'ERROR');
}

// ==================== ল্যাঙ্গুয়েজ লোড ====================
const langFile = readFileSync(
  __dirname + '/languages/' + (global.config.language || 'en') + '.lang',
  { encoding: 'utf8' }
).split(/\r?\n|\r/);

const langData = langFile.filter(line => line.indexOf('#') !== 0 && line != '');

for (const item of langData) {
  const getSeparator = item.indexOf('=');
  const itemKey = item.slice(0, getSeparator);
  const itemValue = item.slice(getSeparator + 1, item.length);
  const head = itemKey.slice(0, itemKey.indexOf('.'));
  const key = itemKey.replace(head + '.', '');
  const value = itemValue.replace(/\\n/gi, '\n');

  if (typeof global.language[head] !== 'object') global.language[head] = new Object();
  global.language[head][key] = value;
}

global.getText = function (...args) {
  const lang = global.language;
  if (!lang.hasOwnProperty(args[0])) {
    throw __filename + ' : Language key not found: ' + args[0];
  }
  let text = lang[args[0]][args[1]];
  for (let i = 2; i < args.length; i++) {
    text = text.replace(new RegExp('%' + i, 'g'), args[i]);
  }
  return text;
};

// ==================== আপস্টেট লোড ====================
let appStateFile;
try {
  const appStatePath = global.config.APPSTATEPATH || 'appstate.json';
  appStateFile = resolve(join(global.client.mainPath, appStatePath));
  const appState = require(appStateFile);
  logger(global.getText('loader', 'successLoadAppstate', 'AppState'));
} catch {
  logger(global.getText('loader', 'notFoundAppstate'), 'ERROR');
  return;
}

// ==================== বটের মূল ফাংশন ====================
function onBot({ models }) {
  login({ appState: appStateFile }, async (err, api) => {
    if (err) {
      logger(JSON.stringify(err), 'ERROR');
      return;
    }

    api.setOptions(global.config.FCAOption || { forceLogin: true, listenEvents: true });
    global.client.api = api;
    global.client.timeStart = new Date().getTime();

    // ----------------- কমান্ড লোডার -----------------
    (function loadCommands() {
      const commandFiles = readdirSync(
        join(global.client.mainPath, 'includes', 'commands')
      ).filter(file => file.endsWith('.js') && !global.config.disabledCommands?.includes(file));

      for (const file of commandFiles) {
        try {
          let command = require(join(global.client.mainPath, 'includes', 'commands', file));
          if (!command.config || !command.run || !command.config.name) {
            throw new Error(global.getText('loader', 'missingModuleProps'));
          }
          if (global.client.commands.has(command.config.name)) {
            throw new Error(global.getText('loader', 'duplicateCommandName'));
          }

          // ডিপেন্ডেন্সি অটো-ইন্সটল
          if (command.config.dependencies) {
            for (const dep in command.config.dependencies) {
              try {
                if (!global.modules[dep]) {
                  if (listPackage.includes(dep) || listbuiltinModules.includes(dep)) {
                    global.modules[dep] = require(dep);
                  } else {
                    global.modules[dep] = require(join(__dirname, 'includes', 'modules', dep));
                  }
                }
              } catch (e) {
                logger(global.getText('loader', 'cantInstallDep', dep, command.config.name), 'WARN');
                execSync(
                  `npm install ${dep}${command.config.dependencies[dep] !== '*' && command.config.dependencies[dep] !== '' ? '@' + command.config.dependencies[dep] : ''}`,
                  { stdio: 'inherit', env: process.env, shell: true, cwd: join(__dirname, 'includes') }
                );
                let installed = false;
                for (let retry = 0; retry < 3; retry++) {
                  try {
                    delete require.cache[require.resolve(dep)];
                    if (listPackage.includes(dep) || listbuiltinModules.includes(dep)) {
                      global.modules[dep] = require(dep);
                    } else {
                      global.modules[dep] = require(join(__dirname, 'includes', 'modules', dep));
                    }
                    installed = true;
                    break;
                  } catch (_) {}
                }
                if (!installed) {
                  throw global.getText('loader', 'installFail', dep, command.config.name);
                }
              }
            }
          }

          // ইভেন্ট ডাটা সেট
          if (command.config.event) {
            if (typeof global.data.eventData[command.config.name] !== 'object') {
              global.data.eventData[command.config.name] = {};
            }
            for (const key in command.config.event) {
              if (typeof global.data.eventData[command.config.name][key] !== 'object') {
                global.data.eventData[command.config.name][key] = command.config.event[key];
              }
            }
          }

          global.client.commands.set(command.config.name, command);
          logger(global.getText('loader', 'successLoadCmd', command.config.name));

        } catch (error) {
          logger(global.getText('loader', 'failLoadCmd', file, error.message), 'WARN');
        }
      }
      logger(global.getText('loader', 'finishLoadCmd', global.client.commands.size));
    })();

    // ----------------- ইভেন্ট লোডার -----------------
    (function loadEvents() {
      const eventFiles = readdirSync(
        join(global.client.mainPath, 'includes', 'events')
      ).filter(file => file.endsWith('.js') && !global.config.disabledEvents?.includes(file));

      for (const file of eventFiles) {
        try {
          let event = require(join(global.client.mainPath, 'includes', 'events', file));
          if (!event.config || !event.run || !event.config.name) {
            throw new Error(global.getText('loader', 'missingModuleProps'));
          }
          if (global.client.events.has(event.config.name)) {
            throw new Error(global.getText('loader', 'duplicateEventName'));
          }

          // ডিপেন্ডেন্সি অটো-ইন্সটল
          if (event.config.dependencies) {
            for (const dep in event.config.dependencies) {
              try {
                if (!global.modules[dep]) {
                  if (listPackage.includes(dep) || listbuiltinModules.includes(dep)) {
                    global.modules[dep] = require(dep);
                  } else {
                    global.modules[dep] = require(join(__dirname, 'includes', 'modules', dep));
                  }
                }
              } catch (e) {
                logger(global.getText('loader', 'cantInstallDep', dep, event.config.name), 'WARN');
                execSync(
                  `npm install ${dep}${event.config.dependencies[dep] !== '*' && event.config.dependencies[dep] !== '' ? '@' + event.config.dependencies[dep] : ''}`,
                  { stdio: 'inherit', env: process.env, shell: true, cwd: join(__dirname, 'includes') }
                );
                let installed = false;
                for (let retry = 0; retry < 3; retry++) {
                  try {
                    delete require.cache[require.resolve(dep)];
                    if (listPackage.includes(dep) || listbuiltinModules.includes(dep)) {
                      global.modules[dep] = require(dep);
                    } else {
                      global.modules[dep] = require(join(__dirname, 'includes', 'modules', dep));
                    }
                    installed = true;
                    break;
                  } catch (_) {}
                }
                if (!installed) {
                  throw global.getText('loader', 'installFail', dep, event.config.name);
                }
              }
            }
          }

          global.client.events.set(event.config.name, event);
          logger(global.getText('loader', 'successLoadEvt', event.config.name));

        } catch (error) {
          logger(global.getText('loader', 'failLoadEvt', file, error.message), 'WARN');
        }
      }
      logger(global.getText('loader', 'finishLoadEvt', global.client.events.size));
    })();

    // ----------------- স্টার্টআপ টাইম -----------------
    logger(global.getText('loader', 'startupTime', global.client.commands.size, global.client.events.size));
    logger('Startup Time: ' + ((Date.now() - global.client.timeStart) / 1000).toFixed(2) + 's');
    logger('Loaded: ' + global.client.commands.size + ' commands & ' + global.client.events.size + ' events');

    // অস্থায়ী কনফিগ ফাইল ডিলিট
    writeFileSync(global.client.configPath, JSON.stringify(global.config, null, 4), 'utf8');
    unlinkSync(global.client.configPath + '.temp');

    // ----------------- লিসেনার -----------------
    const listener = require('./utils/listener')({ api, models });

    const handleMessage = (err, message) => {
      if (err) {
        logger(global.getText('loader', 'listenError', JSON.stringify(err)), 'ERROR');
        return;
      }
      if (['presence', 'typ', 'read_receipt'].includes(message.type)) return;
      if (global.config.debug) console.log(message);
      listener(message);
    };

    global.listenMqtt = api.listenMqtt(handleMessage);

    // ----------------- ব্যান চেক -----------------
    try {
      require('./utils/checkBan')(api);
    } catch (e) {}

    if (!global.NODB) {
      logger(global.getText('loader', 'successConnectDb'), 'DATABASE');
    }
  });
}

// ==================== ডেটাবেস কানেক্ট ====================
(async () => {
  try {
    const { Sequelize, sequelize } = require('./database');
    await sequelize.authenticate();
    const models = { Sequelize, sequelize };
    logger(global.getText('loader', 'successConnectDb'), 'DATABASE');
    onBot({ models });
  } catch (err) {
    logger(global.getText('loader', 'failConnectDb', JSON.stringify(err)), 'DATABASE');
  }
})();

// আনহ্যান্ডেলড রিজেকশন হ্যান্ডলার
process.on('unhandledRejection', (reason, promise) => {});
