import { describe, expect, test } from "bun:test";
import {
  decryptGcm,
  encryptGcm,
  jwtSigHex,
  jwtSign,
  jwtVerify,
  randomHex,
  sha256Hex,
} from "../src/crypto.js";

const SECRET = "meow-meow-meow-meow-dont-use-in-prod-meow-meow-meow-meow";

describe("jwtSign / jwtVerify", () => {
  test("round trips an object payload", () => {
    const payload = { foo: "bar", n: 42, arr: [1, 2, 3] };
    const token = jwtSign(payload, SECRET);
    const decoded = jwtVerify(token, SECRET);
    expect(decoded).toEqual(payload);
  });

  test("returns null for invalid signature", () => {
    const token = jwtSign({ a: 1 }, SECRET);
    expect(jwtVerify(token, "woof-woof-woof-woof-dont-use-in-prod-woof-woof-woof-woof")).toBeNull();
  });

  test("returns null for malformed token", () => {
    expect(jwtVerify("", SECRET)).toBeNull();
    expect(jwtVerify(null, SECRET)).toBeNull();
    expect(jwtVerify(undefined, SECRET)).toBeNull();
    expect(jwtVerify("a.b", SECRET)).toBeNull();
    expect(jwtVerify("a.b.c.d", SECRET)).toBeNull();
    expect(jwtVerify(123, SECRET)).toBeNull();
  });

  test("rejects tampered payload", () => {
    const token = jwtSign({ user: "alice" }, SECRET);
    const [h, , s] = token.split(".");
    const fake = Buffer.from(JSON.stringify({ user: "bob" })).toString(
      "base64url",
    );
    expect(jwtVerify(`${h}.${fake}.${s}`, SECRET)).toBeNull();
  });

  test("returns null for invalid JSON in payload", async () => {
    const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString(
      "base64url",
    );
    const badBody = Buffer.from("not json").toString("base64url");
    const sigInput = `${header}.${badBody}`;
    const crypto = await import("node:crypto");
    const sig = crypto
      .createHmac("sha256", SECRET)
      .update(sigInput)
      .digest()
      .toString("base64url");
    expect(jwtVerify(`${sigInput}.${sig}`, SECRET)).toBeNull();
  });

  test("rejects tokens with mismatched signature length", () => {
    const t = jwtSign({ a: 1 }, SECRET);
    const parts = t.split(".");
    const truncatedSig = parts[2].slice(0, 20);
    expect(
      jwtVerify(`${parts[0]}.${parts[1]}.${truncatedSig}`, SECRET),
    ).toBeNull();
  });

  test("two same payloads with different secrets give different sigs", () => {
    const a = jwtSign({ x: 1 }, SECRET);
    const b = jwtSign({ x: 1 }, "another-32-byte-secret-padding-junk!");
    expect(a.split(".")[0]).toBe(b.split(".")[0]);
    expect(a.split(".")[1]).toBe(b.split(".")[1]);
    expect(a.split(".")[2]).not.toBe(b.split(".")[2]);
  });
});

describe("jwtSigHex", () => {
  test("returns hex of the signature segment", () => {
    const t = jwtSign({ a: 1 }, SECRET);
    const sig = jwtSigHex(t);
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(sig.length).toBe(64);
  });

  test("returns null for malformed", () => {
    expect(jwtSigHex(null)).toBeNull();
    expect(jwtSigHex("nocolon")).toBeNull();
    expect(jwtSigHex("")).toBeNull();
  });
});

describe("encryptGcm / decryptGcm", () => {
  test("round trips data", () => {
    const data = { id: "abc", vals: [1, 2, 3] };
    const blob = encryptGcm(data, SECRET);
    expect(typeof blob).toBe("string");
    expect(decryptGcm(blob, SECRET)).toEqual(data);
  });

  test("encryption is non-deterministic (random IV)", () => {
    const data = { foo: "bar" };
    const a = encryptGcm(data, SECRET);
    const b = encryptGcm(data, SECRET);
    expect(a).not.toBe(b);
    expect(decryptGcm(a, SECRET)).toEqual(data);
    expect(decryptGcm(b, SECRET)).toEqual(data);
  });

  test("returns null for wrong secret", () => {
    const blob = encryptGcm({ foo: "bar" }, SECRET);
    expect(decryptGcm(blob, "different-secret-padding-junk-32!")).toBeNull();
  });

  test("returns null for tampered blob", () => {
    const blob = encryptGcm({ foo: "bar" }, SECRET);
    const buf = Buffer.from(blob, "base64url");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64url");
    expect(decryptGcm(tampered, SECRET)).toBeNull();
  });

  test("returns null for too-short blob", () => {
    expect(decryptGcm("aGVsbG8", SECRET)).toBeNull();
  });

  test("returns null on bad input gracefully", () => {
    expect(decryptGcm("notvalidbase64!!!@@@", SECRET)).toBeNull();
  });

  test("info parameter scopes keys", () => {
    const blob = encryptGcm({ foo: "bar" }, SECRET, "context-A");
    expect(decryptGcm(blob, SECRET, "context-B")).toBeNull();
    expect(decryptGcm(blob, SECRET, "context-A")).toEqual({ foo: "bar" });
  });
});

describe("randomHex", () => {
  test("returns hex of correct length (2x bytes)", () => {
    expect(randomHex(8)).toMatch(/^[0-9a-f]{16}$/);
    expect(randomHex(32)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("two calls give different output", () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });

  test("zero bytes returns empty string", () => {
    expect(randomHex(0)).toBe("");
  });
});

describe("sha256Hex", () => {
  test("returns 64-char hex", async () => {
    const h = await sha256Hex("hello");
    expect(h).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  test("deterministic", async () => {
    const a = await sha256Hex("the quick brown fox");
    const b = await sha256Hex("the quick brown fox");
    expect(a).toBe(b);
  });

  test("different inputs give different outputs", async () => {
    const a = await sha256Hex("a");
    const b = await sha256Hex("b");
    expect(a).not.toBe(b);
  });

  test("handles empty string", async () => {
    const h = await sha256Hex("");
    expect(h).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("handles unicode", async () => {
    const h = await sha256Hex("héllo wörld 🌍");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
