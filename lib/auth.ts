import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "classtreamer-admin";

function getAdminPasswordFingerprint() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return crypto.createHash("sha256").update(adminPassword).digest("hex");
}

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "dev-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a strong random value in production.");
    }
    // In development allow the insecure fallback but warn loudly
    console.warn("[auth] SESSION_SECRET not set — using insecure dev-secret. Set SESSION_SECRET in .env before deploying.");
  }
  return crypto
    .createHmac("sha256", `${secret ?? "dev-secret"}:${getAdminPasswordFingerprint()}`)
    .update(value)
    .digest("hex");
}

// 30 days in seconds
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function createAdminSession(options?: { secure?: boolean }) {
  const payload = "admin";
  const token = `${payload}.${sign(payload)}`;

  // Determine secure flag: explicit override > NODE_ENV production default
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

  const [payload, signature] = value.split(".");
  return payload === "admin" && signature === sign(payload);
}
