import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";

const RANK = { low: 1, medium: 2, high: 3 };

export const AGENT_ARTIFACTS = {
  cic_active: {
    agent: "claude-in-chrome",
    confidence: "high",
    detail: "Claude in Chrome agent overlay in the page",
  },
  cic_shared: {
    agent: "claude-in-chrome",
    confidence: "medium",
    detail: "tab is shared with Claude in Chrome",
  },
  browser_use: {
    agent: "browser-use",
    confidence: "high",
    detail: "browser-use element highlighting in the page",
  },
  cic_legacy: {
    agent: "claude-in-chrome",
    confidence: "medium",
    detail: "older Claude in Chrome animation stylesheet in the page",
  },
  codex: {
    agent: "codex",
    confidence: "medium",
    detail: "Codex agent overlay in the page",
  },
  browserflow: {
    agent: "browserflow",
    confidence: "medium",
    detail: "Browserflow container in the page",
  },
  thunderbit: {
    agent: "thunderbit",
    confidence: "medium",
    detail: "Thunderbit overlay or side bar in the page",
  },
  fellou: {
    agent: "fellou",
    confidence: "medium",
    detail: "Fellou browser globals in the page",
  },
  stagehand: {
    agent: "stagehand",
    confidence: "high",
    detail: "Stagehand v3 injected globals in the page",
  },
  twocaptcha: {
    agent: "2captcha-solver",
    confidence: "medium",
    detail: "2Captcha solver extension helpers in the page",
  },
  comet: {
    agent: "perplexity-comet",
    confidence: "medium",
    detail: "Perplexity Comet agent stylesheet or stop button in the page",
  },
  genspark: {
    agent: "genspark",
    confidence: "medium",
    detail: "Genspark browser navigator property or agent float bar",
  },
  sigma: {
    agent: "sigma",
    confidence: "medium",
    detail: "Sigma browser global in the page",
  },
  manus: {
    agent: "manus",
    confidence: "medium",
    detail: "Manus browser operator global or action mask in the page",
  },
  antigravity: {
    agent: "google-antigravity",
    confidence: "medium",
    detail: "Google Antigravity tab marker on the document",
  },
  cursor: {
    agent: "cursor",
    confidence: "medium",
    detail: "Cursor browser agent global in the page",
  },
  skyvern: {
    agent: "skyvern",
    confidence: "medium",
    detail: "Skyvern DOM markers or globals in the page",
  },
  rtrvr: {
    agent: "rtrvr",
    confidence: "high",
    detail: "rtrvr.ai agent working the page",
  },
  rtrvr_installed: {
    agent: "rtrvr",
    confidence: "low",
    detail: "rtrvr.ai extension installed",
  },
  harpa_installed: {
    agent: "harpa",
    confidence: "low",
    detail: "HARPA AI extension installed",
  },
  monica: {
    agent: "monica",
    confidence: "high",
    detail: "Monica agent browsing mask in the page",
  },
  monica_installed: {
    agent: "monica",
    confidence: "low",
    detail: "Monica extension installed",
  },
  sider: {
    agent: "sider",
    confidence: "high",
    detail: "Sider agent glow border in the page",
  },
  sider_installed: {
    agent: "sider",
    confidence: "low",
    detail: "Sider extension installed",
  },
  maxai_installed: {
    agent: "maxai",
    confidence: "low",
    detail: "MaxAI extension installed",
  },
  nova_act: {
    agent: "nova-act",
    confidence: "high",
    detail: "Amazon Nova Act element ids in the page",
  },
  agentql: {
    agent: "agentql",
    confidence: "high",
    detail: "AgentQL element ids in the page",
  },
  hyperagent: {
    agent: "hyperagent",
    confidence: "high",
    detail: "HyperAgent globals in the page",
  },
  agent_browser: {
    agent: "agent-browser",
    confidence: "high",
    detail: "agent-browser snapshot markers in the page",
  },
  do_browser: {
    agent: "do-browser",
    confidence: "high",
    detail: "Do Browser agent glow in the page",
  },
  nanobrowser: {
    agent: "nanobrowser",
    confidence: "high",
    detail: "Nanobrowser agent border in the page",
  },
  dassi: {
    agent: "dassi",
    confidence: "medium",
    detail: "dassi agent overlay in the page",
  },
  kimi: {
    agent: "kimi",
    confidence: "high",
    detail: "Kimi WebBridge agent visuals in the page",
  },
  magnitude: {
    agent: "magnitude",
    confidence: "medium",
    detail: "Magnitude cursor and typing effects in the page",
  },
  lavague: {
    agent: "lavague",
    confidence: "medium",
    detail: "LaVague element highlighting in the page",
  },
  kernel: {
    agent: "kernel",
    confidence: "medium",
    detail: "Kernel browser event injection in the page",
  },
};

