export interface ChallengeSpec {
  c: number;
  s: number;
  d: number;
}

export interface InstrumentationOptions {
  blockAutomatedBrowsers?: boolean;
  detectAutomatedInteractions?: boolean;
  blockAutomatedInteractions?: boolean;
  obfuscationLevel?: number;
  ttlMs?: number;
  behavior?: boolean;
  noWasm?: boolean;
}

export interface InstrumentationBinding {
  pv: number[];
  sl: number[];
  hs: [number, number];
  j: [number, number];
}

export interface GeneratedInstrumentation {
  id: string;
  iat?: number;
  expires: number;
  vars: string[];
  binding?: InstrumentationBinding;
  expectedVals?: number[];
  blockAutomatedBrowsers: boolean;
  detectAutomatedInteractions?: boolean;
  blockAutomatedInteractions?: boolean;
  behavior?: boolean;
  noWasm?: boolean;
  instrumentation: string;
}

export type ProtocolName = "sha256-pow" | "rsw" | "hashwx" | "instrumentation";

export interface RswKeypair {
  N: bigint;
  p: bigint;
  q: bigint;
  bits?: number;
}

export interface SerializedRswKeypair {
  N: string;
  p: string;
  q: string;
  bits?: number | null;
}

export interface RswMinter {
  N: bigint;
  t: number;
  g: bigint;
  h: bigint;
  modulusBytes: number;
  N_hex: string;
  g_hex: string;
  h_hex: string;
  mint(): { x_hex: string; y_hex: string };
}

export interface BehaviorOptions {
  block?: boolean;
  threshold?: number;
  strict?: boolean;
  requireInteraction?: boolean;
  blockAgents?: false | "identified" | "all";
  allowVerifiedAgents?: boolean;
}

export interface AgentResult {
  detected: boolean;
  name: string | null;
  confidence: "low" | "medium" | "high";
  verified: boolean;
  evidence: string[];
}

export interface BehaviorTrace {
  v: 1;
  res: number;
  now: number;
  vis: number;
  last: number;
  env: number[];
  n: number[];
  m: [number, number, number, number, number][];
  k: [number, number][];
  a: Record<string, number> | null;
  us: number;
}

export interface BehaviorResult {
  score: number | null;
  verdict:
    | "ok"
    | "no_interaction"
    | "suspicious"
    | "agent"
    | "automated"
    | "missing";
  flags: string[];
  signals: Record<string, unknown>;
  agent?: AgentResult;
}

export function verifyWebBotAuth(
  req: {
    method: string;
    url: string;
    headers: Headers | Record<string, string>;
  },
  opts?: {
    fetch?: typeof fetch;
    now?: number;
    maxSkewSec?: number;
    trustedOrigins?: string[];
    nonceCheck?: (nonce: string, ttlMs: number) => boolean | Promise<boolean>;
  },
): Promise<{
  verified: boolean;
  agent?: string;
  origin?: string;
  keyid?: string;
  reason?: string;
}>;

export interface AgentEvidence {
  agent: string | null;
  confidence: "low" | "medium" | "high";
  evidence: string;
}

export function agentFromHeaders(
  headers: Headers | Record<string, string>,
): AgentEvidence[];

export function agentFromTrace(trace: BehaviorTrace): AgentEvidence[];

export function summarizeAgent(
  found: AgentEvidence[],
  verification?: {
    verified: boolean;
    agent?: string;
    origin?: string;
  } | null,
): AgentResult | null;

export function parseSignatureAgent(
  value: string | null | undefined,
): { label: string | null; url: string }[];

export const BEHAVIOR_WEIGHTS: Record<string, number>;
export const DEFAULT_BEHAVIOR_THRESHOLD: number;
export const WEAK_CAP: number;

export function analyzeBehavior(
  trace: unknown,
  ctx?: { replayed?: boolean; strict?: boolean; threshold?: number },
): BehaviorResult & { digest: string | null };

export interface GenerateChallengeOptions {
  behavior?: boolean | BehaviorOptions;
  challengeCount?: number;
  challengeSize?: number;
  challengeDifficulty?: number;
  expiresMs?: number;
  scope?: string;
  extra?: Record<string, unknown>;
  instrumentation?: boolean | InstrumentationOptions;
  instrumentationGenerator?: (
    opts: InstrumentationOptions,
  ) => Promise<GeneratedInstrumentation>;

  format?: 2;
  protocols?: ProtocolName[];
  keypair?: RswKeypair | SerializedRswKeypair;
  t?: number;
  rsw?: RswMinter;

  hashwxDifficulty?: number;
  hashwxNoncesPerHash?: number;
  hashwxChallengeCount?: number;
}

export interface Format2ChallengeEntry {
  protocol: ProtocolName;
  payload: Record<string, unknown>;
}

export interface Format1ChallengeResult {
  challenge: ChallengeSpec;
  token: string;
  expires: number;
  instrumentation?: string;
  behavior?: true;
}

export interface Format2ChallengeResult {
  token: string;
  format: 2;
  challenges: Format2ChallengeEntry[];
  expires: number;
  behavior?: true;
}

export type ChallengeResult = Format1ChallengeResult | Format2ChallengeResult;

export interface ProbeVector {
  ua?: string | null;
  productSub?: string | null;
  webdriver?: boolean | null;
  oscpu?: string | null;
  deviceMemory?: number | null;
  uaDataPresent?: boolean | null;
  uaData?: { mobile?: boolean; brands?: string[] } | null;
  plugins?: { length: number } | null;
  pdfViewerEnabled?: boolean | null;
  engine?: { hasMozInnerScreenX: boolean; hasChrome: boolean } | null;
  screen?: { width: number; height: number } | null;
  innerWH?: [number, number] | null;
  outerWH?: [number, number] | null;
  isExtended?: boolean | null;
  fontWidths?: number[] | null;
  tamper?: Record<string, boolean> | null;
}

