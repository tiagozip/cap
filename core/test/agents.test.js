import { beforeEach, describe, expect, test } from "bun:test";
import { generateNonce, sign } from "web-bot-auth";
import { signerFromJWK } from "web-bot-auth/crypto";
import {
  agentFromCodes,
  agentFromHeaders,
  agentFromTrace,
  clearAgentDirectoryCache,
  parseSignatureAgent,
  summarizeAgent,
  verifyWebBotAuth,
} from "../src/agents.js";
import { validateChallenge } from "../src/index.js";
import {
  boundPayload,
  issue,
  solveChallengeFromPublic,
  TEST_SECRET,
} from "./helpers.js";

const KEY = {
  kty: "OKP",
  crv: "Ed25519",
  alg: "EdDSA",
  kid: "test-key-ed25519",
  d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
  x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
};
const PUB = { kty: KEY.kty, crv: KEY.crv, x: KEY.x };

let fetches = [];
const directoryFetch = async (url) => {
  fetches.push(url);
  if (
    url === "https://chatgpt.com/.well-known/http-message-signatures-directory"
  ) {
    return Response.json({ keys: [PUB] });
  }
  return new Response("not found", { status: 404 });
};

async function signed(
  url,
  signatureAgent,
  { expiresIn = 60_000, now = new Date() } = {},
) {
  const req = new Request(url, {
    method: "POST",
    headers: { "Signature-Agent": signatureAgent },
  });
  const f = await sign(req, {
    signer: await signerFromJWK(KEY),
    created: now,
    expires: new Date(now.getTime() + expiresIn),
    nonce: generateNonce(),
  });
  return {
    method: "POST",
    url,
    headers: new Headers({
      host: new URL(url).host,
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
      "Signature-Agent": signatureAgent,
      Signature: f.signature,
      "Signature-Input": f.signatureInput,
    }),
  };
}

const URL_ = "https://cap.example.com/site/redeem";

beforeEach(() => {
  clearAgentDirectoryCache();
  fetches = [];
});

describe("Web Bot Auth", () => {
  test("parses both Signature-Agent forms", () => {
    expect(parseSignatureAgent('"https://chatgpt.com"')).toEqual([
      { label: null, url: "https://chatgpt.com" },
    ]);
    expect(parseSignatureAgent('g="https://agent.bot.goog"')).toEqual([
      { label: "g", url: "https://agent.bot.goog" },
    ]);
    expect(
      parseSignatureAgent('sig1="https://chatgpt.com";type=directory'),
    ).toEqual([{ label: "sig1", url: "https://chatgpt.com" }]);
  });

  for (const sa of [
    '"https://chatgpt.com"',
    'sig1="https://chatgpt.com";type=directory',
  ]) {
    test(`verifies a reference-library signature (${sa})`, async () => {
      const req = await signed(URL_, sa);
      const r = await verifyWebBotAuth(req, { fetch: directoryFetch });
      expect(r).toMatchObject({
        verified: true,
        agent: "chatgpt-agent",
        origin: "https://chatgpt.com",
      });
    });
  }

  test("rejects a tampered signature, a wrong key and an expired one", async () => {
    const req = await signed(URL_, '"https://chatgpt.com"');
    const bad = new Headers(req.headers);
    bad.set(
      "Signature",
      req.headers
        .get("Signature")
        .replace(/:(.)/, (_, c) => `:${c === "A" ? "B" : "A"}`),
    );
    expect(
      (
        await verifyWebBotAuth(
          { ...req, headers: bad },
          { fetch: directoryFetch },
        )
      ).verified,
    ).toBe(false);

    const otherHost = new Headers(req.headers);
    otherHost.set("host", "evil.example.com");
    expect(
      (
        await verifyWebBotAuth(
          { ...req, headers: otherHost },
          { fetch: directoryFetch },
        )
      ).reason,
    ).toBe("bad_signature");

    const old = await signed(URL_, '"https://chatgpt.com"', {
      now: new Date(Date.now() - 600_000),
    });
    expect(
      (await verifyWebBotAuth(old, { fetch: directoryFetch })).reason,
    ).toBe("expired");
  });

  test("never fetches directories of unknown origins (SSRF)", async () => {
    const req = await signed(URL_, '"https://169.254.169.254"');
    const r = await verifyWebBotAuth(req, { fetch: directoryFetch });
    expect(r.reason).toBe("untrusted_signature_agent");
    expect(fetches).toEqual([]);
  });

  test("only fetches signing directories over https on the default port", async () => {
    for (const sa of ['"http://chatgpt.com"', '"https://chatgpt.com:8443"']) {
      const r = await verifyWebBotAuth(await signed(URL_, sa), {
        fetch: directoryFetch,
      });
      expect(r.verified).toBe(false);
    }
    expect(fetches).toEqual([]);
  });

  test("a signature has to cover the authority, and the authority can be pinned", async () => {
    const req = await signed(URL_, '"https://chatgpt.com"');
    const input = req.headers.get("Signature-Input");
    const stripped = new Headers(req.headers);
    stripped.set("Signature-Input", input.replace('"@authority" ', ""));
    expect(
      (
        await verifyWebBotAuth(
          { ...req, headers: stripped },
          { fetch: directoryFetch },
        )
      ).reason,
    ).toBe("authority_not_signed");
    expect(
      (
        await verifyWebBotAuth(req, {
          fetch: directoryFetch,
          authority: "captcha.example.org",
        })
      ).reason,
    ).toBe("wrong_authority");
    expect(
      (
        await verifyWebBotAuth(req, {
          fetch: directoryFetch,
          authority: "cap.example.com",
        })
      ).verified,
    ).toBe(true);
  });

  test("a nonce check makes signatures single-use", async () => {
    const seen = new Set();
    const nonceCheck = (n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    };
    const req = await signed(URL_, '"https://chatgpt.com"');
    expect(
      (await verifyWebBotAuth(req, { fetch: directoryFetch, nonceCheck }))
        .verified,
    ).toBe(true);
    expect(
      (await verifyWebBotAuth(req, { fetch: directoryFetch, nonceCheck }))
        .reason,
    ).toBe("replayed_signature");
  });
});

