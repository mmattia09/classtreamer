"use client";

import { io, type Socket } from "socket.io-client";

import { SOCKET_PATH } from "@/lib/app-constants";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      autoConnect: true,
    });
  }

  return socket;
}
