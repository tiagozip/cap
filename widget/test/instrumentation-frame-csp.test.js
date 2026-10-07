// Guards the isolated instrumentation frame's CSP hash.
//
// The frame document allows its own inline bootstrap through a CSP hash. That
// hash is computed over exact bytes, so it must be verified against the file
// content rather than trusted: this repo is checked out with core.autocrlf=true,
// and a hand-written hash that matches on one platform silently fails on another
// (the frame then times out with "Instrumentation timed out").
//
// Runs as part of `bun test` / `npm test`.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const framePath = path.join(__dirname, "..", "src", "instrumentation.html");

const hashOf = (s) =>
  "sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64");

describe("instrumentation frame CSP", () => {
  const doc = fs.readFileSync(framePath, "utf8");
  const body = doc.match(/<script>([\s\S]*?)<\/script>/)[1];
  const declared = doc.match(/script-src '([^']+)'/)[1];

  test("declared hash matches the inline bootstrap script", () => {
    // If this fails the frame cannot execute its bootstrap, the page never
    // receives a cap:instr reply, and the widget reports "Instrumentation timed out".
    expect(declared).toBe(hashOf(body));
  });

  test("hash is unaffected by CRLF/LF checkout differences", () => {
    // The source file is intentionally pinned to LF so Git cannot silently
    // change the CSP hash on a CRLF checkout.
    expect(doc).not.toContain("\r");
    const asCrlf = doc.replace(/\n/g, "\r\n");
    const crlfBody = asCrlf.match(/<script>([\s\S]*?)<\/script>/)[1];
    expect(hashOf(crlfBody)).not.toBe(hashOf(body));
    expect(declared).toBe(hashOf(body));
  });

  test("frame keeps its restrictive policy", () => {
    for (const directive of [
      "default-src 'none'",
      "connect-src 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]) {
      expect(doc).toContain(directive);
    }
    // 'unsafe-eval' stays scoped to this frame only. The embedding page never needs it.
    expect(doc).toContain("'unsafe-eval'");
  });
});
