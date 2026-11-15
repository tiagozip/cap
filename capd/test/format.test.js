import { describe, expect, test } from "bun:test";
import { ago, bytes, compact, latency } from "../dashboard/src/lib/format.js";

describe("dashboard format helpers", () => {
  test("compact moves to M when rounding reaches 1000k", () => {
    expect(compact(999_400)).toBe("999k");
    expect(compact(999_500)).toBe("1M");
    expect(compact(999_999)).toBe("1M");
    expect(compact(1_000_000)).toBe("1M");
    expect(compact(9_999)).toBe("10k");
  });

  test("latency moves to seconds when rounding reaches 1000ms", () => {
    expect(latency(999.4)).toBe("999ms");
    expect(latency(999.6)).toBe("1.0s");
    expect(latency(1000)).toBe("1.0s");
    expect(latency(9_960)).toBe("10s");
    expect(latency(12_400)).toBe("12s");
  });

  test("bytes moves to the next unit when rounding reaches 1000", () => {
    expect(bytes(999_400)).toBe("999 kB");
    expect(bytes(999_600)).toBe("1.0 MB");
    expect(bytes(1_000_000)).toBe("1.0 MB");
    expect(bytes(999_960_000)).toBe("1.0 GB");
    expect(bytes(undefined)).toBe("0 kB");
  });

  test("ago moves to the next unit when rounding reaches 60m or 24h", () => {
    const now = Date.now();
    expect(ago(now - 3_500_000)).toBe("58m ago");
    expect(ago(now - 3_570_000)).toBe("1h ago");
    expect(ago(now - 86_000_000)).toBe("1d ago");
    expect(ago(now - 80_000_000)).toBe("22h ago");
  });
});
