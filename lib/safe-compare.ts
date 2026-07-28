import crypto from "node:crypto";

/**
 * Constant-time string comparison.
 *
 * Both sides are hashed first so that inputs of different lengths can still be
 * compared with timingSafeEqual (which requires equal-length buffers) without
 * the comparison itself revealing the length of the secret.
 */
export function safeEqual(a: string, b: string) {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
