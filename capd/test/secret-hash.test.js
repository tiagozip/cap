import { describe, expect, test } from "bun:test";
import {
  hashSecret,
  sameHex,
  tokenId,
  verifySecret,
} from "../src/secret-hash.js";

describe("secret hashing", () => {
  test("hashes are SHA-256 and verify", () => {
    const stored = hashSecret("abc");
    expect(stored).toBe(`sha256:${tokenId("abc")}`);
    expect(verifySecret("abc", stored)).toBe(true);
    expect(verifySecret("abd", stored)).toBe(false);
    expect(verifySecret(undefined, stored)).toBe(false);
  });

  test("argon2 and bcrypt hashes are rejected without being checked", async () => {
    for (const algorithm of ["argon2id", "bcrypt"]) {
      const stored = await Bun.password.hash("old", algorithm);
      const start = performance.now();
      expect(verifySecret("old", stored)).toBe(false);
      expect(performance.now() - start).toBeLessThan(5);
    }
  });

  test("anything else is rejected", () => {
    for (const stored of [null, "", "abc", "sha256:zz", "$scrypt$x"]) {
      expect(verifySecret("abc", stored)).toBe(false);
    }
  });

  test("sameHex wants two 32-byte digests", () => {
    expect(sameHex(tokenId("a"), tokenId("a"))).toBe(true);
    expect(sameHex(tokenId("a"), tokenId("b"))).toBe(false);
    expect(sameHex("ab", "ab")).toBe(false);
    expect(sameHex(tokenId("a"), undefined)).toBe(false);
    expect(sameHex(`${tokenId("a")}zz`, tokenId("a"))).toBe(false);
  });
});
