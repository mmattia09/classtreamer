type SocketServerModule = {
  broadcast?: (event: string, payload: unknown) => void;
};

function getSocketServer(): SocketServerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("./socket-server.cjs") as SocketServerModule;
  } catch {
    return null;
  }
}

export function broadcast(event: string, payload: unknown) {
  const server = getSocketServer();
  server?.broadcast?.(event, payload);
}