export interface DetectionCheck {
  id: string;
  passed: boolean;
  detail: string;
  gating: boolean;
}

export interface DetectionResult {
  pass: boolean;
  checks: DetectionCheck[];
  blockedBy: string[];
  riskFlags: string[];
}

export interface BoundData {
  v: 1;
  el: number;
  p: ProbeVector | null;
  vp: [number, number] | null;
  hp: Record<string, unknown> | null;
  ag: string[];
  ia: [number, number] | null;
  bh: BehaviorTrace | null;
}

export interface InstrumentationPayload {
  i: string;
  state: Record<string, number>;
  d: string;
}

export interface InstrumentationVerdict {
  valid: boolean;
  reason?: string;
  riskFlags?: string[];
  blockedBy?: string[];
  checks?: DetectionCheck[];
  agent?: {
    all: string[];
    host: boolean;
    legacy: boolean;
    isolated: boolean;
    browser: string | null;
  };
  trace?: BehaviorTrace | null;
}

export const MAX_BOUND_DATA: number;

export function generateInstrumentation(
  opts?: InstrumentationOptions,
): Promise<GeneratedInstrumentation & { binding: InstrumentationBinding }>;

export function canonicalize<T>(value: T): T;

export function serializeBound(data: BoundData): string;

export function boundValues(
  binding: InstrumentationBinding,
  serialized: string,
): number[];

export function verifyInstrumentationResult(
  meta: GeneratedInstrumentation,
  payload: InstrumentationPayload,
  now?: number,
): InstrumentationVerdict;

export interface Format2SolutionShaPow {
  nonce: number | string;
}
export interface Format2SolutionRsw {
  y: string;
}
export interface Format2SolutionHashwx {
  nonce: number | string;
}
export interface Format2SolutionInstrumentation {
  instr?: InstrumentationPayload;
  blocked?: boolean;
  timeout?: boolean;
  error?: string;
}
export type Format2Solution =
  | Format2SolutionShaPow
  | Format2SolutionRsw
  | Format2SolutionHashwx
  | Format2SolutionInstrumentation;

export interface ValidateChallengeBody {
  token: string;
  solutions: number[] | Format2Solution[];
  instr?: InstrumentationPayload;
  instr_blocked?: boolean;
  instr_timeout?: boolean;
  instr_error?: string;
}

export interface ValidateChallengeOptions {
  scope?: string;
  tokenTtlMs?: number;
  consumeNonce?: (
    signatureHex: string,
    ttlMs: number,
  ) => Promise<boolean> | boolean;
  signToken?: (data: {
    scope: string | null;
    expires: number;
    iat?: number;
  }) => Promise<string> | string;
  request?: {
    method: string;
    url: string;
    headers: Headers | Record<string, string>;
  };
  verifyWebBotAuth?: boolean;
  webBotAuthAuthority?: string;
  fetch?: typeof fetch;
  trustedSignatureAgents?: string[];
  webBotAuthNonceCheck?: (
    nonce: string,
    ttlMs: number,
  ) => Promise<boolean> | boolean;
  behaviorReplayCheck?: (
    digest: string,
    ttlMs: number,
  ) => Promise<boolean> | boolean;
}

export interface ValidateChallengeSuccess {
  success: true;
  token: string;
  tokenKey?: string;
  expires: number;
  scope: string | null;
  iat?: number;
  riskFlags: string[];
  behavior?: BehaviorResult;
  agent?: AgentResult;
}

export interface ValidateChallengeFailure {
  success: false;
  reason: string;
  instr_error?: boolean;
  blockedBy?: string[];
  error?: string;
  behavior?: BehaviorResult;
}

export type ValidateChallengeResult =
  | ValidateChallengeSuccess
  | ValidateChallengeFailure;

export function generateChallenge(
  secret: string | Buffer,
  opts?: GenerateChallengeOptions,
): Promise<ChallengeResult>;

export function validateChallenge(
  secret: string | Buffer,
  body: ValidateChallengeBody,
  opts?: ValidateChallengeOptions,
): Promise<ValidateChallengeResult>;

export function generateRswKeypair(bits?: number): RswKeypair;

export function serializeRswKeypair(kp: RswKeypair): SerializedRswKeypair;
export function deserializeRswKeypair(s: SerializedRswKeypair): RswKeypair;

export function buildRswMinter(
  args: { N: bigint; p: bigint; q: bigint; t: number; g?: bigint },
  opts?: { bits?: number },
): RswMinter;

export const DEFAULT_HASHWX_DIFFICULTY: number;
export const DEFAULT_HASHWX_NONCES_PER_HASH: number;
export const DEFAULT_HASHWX_CHALLENGE_COUNT: number;

export interface HashwxState {
  exports: WebAssembly.Exports;
  ctx: number;
  seedPtr: number;
}

export function setHashwxModule(module: WebAssembly.Module): void;

export function hashwxReady(): Promise<HashwxState>;

export function hashwxTarget(difficulty: number | bigint): bigint;

export function hashwxSeed(
  challenge: Uint8Array,
  block: number | bigint,
): Uint8Array;

export function hashwxHash(
  state: HashwxState,
  seed: Uint8Array,
  nonce: bigint,
): bigint;

export interface DetectAutomationOptions {
  fontStackCount?: number;
}

export function detectAutomation(
  vector: ProbeVector,
  opts?: DetectAutomationOptions,
): DetectionResult;
