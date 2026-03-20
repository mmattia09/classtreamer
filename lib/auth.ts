import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "classtreamer-admin";

function getAdminPasswordFingerprint() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  return crypto.createHash("sha256").update(adminPassword).digest("hex");
}

function sign(value: string) {
  const secret = process.env.SESSION_SECRET ?? "dev-secret";
  return crypto
    .createHmac("sha256", `${secret}:${getAdminPasswordFingerprint()}`)
    .update(value)
    .digest("hex");
}

export async function createAdminSession(options?: { secure?: boolean }) {
  const payload = "admin";
  const token = `${payload}.${sign(payload)}`;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // In Docker/Compose we often run with NODE_ENV=production on plain HTTP.
    // Let the caller decide based on request scheme / proxy headers.
    secure: options?.secure ?? false,
    path: "/",
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