describe("agentFromHeaders", () => {
  test("documented UA tokens", () => {
    const ua = (s) => agentFromHeaders({ "User-Agent": s })[0];
    expect(
      ua(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-Agent/1.0) Chrome/154.0.0.0 Safari/537.36",
      ),
    ).toMatchObject({ agent: "claude-agent", confidence: "high" });
    expect(
      ua(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/150.0.0.0 Safari/537.36",
      ),
    ).toMatchObject({ agent: "google-agent", confidence: "high" });
    expect(
      ua(
        "Mozilla/5.0 (Macintosh) Chrome/150.0.0.0 Safari/537.36; Manus-User/1.0",
      ),
    ).toMatchObject({
      agent: "manus",
    });
    expect(
      agentFromHeaders({
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/150.0.0.0",
      }),
    ).toEqual([]);
  });

  test("new agent UA tokens and signing origins", () => {
    const one = (h) => agentFromHeaders(h)[0];
    expect(
      one({
        "User-Agent":
          "Mozilla/5.0 (Macintosh) Chrome/150.0.0.0 Safari/537.36 Agent-NovaAct/0.9",
      }),
    ).toMatchObject({ agent: "nova-act", confidence: "high" });
    expect(
      one({ "signature-agent": '"https://www.browserbase.com"' }),
    ).toMatchObject({ agent: "browserbase", confidence: "medium" });
    expect(
      one({ "signature-agent": '"https://cursorusercontent.com"' }),
    ).toMatchObject({ agent: "grok-bot", confidence: "medium" });
    expect(
      one({
        "signature-agent":
          '"https://abc123.keydirectory.signer.us-east-1.on.aws"',
      }),
    ).toMatchObject({ agent: "aws-agentcore" });
    expect(one({ "signature-agent": '"https://evil.on.aws"' })).toMatchObject({
      agent: "signed:evil.on.aws",
    });
  });

  test("an unverified Signature-Agent claim is medium; platform mismatch is low", () => {
    const f = agentFromHeaders({
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",
      "sec-ch-ua-platform": '"Linux"',
      "signature-agent": '"https://chatgpt.com"',
    });
    expect(f).toContainEqual(
      expect.objectContaining({ agent: "chatgpt-agent", confidence: "medium" }),
    );
    expect(f).toContainEqual(
      expect.objectContaining({
        confidence: "low",
        evidence: "ua_platform_mismatch:macOS/Linux",
      }),
    );
    expect(
      summarizeAgent(f.filter((x) => x.confidence === "low")),
    ).toMatchObject({ detected: false });
  });
});

