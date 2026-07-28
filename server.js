const crypto = require("crypto");
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const { handleSocketConnection, setSocketServer } = require("./lib/socket-server.cjs");

const APP_NAME = "Classtreamer";
const SESSION_COOKIE = "classtreamer-admin";
const HOSTNAME = "0.0.0.0";
const PORT = 3000;

const dev = process.env.NODE_ENV !== "production";

// Refuse to start misconfigured in production rather than silently running with
// a guessable session secret or an admin area open to an empty password.
// Mirrors the checks in lib/auth.ts and app/api/auth/login/route.ts.
function assertSecureConfig() {
  const problems = [];

  const secret = process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim();
  if (!secret || secret === "dev-secret") {
    problems.push("SESSION_SECRET non impostato (generane uno con: openssl rand -base64 32)");
  }
  if (!process.env.ADMIN_PASSWORD) {
    problems.push("ADMIN_PASSWORD non impostato");
  }

  if (problems.length === 0) return;

  const message = `[security] ${problems.join("; ")}`;
  if (dev) {
    console.warn(`${message} — accettabile in sviluppo, obbligatorio in produzione.`);
    return;
  }

  console.error(`${message}. Avvio interrotto.`);
  process.exit(1);
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader.split(";").map((entry) => {
      const index = entry.indexOf("=");
      if (index === -1) return [entry.trim(), ""];
      return [entry.slice(0, index).trim(), entry.slice(index + 1).trim()];
    }),
  );
}

/** Constant-time comparison of two hex digests — see lib/auth.ts. */
function timingSafeEqualHex(a, b) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length === 0 || bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function validateAdminCookie(cookieHeader) {
  if (!cookieHeader) return false;

  const token = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (payload !== "admin") return false;

  const fingerprint = crypto
    .createHash("sha256")
    .update(process.env.ADMIN_PASSWORD ?? "")
    .digest("hex");
  const secret = (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) || "dev-secret";
  const expected = crypto
    .createHmac("sha256", `${secret}:${fingerprint}`)
    .update(payload)
    .digest("hex");

  return timingSafeEqualHex(signature, expected);
}

assertSecureConfig();

const app = next({ dev, hostname: HOSTNAME, port: PORT });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: {
      origin: false,
    },
    path: "/socket.io",
  });

  setSocketServer(io);
  io.on("connection", (socket) => {
    socket.data.isAdmin = validateAdminCookie(socket.request.headers.cookie);
    handleSocketConnection(socket);
  });

  httpServer.listen(PORT, HOSTNAME, () => {
    console.log(`${APP_NAME} listening on http://${HOSTNAME}:${PORT}`);
  });
});
