let io;
const viewerCounts = new Map();
const viewerIpCounts = new Map();

function broadcast(event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

function setSocketServer(instance) {
  io = instance;
  globalThis.__socketServer = { broadcast };
}

function emitViewerCounts() {
  const payload = Array.from(viewerCounts.entries()).map(([key, count]) => {
    const [year, section] = key.split("-");
    const ipEntries = viewerIpCounts.get(key);
    const ips = ipEntries ? Array.from(ipEntries.keys()) : [];
    return { year: Number(year), section, count, ips };
  });

  broadcast("viewer:count", payload);
}

function handleSocketConnection(socket) {
  socket.on("viewer:join", ({ year, section }, ack) => {
    const room = `class:${year}-${section}`;
    const viewerKey = `${year}-${section}`;
    const currentCount = viewerCounts.get(viewerKey) || 0;

    const forwardedFor = socket.handshake.headers["x-forwarded-for"];
    const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = (rawIp || socket.handshake.address || "").split(",")[0].trim();

    socket.join("stream");
    socket.join(room);
    socket.data.viewerKey = viewerKey;
    socket.data.viewerIp = ip;

    viewerCounts.set(viewerKey, currentCount + 1);
    if (ip) {
      if (!viewerIpCounts.has(viewerKey)) {
        viewerIpCounts.set(viewerKey, new Map());
      }
      const ipCounts = viewerIpCounts.get(viewerKey);
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    }

    emitViewerCounts();

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("admin:join", () => {
    socket.join("admin");
    emitViewerCounts();
  });

  socket.on("viewer:subscribe", () => {
    emitViewerCounts();
  });

  socket.on("disconnect", () => {
    const key = socket.data.viewerKey;
    if (!key) {
      return;
    }

    const nextCount = Math.max((viewerCounts.get(key) || 1) - 1, 0);
    if (nextCount === 0) {
      viewerCounts.delete(key);
    } else {
      viewerCounts.set(key, nextCount);
    }
    const ip = socket.data.viewerIp;
    if (ip && viewerIpCounts.has(key)) {
      const ipCounts = viewerIpCounts.get(key);
      const nextIpCount = Math.max((ipCounts.get(ip) || 1) - 1, 0);
      if (nextIpCount === 0) {
        ipCounts.delete(ip);
      } else {
        ipCounts.set(ip, nextIpCount);
      }
      if (ipCounts.size === 0) {
        viewerIpCounts.delete(key);
      }
    }

    emitViewerCounts();
  });
}

module.exports = {
  broadcast,
  handleSocketConnection,
  setSocketServer,
};
