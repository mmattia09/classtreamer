import { describe, expect, test } from "bun:test";

import {
  buildSessionPayload,
  isSessionPayloadValid,
  readSessionExpiry,
  splitSessionToken,
} from "@/lib/session-token";

const NOW = Date.UTC(2026, 0, 1);

describe("splitSessionToken", () => {
  // The payload contains a dot, so the split must happen at the last one.
  test("splits at the last dot", () => {
    expect(splitSessionToken("admin.123.abcdef")).toEqual({
      payload: "admin.123",
      signature: "abcdef",
    });
  });

  test("rejects a token with no dot", () => {
    expect(splitSessionToken("admin")).toBeNull();
  });

  test("rejects a token with an empty signature", () => {
    expect(splitSessionToken("admin.123.")).toBeNull();
  });

  test("rejects a token with an empty payload", () => {
    expect(splitSessionToken(".abcdef")).toBeNull();
  });
});

describe("readSessionExpiry", () => {
  test("reads the timestamp", () => {
    expect(readSessionExpiry("admin.1767225600000")).toBe(1767225600000);
  });

  test("rejects a different subject", () => {
    expect(readSessionExpiry("root.1767225600000")).toBeNull();
  });

  // The bare payload is what sessions looked like before expiry existed.
  test("rejects a payload with no expiry", () => {
    expect(readSessionExpiry("admin")).toBeNull();
  });

  test("rejects a non-numeric expiry", () => {
    expect(readSessionExpiry("admin.domani")).toBeNull();
    expect(readSessionExpiry("admin.NaN")).toBeNull();
  });

  test("rejects a non-positive expiry", () => {
    expect(readSessionExpiry("admin.0")).toBeNull();
    expect(readSessionExpiry("admin.-1")).toBeNull();
  });

  test("rejects extra segments", () => {
    expect(readSessionExpiry("admin.123.456")).toBeNull();
  });
});

describe("isSessionPayloadValid", () => {
  test("valid before the expiry", () => {
    expect(isSessionPayloadValid(buildSessionPayload(NOW + 1000), NOW)).toBe(true);
  });

  test("invalid exactly at the expiry", () => {
    expect(isSessionPayloadValid(buildSessionPayload(NOW), NOW)).toBe(false);
  });

  test("invalid after the expiry", () => {
    expect(isSessionPayloadValid(buildSessionPayload(NOW - 1), NOW)).toBe(false);
  });

  // A session issued before expiries existed must not be accepted forever.
  test("invalid for a legacy payload", () => {
    expect(isSessionPayloadValid("admin", NOW)).toBe(false);
  });
});

describe("buildSessionPayload", () => {
  test("round-trips through readSessionExpiry", () => {
    const expiresAt = NOW + 30 * 24 * 60 * 60 * 1000;
    expect(readSessionExpiry(buildSessionPayload(expiresAt))).toBe(expiresAt);
  });
});