export function agentFromCodes(codes) {
  const found = [];
  for (const code of codes ?? []) {
    const a = Object.hasOwn(AGENT_ARTIFACTS, code) && AGENT_ARTIFACTS[code];
    if (a)
      found.push({
        agent: a.agent,
        confidence: a.confidence,
        evidence: `artifact:${code}`,
      });
  }
  return found;
}

const UA_TOKENS = [
  [/\bClaude-Agent\/\d/, "claude-agent", "high"],
  [/\bGoogle-Agent\b/, "google-agent", "high"],
  [/\bManus-User\/\d/, "manus", "high"],
  [/\bChatGPT-User\/\d/, "chatgpt-user", "high"],
  [/\bGrokAgent\b/, "grok-bot", "medium"],
  [/\bAgent-NovaAct\/\d/, "nova-act", "high"],
  [/\bTwinAgent\/\d/, "twin", "high"],
  [/\bCloudflareBrowserRenderingCrawler\/\d/, "cloudflare-browser-run", "high"],
];

const SIGNATURE_AGENTS = {
  "chatgpt.com": "chatgpt-agent",
  "agent.bot.goog": "google-agent",
  "api.manus.im": "manus",
  "cursorusercontent.com": "grok-bot",
  "www.browserbase.com": "browserbase",
  "www.kernel.sh": "kernel",
  "www.hyperbrowser.ai": "hyperbrowser",
  "api.hyperbrowser.ai": "hyperbrowser",
  "api.anchorbrowser.io": "anchor-browser",
  "web-bot-auth.cloudflare-browser-rendering-085.workers.dev":
    "cloudflare-browser-run",
  "api.agi.tech": "agi-agent",
};

const SIGNATURE_AGENT_SUFFIXES = [
  [/^[a-z0-9-]+\.keydirectory\.signer\.[a-z0-9-]+\.on\.aws$/, "aws-agentcore"],
];

const signatureAgentFor = (host) =>
  SIGNATURE_AGENTS[host] ??
  SIGNATURE_AGENT_SUFFIXES.find(([re]) => re.test(host))?.[1] ??
  null;

function header(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v.join(", ") : v;
  }
  return null;
}

export function parseSignatureAgent(value) {
  if (!value || typeof value !== "string") return [];
  const out = [];
  const re = /(?:([a-z*][a-z0-9_.*-]*)=)?"(https:\/\/[^"]+)"/gi;
  for (const m of value.matchAll(re))
    out.push({ label: m[1] ?? null, url: m[2] });
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function agentFromHeaders(headers) {
  const found = [];
  const ua = header(headers, "user-agent") || "";
  for (const [re, agent, confidence] of UA_TOKENS) {
    if (re.test(ua)) {
      found.push({ agent, confidence, evidence: `ua:${agent}` });
    }
  }

  const sa = header(headers, "signature-agent");
  for (const { url } of parseSignatureAgent(sa)) {
    const host = hostOf(url);
    if (!host) continue;
    found.push({
      agent: signatureAgentFor(host) ?? `signed:${host}`,
      confidence: "medium",
      evidence: `signature_agent:${host}`,
      signatureAgent: url,
    });
  }

  const platform = (header(headers, "sec-ch-ua-platform") || "").replace(
    /"/g,
    "",
  );
  if (platform) {
    const uaPlatform = /Windows/.test(ua)
      ? "Windows"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux|X11/.test(ua)
            ? "Linux"
            : null;
    if (
      uaPlatform &&
      platform !== uaPlatform &&
      !(uaPlatform === "Linux" && platform === "Chrome OS")
    ) {
      found.push({
        agent: null,
        confidence: "low",
        evidence: `ua_platform_mismatch:${uaPlatform}/${platform}`,
      });
    }
  }
  return found;
}

