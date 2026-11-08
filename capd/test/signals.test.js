import { describe, expect, test } from "bun:test";
import { applySignalPolicy, SIGNAL_GROUPS } from "../src/policy/signals.js";

describe("signal policy", () => {
  test("a legacy widget can't skip a block on interaction flags", () => {
    const legacy = { riskFlags: ["legacy_widget"] };
    expect(applySignalPolicy({}, legacy).blockedBy).toBeNull();
    for (const flag of [
      "interaction_synthetic_clicks",
      "interaction_synthetic_keydowns",
    ]) {
      expect(
        applySignalPolicy({ signalActions: { [flag]: "block" } }, legacy)
          .blockedBy,
      ).toBe("legacy_widget");
      expect(
        applySignalPolicy(
          { signalActions: { [flag]: "block", legacy_widget: "off" } },
          legacy,
        ).blockedBy,
      ).toBe("legacy_widget");
    }
    expect(
      applySignalPolicy(
        { signalActions: { interaction_synthetic_clicks: "block" } },
        { riskFlags: [] },
      ).blockedBy,
    ).toBeNull();
  });

  test("an isolated frame can't skip a block on interaction flags", () => {
    const isolated = { riskFlags: ["isolated_frame"] };
    expect(applySignalPolicy({}, isolated).blockedBy).toBeNull();
    expect(
      applySignalPolicy(
        {
          signalActions: {
            interaction_synthetic_clicks: "block",
            isolated_frame: "off",
          },
        },
        isolated,
      ).blockedBy,
    ).toBe("isolated_frame");
  });

  test("the catalog lists the new flags and drops unused ones", () => {
    const ids = SIGNAL_GROUPS.flatMap((g) => g.signals.map(([id]) => id));
    expect(ids).toContain("legacy_widget");
    expect(ids).toContain("isolated_frame");
    expect(ids).toContain("csp_eval_blocked");
    expect(ids).toContain("host_unreachable");
    expect(ids).not.toContain("agent_report_mismatch");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
