let io;

/** viewerKey -> number of connected sockets */
const viewerCounts = new Map();
/** viewerKey -> Map<ip, number of connected sockets from that ip> */
const viewerIpCounts = new Map();

const ADMIN_ROOM = "admin";

function broadcast(event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

function setSocketServer(instance) {
  io = instance;
  globalThis.__socketServer = { broadcast };
}

/**
 * Viewer counts carry the IP address of every connected student, so they go to
 * the admin room only. They used to be sent with io.emit(), which meant every
 * student on a class page received the IP of every other viewer.
 */
function emitViewerCounts() {
  if (!io) return;

  const payload = Array.from(viewerCounts.entries()).map(([key, count]) => {
    const separator = key.indexOf("-");
    const year = Number(key.slice(0, separator));
    const section = key.slice(separator + 1);
    const ipEntries = viewerIpCounts.get(key);
    return {
      year,
      section,
      count,
      ips: ipEntries ? Array.from(ipEntries.keys()) : [],
    };
  });

  io.to(ADMIN_ROOM).emit("viewer:count", payload);
}

function readClientIp(socket) {
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return (rawIp || socket.handshake.address || "").split(",")[0].trim();
}

function releaseViewer(socket) {
  const key = socket.data.viewerKey;
  if (!key) return;

  const nextCount = Math.max((viewerCounts.get(key) || 1) - 1, 0);
  if (nextCount === 0) {
    viewerCounts.delete(key);
  } else {
    viewerCounts.set(key, nextCount);
  }

  const ip = socket.data.viewerIp;
  const ipCounts = ip ? viewerIpCounts.get(key) : null;
  if (ipCounts) {
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

  socket.data.viewerKey = undefined;
  socket.data.viewerIp = undefined;
}

function handleSocketConnection(socket) {
  socket.on("viewer:join", (payload, ack) => {
    const year = Number(payload && payload.year);
    const section =
      payload && typeof payload.section === "string" ? payload.section.trim().toUpperCase() : "";

    if (!Number.isInteger(year) || year < 0 || year > 5 || !section || section.length > 16) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }

    // A client that re-emits viewer:join (reconnect handler, remount) must not
    // be counted twice: drop the previous registration first.
    releaseViewer(socket);

    const viewerKey = `${year}-${section}`;
    const ip = readClientIp(socket);

    socket.join("stream");
    socket.join(`class:${viewerKey}`);
    socket.data.viewerKey = viewerKey;
    socket.data.viewerIp = ip;

    viewerCounts.set(viewerKey, (viewerCounts.get(viewerKey) || 0) + 1);
    if (ip) {
      if (!viewerIpCounts.has(viewerKey)) {
        viewerIpCounts.set(viewerKey, new Map());
      }
      viewerIpCounts.get(viewerKey).set(ip, (viewerIpCounts.get(viewerKey).get(ip) || 0) + 1);
    }

    emitViewerCounts();

    if (typeof ack === "function") {
      ack({ ok: true });
    }
  });

  socket.on("admin:join", () => {
    if (!socket.data.isAdmin) return;
    socket.join(ADMIN_ROOM);
    emitViewerCounts();
  });

  socket.on("disconnect", () => {
    if (!socket.data.viewerKey) return;
    releaseViewer(socket);
    emitViewerCounts();
  });
}

module.exports = {
  broadcast,
  handleSocketConnection,
  setSocketServer,
};
