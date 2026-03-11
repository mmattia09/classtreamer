"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/socket.io",
      autoConnect: true,
    });
  }

  return socket;
}
