import { describe, expect, test } from "bun:test";
import { prng } from "../src/prng.js";

describe("prng", () => {
  test("deterministic — same seed gives same output", () => {
    expect(prng("seed", 32)).toBe(prng("seed", 32));
    expect(prng("hello", 16)).toBe(prng("hello", 16));
  });

  test("different seeds give different output", () => {
    expect(prng("a", 32)).not.toBe(prng("b", 32));
  });

  test("different lengths agree on prefix", () => {
    const long = prng("seed", 64);
    const short = prng("seed", 16);
    expect(long.startsWith(short)).toBe(true);
  });

  test("returns hex characters only", () => {
    expect(prng("test", 100)).toMatch(/^[0-9a-f]{100}$/);
  });

  test("respects requested length precisely", () => {
    expect(prng("x", 1)).toHaveLength(1);
    expect(prng("x", 7)).toHaveLength(7);
    expect(prng("x", 33)).toHaveLength(33);
    expect(prng("x", 100)).toHaveLength(100);
  });

  test("matches widget-side prng (regression — wire format)", () => {
    function widgetPrng(seed, length) {
      function fnv1a(str) {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
        }
        return hash >>> 0;
      }

      let state = fnv1a(seed);
      let result = "";

      function next() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
      }

      while (result.length < length) {
        const rnd = next();
        result += rnd.toString(16).padStart(8, "0");
      }

      return result.substring(0, length);
    }

    for (const seed of ["abc", "deadbeef", "tokensampleX1", "tokensampleX1d"]) {
      for (const len of [4, 8, 16, 32, 64]) {
        expect(prng(seed, len)).toBe(widgetPrng(seed, len));
      }
    }
  });

  test("handles empty seed", () => {
    expect(prng("", 16)).toMatch(/^[0-9a-f]{16}$/);
  });

  test("handles unicode seed", () => {
    expect(prng("😺", 32)).toMatch(/^[0-9a-f]{32}$/);
    expect(prng("😺", 32)).toBe(prng("😺", 32));
  });
});