const base = (over = {}) => ({
  v: 1,
  res: 0.1,
  now: 5000,
  vis: 300,
  last: 3400,
  us: -1,
  env: [1280, 900, 1, 1, 0, 87, 0, 0],
  n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  m: [],
  k: [],
  a: null,
  ag: [],
  ...over,
});
const press = (over) => ({
  k: 0,
  tr: 1,
  hid: 0,
  pt: 0,
  t: 4000,
  u: 4090,
  x: 458.5,
  y: 249.5,
  cx: 0,
  cy: 0,
  w: 243,
  h: 57,
  sox: 0,
  soy: 87,
  cw: 1,
  ch: 1,
  pr: 0.5,
  ...over,
});

describe("agentFromTrace (measured click code paths)", () => {
  test("browser-use 0.13.14 as measured: gap 53ms, press 89ms, exact center", () => {
    const f = agentFromTrace(
      base({
        m: [
          [44.6, 640, 425, 1, 0],
          [3947, 458.5, 249.5, 1, 0],
        ],
        a: press({ t: 4000, u: 4089 }),
      }),
    );
    expect(f).toEqual([
      {
        agent: "browser-use",
        confidence: "medium",
        evidence: "click:browser_use",
      },
    ]);
  });

  test("Playwright click as measured: gap 1.5ms, press 0ms", () => {
    const f = agentFromTrace(
      base({
        m: [[3998.5, 400, 225, 1, 0]],
        a: press({ t: 4000, u: 4000, x: 400, y: 225 }),
      }),
    );
    expect(f[0]).toMatchObject({ agent: "cdp-automation" });
  });

  test("Claude in Chrome code path: rounded coords, 250ms+ cursor wait, 12ms hold", () => {
    const f = agentFromTrace(
      base({
        m: [[3700, 421, 252, 1, 0]],
        a: press({ t: 4000, u: 4014, x: 421, y: 252, cx: -37.5, cy: 2.5 }),
      }),
    );
    expect(f[0]).toMatchObject({
      agent: "claude-in-chrome",
      confidence: "medium",
    });
  });

  test("Chromium actor click: warp, 5ms to press, 5ms held, integer center", () => {
    const f = agentFromTrace(
      base({
        m: [[3995, 458, 249, 1, 0]],
        a: press({ t: 4000, u: 4005, x: 458, y: 249, cx: -0.5, cy: -0.5 }),
      }),
    );
    expect(f[0]).toMatchObject({
      agent: "gemini-in-chrome",
      evidence: "click:chrome_actor",
    });
  });

  test("Chromium actor typing: 25ms down, 25ms up", () => {
    const k = [];
    for (let i = 0; i < 10; i++) k.push([1000 + i * 50 + (i % 2), 25]);
    const f = agentFromTrace(base({ k }));
    expect(f).toContainEqual({
      agent: "gemini-in-chrome",
      confidence: "medium",
      evidence: "typing:chrome_actor",
    });
  });

  test("accessibility click: no move, zero pressure, same task, center", () => {
    const f = agentFromTrace(
      base({ a: press({ t: 4000, u: 4000.2, pr: 0, cx: 0.5, cy: 0 }) }),
    );
    expect(f).toContainEqual({
      agent: null,
      confidence: "low",
      evidence: "click:ax_simulated",
    });
  });

  test("uppercase without a shift keydown is low evidence", () => {
    const f = agentFromTrace(base({ n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] }));
    expect(f).toContainEqual({
      agent: null,
      confidence: "low",
      evidence: "typing:phantom_shift",
    });
  });

  test("a human approach is not an agent", () => {
    const m = [];
    for (let i = 0; i < 30; i++)
      m.push([
        3300 + i * 16.7,
        100 + i * 12 + (i % 3),
        600 - i * 11 + (i % 2),
        1,
        0,
      ]);
    m.push([3820, 431.3, 255.1, 1, 0]);
    expect(
      agentFromTrace(
        base({ m, a: press({ x: 431.3, y: 255.1, cx: -27.2, cy: 5.6 }) }),
      ),
    ).toEqual([]);
  });

  test("artifacts and typing", () => {
    expect(agentFromCodes(["cic_active"])[0]).toMatchObject({
      agent: "claude-in-chrome",
      confidence: "high",
    });
    const k = Array.from({ length: 10 }, (_, i) => [1000 + i * 10, 1]);
    expect(agentFromTrace(base({ k })).map((x) => x.evidence)).toContain(
      "typing:superhuman",
    );
    const human = Array.from({ length: 10 }, (_, i) => [
      1000 + i * 140 + (i % 3) * 40,
      90,
    ]);
    expect(agentFromTrace(base({ k: human }))).toEqual([]);
    expect(summarizeAgent(agentFromTrace(base({ k })))).toMatchObject({
      detected: false,
      name: null,
    });
  });

  test("artifact codes from the Castle inventory map to their agents", () => {
    const cases = [
      ["cic_legacy", "claude-in-chrome", "medium"],
      ["codex", "codex", "medium"],
      ["browserflow", "browserflow", "medium"],
      ["thunderbit", "thunderbit", "medium"],
      ["fellou", "fellou", "medium"],
      ["stagehand", "stagehand", "high"],
      ["comet", "perplexity-comet", "medium"],
      ["twocaptcha", "2captcha-solver", "medium"],
    ];
    for (const [code, agent, confidence] of cases) {
      expect(agentFromCodes([code])).toEqual([
        { agent, confidence, evidence: `artifact:${code}` },
      ]);
      expect(summarizeAgent(agentFromCodes([code]))).toMatchObject({
        detected: true,
        name: agent,
        confidence,
      });
    }
  });
});

