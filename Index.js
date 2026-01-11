const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const readline = require("readline");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // Se não estiver logado, gera código de 6 dígitos
  if (!state.creds.registered) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Digite seu número com DDI (ex: 5511999999999): ", async (number) => {
      try {
        const code = await sock.requestPairingCode(number);
        console.log("\n📲 Código de pareamento:", code);
        console.log("Digite esse código no WhatsApp!");
        rl.close();
      } catch (err) {
        console.error("Erro ao gerar código:", err);
        rl.close();
      }
    });
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ Bot conectado com sucesso!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    // COMANDO .ping
    if (text === ".ping") {
      await sock.sendMessage(from, {
        text: "pong 🏓"
      });
    }
  });
}

startBot();
