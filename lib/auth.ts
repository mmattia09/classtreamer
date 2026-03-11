import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "classtreamer-admin";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET ?? "dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function createAdminSession() {
  const payload = "admin";
  const token = `${payload}.${sign(payload)}`;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
