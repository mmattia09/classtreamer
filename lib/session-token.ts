/**
 * Shape of the admin session cookie, kept free of Node and Next imports so it
 * can be unit tested directly.
 *
 * A token is `admin.<expiresAtMs>.<hmac>`. The expiry lives *inside* the signed
 * payload, so it cannot be extended by editing the cookie: the cookie's own
 * maxAge is only a hint to the browser, and a client that keeps sending an
 * expired cookie is rejected by the server.
 */

export const SESSION_SUBJECT = "admin";

export function buildSessionPayload(expiresAtMs: number) {
  return `${SESSION_SUBJECT}.${expiresAtMs}`;
}

/** Split `payload.signature` on the last dot — the payload itself contains one. */
export function splitSessionToken(token: string) {
  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  return {
    payload: token.slice(0, separator),
    signature: token.slice(separator + 1),
  };
}

export function readSessionExpiry(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 2 || parts[0] !== SESSION_SUBJECT) {
    return null;
  }

  const expiresAt = Number(parts[1]);
  return Number.isSafeInteger(expiresAt) && expiresAt > 0 ? expiresAt : null;
}

export function isSessionPayloadValid(payload: string, nowMs: number) {
  const expiresAt = readSessionExpiry(payload);
  return expiresAt !== null && expiresAt > nowMs;
}
