const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const { handleSocketConnection, setSocketServer } = require("./lib/socket-server.cjs");

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
  io.on("connection", handleSocketConnection);

  httpServer.listen(port, hostname, () => {
    console.log(`${appName} listening on http://${hostname}:${port}`);
  });
});
