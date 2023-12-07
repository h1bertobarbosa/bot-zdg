const express = require("express");
const http = require("http");
const { phoneNumberFormatter } = require("./helpers/formatter");
const {
  createSessionsFileIfNotExists,
  sessions,
  getQR,
  createSession,
  init,
  destroySession,
  getSessionsFile,
} = require("./helpers/session-zap");
const port = process.env.PORT || 3002;
const app = express();
const server = http.createServer(app);
createSessionsFileIfNotExists();
init();
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/new/sessions", (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId)
    return res
      .status(400)
      .json({ status: false, message: "Session id is required" });
  const qrcode = getQR(sessionId);
  if (!qrcode) {
    createSession(sessionId, "My Whatsapp Bot");
  }
  console.log(qrcode);
  res.json({ qrcode });
});
app.get("/sessions", (req, res) => {
  const savedSessions = getSessionsFile();
  res.json({ data: savedSessions });
});
app.get("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const savedSessions = getSessionsFile();
  const session = savedSessions.find((sess) => sess.id == sessionId);
  res.json({ data: session || {} });
});
app.delete("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  if (!sessionId)
    return res
      .status(400)
      .json({ status: false, message: "Session id is required" });
  const hasRemoved = destroySession(sessionId);
  if (!hasRemoved) {
    return res
      .status(400)
      .json({ status: false, message: "Session id not found" });
  }
  res.json({ status: true, message: "Session was removed" });
});

// Send message
app.post("/send-message", async (req, res) => {
  const sender = req.body.sender;
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  const client = sessions.find((sess) => sess.id == sender)?.client;

  // Make sure the sender is exists & ready
  if (!client) {
    return res.status(422).json({
      status: false,
      message: `The sender: ${sender} is not found!`,
    });
  }

  /**
   * Check if the number is already registered
   * Copied from app.js
   *
   * Please check app.js for more validations example
   * You can add the same here!
   */
  const isRegisteredNumber = await client.isRegisteredUser(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: "The number is not registered",
    });
  }

  client
    .sendMessage(number, message)
    .then((response) => {
      res.status(200).json({
        status: true,
        response: response,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});

server.listen(port, function () {
  console.log("App running on *: " + port);
});