const DIRECTORY_PATH = "/.well-known/http-message-signatures-directory";
const DIRECTORY_TTL_MS = 60 * 60 * 1000;
const directoryCache = new Map();

function okpThumbprint(jwk) {
  const canon = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x });
  return createHash("sha256").update(canon).digest("base64url");
}

async function loadDirectory(origin, fetchImpl, now) {
  const hit = directoryCache.get(origin);
  if (hit && now - hit.at < DIRECTORY_TTL_MS) return hit.keys;
  const res = await fetchImpl(origin + DIRECTORY_PATH, {
    headers: { accept: "application/http-message-signatures-directory+json" },
    signal: AbortSignal.timeout?.(3000),
  });
  if (!res.ok) throw new Error(`directory ${res.status}`);
  const body = await res.json();
  const keys = new Map();
  for (const jwk of body?.keys ?? []) {
    if (jwk?.kty !== "OKP" || jwk?.crv !== "Ed25519" || !jwk.x) continue;
    keys.set(jwk.kid || okpThumbprint(jwk), jwk);
    keys.set(okpThumbprint(jwk), jwk);
  }
  directoryCache.set(origin, { at: now, keys });
  return keys;
}

function splitDict(value) {
  const out = new Map();
  let depth = 0;
  let quote = false;
  let start = 0;
  const push = (end) => {
    const part = value.slice(start, end).trim();
    const eq = part.indexOf("=");
    if (eq > 0) out.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  };
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"' && value[i - 1] !== "\\") quote = !quote;
    else if (!quote && c === "(") depth++;
    else if (!quote && c === ")") depth--;
    else if (!quote && depth === 0 && c === ",") {
      push(i);
      start = i + 1;
    }
  }
  push(value.length);
  return out;
}

