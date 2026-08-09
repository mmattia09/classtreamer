import crypto from "node:crypto";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * An opaque per-device identifier used to keep one device to one answer per
 * question. It is not an account and identifies nobody: a random value, set
 * httpOnly so page scripts cannot read it, and never shown in the UI.
 *
 * Clearing cookies or using a private window produces a new token, so this
 * discourages casual double-voting rather than preventing it outright — which
 * is the most that is possible without asking students to sign in.
 */

const DEVICE_COOKIE = "classtreamer-device";

// A school year, so a device keeps its identity across a term of assemblies.
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function readDeviceToken() {
  const store = await cookies();
  const value = store.get(DEVICE_COOKIE)?.value?.trim();
  return value && value.length <= 64 ? value : null;
}

export function createDeviceToken() {
  return crypto.randomUUID();
}

export function attachDeviceToken(response: NextResponse, token: string, secure: boolean) {
  response.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  return response;
}
