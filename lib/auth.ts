import crypto from "node:crypto";
import { cookies } from "next/headers";

import {
  buildSessionPayload,
  isSessionPayloadValid,
  splitSessionToken,
} from "@/lib/session-token";

const SESSION_COOKIE = "classtreamer-admin";

// 30 days in seconds
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getAdminPasswordFingerprint() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return crypto.createHash("sha256").update(adminPassword).digest("hex");
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret || secret === "dev-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a strong random value in production.");
    }
    console.warn(
      "[auth] SESSION_SECRET non impostato — uso un valore di sviluppo insicuro. Impostalo in .env prima del deploy.",
    );
    return "dev-secret";
  }

  return secret;
}

function sign(value: string) {
  // The password fingerprint is mixed into the key so that changing
  // ADMIN_PASSWORD invalidates every session already issued.
  return crypto
    .createHmac("sha256", `${getSessionSecret()}:${getAdminPasswordFingerprint()}`)
    .update(value)
    .digest("hex");
}

/**
 * Compare two hex digests without leaking how many leading characters matched.
 * A plain `===` returns as soon as it finds a difference, which lets an attacker
 * reconstruct a valid signature from response timings.
 */
function timingSafeEqualHex(a: string, b: string) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");

  // timingSafeEqual throws on length mismatch, so guard first — the length of a
  // SHA-256 digest is not secret.
  if (bufferA.length === 0 || bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export async function createAdminSession(options?: { secure?: boolean }) {
  const payload = buildSessionPayload(Date.now() + SESSION_MAX_AGE * 1000);
  const token = `${payload}.${sign(payload)}`;

  // Explicit override wins, otherwise default to secure in production.
  const isSecure = options?.secure ?? process.env.NODE_ENV === "production";

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) {
    return false;
  }

  const parts = splitSessionToken(value);
  if (!parts) {
    return false;
  }

  const { payload, signature } = parts;

  // Checked before the signature so an expired token is rejected outright.
  // Sessions issued before the expiry was added carry the bare "admin" payload
  // and no longer validate, which means one extra login after upgrading.
  if (!isSessionPayloadValid(payload, Date.now())) {
    return false;
  }

  return timingSafeEqualHex(signature, sign(payload));
}