function parseParams(str) {
  const params = {};
  for (const m of str.matchAll(/;([a-z]+)=("(?:[^"\\]|\\.)*"|-?\d+)/g)) {
    params[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : Number(m[2]);
  }
  return params;
}

function componentValue(name, req, url) {
  switch (name) {
    case "@method":
      return req.method.toUpperCase();
    case "@authority":
      return (header(req.headers, "host") || url.host).toLowerCase();
    case "@path":
      return url.pathname;
    case "@query":
      return url.search || "?";
    case "@target-uri":
      return url.href;
    case "@scheme":
      return url.protocol.replace(":", "");
    default: {
      if (name.startsWith("@")) return null;
      const v = header(req.headers, name);
      return v === null || v === undefined ? null : String(v).trim();
    }
  }
}

export async function verifyWebBotAuth(req, opts = {}) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const nowMs = opts.now ?? Date.now();
  const skew = opts.maxSkewSec ?? 60;
  try {
    const sa = parseSignatureAgent(header(req.headers, "signature-agent"));
    const input = header(req.headers, "signature-input");
    const sig = header(req.headers, "signature");
    if (!sa.length || !input || !sig)
      return { verified: false, reason: "unsigned" };
    const url = new URL(req.url);
    const inputs = splitDict(input);
    const sigs = splitDict(sig);

    for (const [label, def] of inputs) {
      const params = parseParams(def.slice(def.lastIndexOf(")") + 1));
      if (params.tag !== "web-bot-auth") continue;
      if (params.alg && params.alg !== "ed25519") continue;
      const nowSec = Math.floor(nowMs / 1000);
      if (typeof params.created === "number" && params.created > nowSec + skew)
        return { verified: false, reason: "created_in_future" };
      if (typeof params.expires === "number" && params.expires < nowSec - skew)
        return { verified: false, reason: "expired" };

      const listStr = def.slice(def.indexOf("(") + 1, def.lastIndexOf(")"));
      const comps = [
        ...listStr.matchAll(
          /"([^"]+)"((?:;[a-z]+(?:=(?:"[^"]*"|[^;\s"]+))?)*)/g,
        ),
      ];
      if (!comps.some(([, n, rawParams]) => n === "@authority" && !rawParams))
        return { verified: false, reason: "authority_not_signed" };
      if (
        opts.authority &&
        componentValue("@authority", req, url)?.toLowerCase() !==
          opts.authority.toLowerCase()
      )
        return { verified: false, reason: "wrong_authority" };
      const lines = [];
      for (const [, n, rawParams] of comps) {
        let v = componentValue(n, req, url);
        if (v === null)
          return { verified: false, reason: `missing_component:${n}` };
        const key = /;key="([^"]*)"/.exec(rawParams)?.[1];
        if (key !== undefined) {
          v = splitDict(v).get(key);
          if (v === undefined)
            return { verified: false, reason: `missing_member:${n}:${key}` };
        }
        lines.push(`"${n}"${rawParams}: ${v}`);
      }
      lines.push(`"@signature-params": ${def}`);
      const base = Buffer.from(lines.join("\n"), "utf8");

      const rawSig = sigs.get(label);
      const m = rawSig && /^:([A-Za-z0-9+/=_-]+):$/.exec(rawSig);
      if (!m) return { verified: false, reason: "malformed_signature" };
      const signature = Buffer.from(m[1], "base64");

      const agentUrl =
        sa.find((s) => s.label === label)?.url ??
        sa.find((s) => !s.label)?.url ??
        sa[0].url;
      const agent = new URL(agentUrl);
      if (agent.protocol !== "https:" || agent.port)
        return {
          verified: false,
          reason: "untrusted_signature_agent",
          origin: agent.origin,
        };
      const origin = agent.origin;
      const host = agent.host.toLowerCase();
      if (
        !signatureAgentFor(host) &&
        !(opts.trustedOrigins ?? []).includes(origin)
      ) {
        return { verified: false, reason: "untrusted_signature_agent", origin };
      }
      const keys = await loadDirectory(origin, fetchImpl, nowMs);
      const jwk = keys.get(params.keyid);
      if (!jwk) return { verified: false, reason: "unknown_key", origin };
      const key = createPublicKey({
        key: { kty: "OKP", crv: "Ed25519", x: jwk.x },
        format: "jwk",
      });
      if (cryptoVerify(null, base, key, signature)) {
        if (typeof opts.nonceCheck === "function") {
          if (!params.nonce)
            return { verified: false, reason: "missing_nonce", origin };
          const ttlMs = Math.max(
            1000,
            ((params.expires ?? nowMs / 1000 + 300) - nowMs / 1000 + skew) *
              1000,
          );
          if (
            (await opts.nonceCheck(`${origin} ${params.nonce}`, ttlMs)) !== true
          ) {
            return { verified: false, reason: "replayed_signature", origin };
          }
        }
        return {
          verified: true,
          agent: signatureAgentFor(host) ?? `signed:${host}`,
          origin,
          keyid: params.keyid,
        };
      }
      return { verified: false, reason: "bad_signature", origin };
    }
    return { verified: false, reason: "no_web_bot_auth_signature" };
  } catch (err) {
    return { verified: false, reason: `error:${err?.message ?? err}` };
  }
}

export function clearAgentDirectoryCache() {
  directoryCache.clear();
}

