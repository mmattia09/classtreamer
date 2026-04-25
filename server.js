const crypto = require("crypto");
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const { handleSocketConnection, setSocketServer } = require("./lib/socket-server.cjs");

function validateAdminCookie(cookieHeader) {
  if (!cookieHeader) return false;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const idx = c.indexOf("=");
      if (idx === -1) return [c.trim(), ""];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }),
  );
  const token = cookies["classtreamer-admin"];
  if (!token) return false;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const payload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  if (payload !== "admin") return false;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const fingerprint = crypto.createHash("sha256").update(adminPassword).digest("hex");
  const secret = process.env.SESSION_SECRET ?? "dev-secret";
  const expected = crypto
    .createHmac("sha256", `${secret}:${fingerprint}`)
    .update(payload)
    .digest("hex");
  return signature === expected;
}

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;
const appName = "Classtreamer";
const app = next({ dev, hostname, port });
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

  if (!process.env.SESSION_SECRET) {
    console.warn("[security] SESSION_SECRET is not set — using insecure default. Set it in production.");
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("[security] ADMIN_PASSWORD is not set — admin login requires no password. Set it in production.");
  }

  httpServer.listen(port, hostname, () => {
    console.log(`${appName} listening on http://${hostname}:${port}`);
  });
});
