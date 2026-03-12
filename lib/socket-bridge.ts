type SocketServerModule = {
  broadcast?: (event: string, payload: unknown) => void;
};

type GlobalWithSocket = typeof globalThis & {
  __socketServer?: SocketServerModule;
};

function getSocketServer(): SocketServerModule | null {
  const globalSocket = globalThis as GlobalWithSocket;
  if (globalSocket.__socketServer) {
    return globalSocket.__socketServer;
  }

  try {
    return require("./socket-server.cjs") as SocketServerModule;
  } catch {
    return null;
  }
}

export function broadcast(event: string, payload: unknown) {
  const server = getSocketServer();
  server?.broadcast?.(event, payload);
}