export function agentFromTrace(t) {
  const found = [];

  const a = t.a;
  if (a && a.k === 0 && a.pt === 0 && a.u >= 0) {
    const before = t.m.filter((p) => p[4] === 0 && p[0] <= a.t);
    const last = before[before.length - 1];
    const recent = before.filter((p) => p[0] > a.t - 1000);
    const atPress = last && Math.hypot(last[1] - a.x, last[2] - a.y) < 1;
    const warp = atPress && recent.length <= 2;
    const gap = last ? a.t - last[0] : null;
    const dwell = a.u - a.t;
    const exactCenter = Math.abs(a.cx) < 0.01 && Math.abs(a.cy) < 0.01;
    const intCoords = Number.isInteger(a.x) && Number.isInteger(a.y);
    const fine = t.res <= 2;

    if (warp && fine) {
      if (gap < 6 && dwell < 4) {
        found.push({
          agent: "cdp-automation",
          confidence: "medium",
          evidence: "click:cdp_default",
        });
      } else if (
        exactCenter &&
        gap >= 35 &&
        gap <= 90 &&
        dwell >= 65 &&
        dwell <= 130
      ) {
        found.push({
          agent: "browser-use",
          confidence: "medium",
          evidence: "click:browser_use",
        });
      } else if (
        intCoords &&
        dwell >= 9 &&
        dwell <= 30 &&
        gap >= 80 &&
        gap <= 900
      ) {
        found.push({
          agent: "claude-in-chrome",
          confidence: "medium",
          evidence: "click:claude_in_chrome",
        });
      } else if (
        intCoords &&
        Math.abs(a.cx) <= 1 &&
        Math.abs(a.cy) <= 1 &&
        gap >= 4 &&
        gap <= 15 &&
        dwell >= 4 &&
        dwell <= 15
      ) {
        found.push({
          agent: "gemini-in-chrome",
          confidence: "medium",
          evidence: "click:chrome_actor",
        });
      } else if (exactCenter && a.w >= 16 && a.h >= 16) {
        found.push({
          agent: null,
          confidence: "medium",
          evidence: "click:exact_center_warp",
        });
      }
    }
  }

  if (
    a &&
    a.k === 0 &&
    a.pt === 0 &&
    a.pr === 0 &&
    a.u >= 0 &&
    a.u - a.t < 1 &&
    Math.abs(a.cx) <= 0.5 &&
    Math.abs(a.cy) <= 0.5 &&
    !t.m.some((p) => p[4] === 0 && p[0] <= a.t && p[0] > a.t - 1000)
  ) {
    found.push({
      agent: null,
      confidence: "low",
      evidence: "click:ax_simulated",
    });
  }

  if (t.res <= 2 && t.k.length >= 7) {
    const iv = [];
    const held = t.k.map((k) => k[1]).filter((d) => d >= 0);
    for (let i = 1; i < t.k.length; i++) {
      const d = t.k[i][0] - t.k[i - 1][0];
      if (d >= 0 && d < 2000) iv.push(d);
    }
    const mid = (xs) => [...xs].sort((x, y) => x - y)[xs.length >> 1];
    const spread = (xs) => {
      const s = [...xs].sort((x, y) => x - y);
      return s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)];
    };
    if (
      iv.length >= 6 &&
      held.length >= 6 &&
      mid(held) >= 20 &&
      mid(held) <= 32 &&
      mid(iv) >= 42 &&
      mid(iv) <= 62 &&
      spread(iv) <= 8 &&
      spread(held) <= 6
    ) {
      found.push({
        agent: "gemini-in-chrome",
        confidence: "medium",
        evidence: "typing:chrome_actor",
      });
    }
  }

  if ((t.n[10] ?? 0) >= 2) {
    found.push({
      agent: null,
      confidence: "low",
      evidence: "typing:phantom_shift",
    });
  }

  if (t.res <= 2 && t.k.length >= 7) {
    const iv = [];
    for (let i = 1; i < t.k.length; i++) {
      const d = t.k[i][0] - t.k[i - 1][0];
      if (d >= 0 && d < 2000) iv.push(d);
    }
    iv.sort((x, y) => x - y);
    if (iv.length >= 6 && iv[iv.length >> 1] < 25) {
      found.push({
        agent: null,
        confidence: "medium",
        evidence: "typing:superhuman",
      });
    }
  }

  if ((t.n[8] ?? 0) > 0) {
    found.push({
      agent: null,
      confidence: "low",
      evidence: "typing:keyless_insert",
    });
  }
  if ((t.n[9] ?? 0) > 0) {
    found.push({ agent: null, confidence: "low", evidence: "input:untrusted" });
  }
  return found;
}

export function summarizeAgent(found, verification) {
  if (verification?.verified) {
    found = [
      {
        agent: verification.agent,
        confidence: "high",
        evidence: `web_bot_auth:${verification.origin}`,
      },
      ...found.filter((f) => !f.evidence.startsWith("signature_agent:")),
    ];
  }
  if (!found.length) return null;
  let best = 0;
  for (const f of found) best = Math.max(best, RANK[f.confidence]);
  const named = [...found]
    .filter((f) => f.agent)
    .sort((x, y) => RANK[y.confidence] - RANK[x.confidence])[0];
  const confidence = Object.keys(RANK).find((k) => RANK[k] === best);
  return {
    detected: !!named && RANK[named.confidence] >= RANK.medium,
    name: named?.agent ?? null,
    confidence,
    verified: verification?.verified === true,
    evidence: found.map((f) => f.evidence),
  };
}