describe("agent policy through validateChallenge", () => {
  async function run(behavior, trace, vopts = {}) {
    const { challenge: ch, meta } = await issue({ behavior });
    const { ag = [], ...bh } = trace;
    const solutions = await solveChallengeFromPublic(ch);
    return validateChallenge(
      TEST_SECRET,
      {
        token: ch.token,
        solutions,
        instr: boundPayload(meta, { bh, ag: [...ag].sort() }),
      },
      vopts,
    );
  }
  const claude = () =>
    base({ ag: ["cic_active"], a: { k: 1, tr: 1, hid: 0, t: 4000, u: 4090 } });

  test("report mode labels the agent without failing", async () => {
    const r = await run(true, claude());
    expect(r.success).toBe(true);
    expect(r.behavior.verdict).toBe("agent");
    expect(r.behavior.agent).toMatchObject({
      name: "claude-in-chrome",
      confidence: "high",
    });
    expect(r.riskFlags).toContain("agent:claude-in-chrome");
  });

  test("blockAgents: identified blocks high confidence only; all blocks medium too", async () => {
    expect((await run({ blockAgents: "identified" }, claude())).reason).toBe(
      "behavior_agent",
    );
    const pw = base({
      m: [[3998.5, 400, 225, 1, 0]],
      a: press({ t: 4000, u: 4000, x: 400, y: 225 }),
    });
    expect((await run({ blockAgents: "identified" }, pw)).success).toBe(true);
    expect((await run({ blockAgents: "all" }, pw)).reason).toBe(
      "behavior_agent",
    );
  });

  test("verified signed agents can be allowed", async () => {
    const req = await signed(URL_, '"https://chatgpt.com"');
    const opts = {
      request: req,
      verifyWebBotAuth: true,
      fetch: directoryFetch,
    };
    const blocked = await run({ blockAgents: "all" }, base(), opts);
    expect(blocked.reason).toBe("behavior_agent");
    expect(blocked.behavior.agent).toMatchObject({
      name: "chatgpt-agent",
      verified: true,
      confidence: "high",
    });
    const allowed = await run(
      { blockAgents: "all", allowVerifiedAgents: true },
      base(),
      opts,
    );
    expect(allowed.success).toBe(true);
    expect(allowed.behavior.verdict).toBe("agent");
  });

  test("a signature for another host is not verified", async () => {
    const req = await signed(
      "https://evil.example/site/redeem",
      '"https://chatgpt.com"',
    );
    const opts = {
      request: { ...req, url: URL_ },
      verifyWebBotAuth: true,
      fetch: directoryFetch,
    };
    const policy = { blockAgents: "all", allowVerifiedAgents: true };
    const r = await run(policy, base(), opts);
    expect(r.reason).toBe("behavior_agent");
    expect(r.behavior.agent.verified).toBe(false);
    const pinned = await run(policy, base(), {
      ...opts,
      webBotAuthAuthority: "evil.example",
    });
    expect(pinned.success).toBe(true);
  });

  test("an unverifiable claim is not allowed through as verified", async () => {
    const req = await signed(URL_, '"https://chatgpt.com"');
    const forged = new Headers(req.headers);
    forged.set("Signature", "sig1=:AAAA:");
    const r = await run(
      { blockAgents: "all", allowVerifiedAgents: true },
      base(),
      {
        request: { ...req, headers: forged },
        verifyWebBotAuth: true,
        fetch: directoryFetch,
      },
    );
    expect(r.reason).toBe("behavior_agent");
    expect(r.behavior.agent.verified).toBe(false);
  });
});
