import { ref } from "vue";

export const demoVerdict = ref(null);

let modules;
let skipNext = false;
const load = () =>
  (modules ??= Promise.all([
    import("./demoInstr.data.js"),
    import("../../../core/src/instrumentation.js"),
    import("../../../core/src/behavior.js"),
    import("../../../core/src/agents.js"),
    import("../../../capd/src/policy/signals.js"),
  ]));

export async function instrumentationFor(variant) {
  try {
    const [{ data }] = await load();
    return { instrumentation: data[variant].instrumentation };
  } catch {
    return {};
  }
}

export async function demoInstrumentation() {
  if (skipNext) {
    skipNext = false;
    return {};
  }
  return instrumentationFor("demo");
}

export async function signalNames() {
  const [, , , , { SIGNAL_GROUPS, KNOWN_AGENTS }] = await load();
  return {
    checks: new Map(SIGNAL_GROUPS.flatMap((g) => g.signals.map(([id, name]) => [id, name]))),
    agents: new Map(KNOWN_AGENTS),
  };
}

export async function evaluateInstr(instrPayload, variant) {
  const [{ data }, instr, behavior, agents] = await load();
  const r = instr.verifyInstrumentationResult(data[variant].meta, instrPayload);
  const trace = r.trace ?? null;
  const pre = trace ? behavior.analyzeBehavior(trace, {}) : null;
  const evidence = trace && !behavior.validateTrace(trace) ? agents.agentFromTrace(trace) : [];
  const seen = new Set(evidence.map((e) => e.evidence));
  evidence.push(...agents.agentFromCodes(r.agent?.all ?? []).filter((e) => !seen.has(e.evidence)));
  evidence.push(...agents.agentFromHeaders({ "user-agent": navigator.userAgent }));
  return { result: r, behavior: pre, agent: agents.summarizeAgent(evidence, null) };
}

const show = async (reason, ids, agent) => {
  const names = await signalNames();
  demoVerdict.value = {
    reason,
    agent: agent && (names.agents.get(agent) ?? agent),
    agentId: agent,
    checks: [...new Set(ids)]
      .filter((id) => id !== "cdp_console_trap")
      .map((id) => ({ id, name: names.checks.get(id) ?? id })),
    at: Date.now(),
  };
};

export async function judgeDemo(options) {
  try {
    const body = JSON.parse(options?.body ?? "{}");
    if (!body.instr) return;
    const { result: r, behavior: pre, agent } = await evaluateInstr(body.instr, "demo");
    if (!r.valid) {
      if (["instr_automated_browser", "instr_automated_interaction"].includes(r.reason)) {
        await show(r.reason, r.blockedBy ?? []);
      }
      return;
    }
    if (agent?.detected) {
      await show("behavior_agent", pre?.flags ?? [], agent.name);
      return;
    }
    if (pre?.verdict === "automated") await show("behavior_automated", pre.flags ?? []);
  } catch {}
}

export function onDemoError(e) {
  if (e.target?.closest?.("#demo-pane-bot, .ts")) return;
  if (e.detail?.code !== "instr_blocked") return;
  show("instr_automated_browser", []);
  skipNext = true;
  const widget = e.target;
  setTimeout(() => {
    widget.reset?.();
    widget.solve?.().catch(() => {});
  }, 0);
}
