const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const SESSIONS_FILE = "./whatsapp-sessions.json";
const sessions = [];
const QR_CODES = {};
const createSessionsFileIfNotExists = function () {
  if (!fs.existsSync(SESSIONS_FILE)) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log("Sessions file created successfully.");
    } catch (err) {
      console.log("Failed to create sessions file: ", err);
    }
  }
};
const setSessionsFile = function (sessions) {
  fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
};

const getSessionsFile = function () {
  return JSON.parse(fs.readFileSync(SESSIONS_FILE));
};
const createSession = function (id, description) {
  console.log("Creating session: " + id);
  const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // <- this one doesn't works in Windows
        "--disable-gpu",
      ],
    },
    authStrategy: new LocalAuth({
      clientId: id,
    }),
  });

  client.initialize();

  client.on("qr", (qr) => {
    console.log("QR RECEIVED", qr);
    qrcode.toDataURL(qr, (err, url) => {
      QR_CODES[id] = url;
    });
    // qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log(`Whatsapp session ${id} ready.`);

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions[sessionIndex].ready = true;
    setSessionsFile(savedSessions);
    delete QR_CODES[id];
  });

  client.on("authenticated", () => {
    console.log("authenticated", { id: id });
    console.log("message", { id: id, text: "Whatsapp is authenticated!" });
  });

  client.on("auth_failure", function () {
    console.log("message", { id: id, text: "Auth failure, restarting..." });
  });

  client.on("disconnected", (reason) => {
    console.log("message", { id: id, text: "Whatsapp is disconnected!" });
    client.destroy();
    client.initialize();

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);
    savedSessions.splice(sessionIndex, 1);
    setSessionsFile(savedSessions);
  });

  sessions.push({
    id: id,
    description: description,
    client: client,
  });

  const savedSessions = getSessionsFile();
  const sessionIndex = savedSessions.findIndex((sess) => sess.id == id);

  if (sessionIndex == -1) {
    savedSessions.push({
      id: id,
      description: description,
      ready: false,
    });
    setSessionsFile(savedSessions);
  }
};
const init = function () {
  const savedSessions = getSessionsFile();

  if (!savedSessions.length) {
    return;
  }
  savedSessions.forEach((sess) => {
    createSession(sess.id, sess.description);
  });
};
const destroySession = function (id) {
  const sessionIndex = sessions.findIndex((sess) => sess.id == id);
  if (sessionIndex == -1) {
    return false;
  }
  const client = sessions.find((sess) => sess.id == id)?.client;
  client.destroy();
  sessions.splice(sessionIndex, 1);
  const savedSessions = getSessionsFile();
  const savedSessionIndex = savedSessions.findIndex((sess) => sess.id == id);
  savedSessions.splice(savedSessionIndex, 1);
  setSessionsFile(savedSessions);
  return true;
};
module.exports = {
  createSessionsFileIfNotExists,
  SESSIONS_FILE,
  setSessionsFile,
  getSessionsFile,
  createSession,
  init,
  sessions,
  QR_CODES,
  destroySession,
};
