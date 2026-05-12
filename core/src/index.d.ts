export interface ChallengeSpec {
  c: number;
  s: number;
  d: number;
}

export interface InstrumentationOptions {
  blockAutomatedBrowsers?: boolean;
  obfuscationLevel?: number;
  ttlMs?: number;
}

export interface GeneratedInstrumentation {
  id: string;
  expires: number;
  expectedVals: number[];
  vars: string[];
  blockAutomatedBrowsers: boolean;
  instrumentation: string;
}

export type ProtocolName = "sha256-pow" | "rsw" | "instrumentation";

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

export interface GenerateChallengeOptions {
  // ── format-1 (default) ──
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

  // ── format-2 opt-in ──
  format?: 2;
  protocols?: ProtocolName[];
  /** RSW keypair, either as raw BigInts (from `generateRswKeypair`) or as a
   *  serialized JSON-friendly form (from `serializeRswKeypair`). cap-core
   *  builds the minter on first call and memoizes it on this object. */
  keypair?: RswKeypair | SerializedRswKeypair;
  /** Number of sequential squarings the client must perform. Default 75_000. */
  t?: number;
  /** Alternative to `keypair`: pass a pre-built minter (advanced). */
  rsw?: RswMinter;
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
}

export interface Format2ChallengeResult {
  token: string;
  format: 2;
  challenges: Format2ChallengeEntry[];
  expires: number;
}

export type ChallengeResult = Format1ChallengeResult | Format2ChallengeResult;

export interface InstrumentationPayload {
  i: string;
  state: Record<string, number>;
  ts?: number;
}

export interface Format2SolutionShaPow { nonce: number | string }
export interface Format2SolutionRsw { y: string }
export interface Format2SolutionInstrumentation {
  instr?: InstrumentationPayload;
  blocked?: boolean;
  timeout?: boolean;
}
export type Format2Solution =
  | Format2SolutionShaPow
  | Format2SolutionRsw
  | Format2SolutionInstrumentation;

export interface ValidateChallengeBody {
  token: string;
  /** Format-1: an array of nonces. Format-2: an array of protocol-specific
   *  solution objects, in the same order as `challenges`. */
  solutions: number[] | Format2Solution[];
  instr?: InstrumentationPayload;
  instr_blocked?: boolean;
  instr_timeout?: boolean;
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
}

export interface ValidateChallengeSuccess {
  success: true;
  token: string;
  tokenKey?: string;
  expires: number;
  scope: string | null;
  iat?: number;
}

export interface ValidateChallengeFailure {
  success: false;
  reason: string;
  instr_error?: boolean;
  error?: string;
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

// ─── RSW (format-2) helpers ────────────────────────────────────────────────
/** Generates a fresh 2048-bit-by-default RSA-style modulus + factors. Expensive
 *  (~700 ms to several seconds depending on prime-roll luck). Generate once
 *  at boot and persist the result. */
export function generateRswKeypair(bits?: number): RswKeypair;

/** JSON-friendly form, safe to write to disk or env. */
export function serializeRswKeypair(kp: RswKeypair): SerializedRswKeypair;
export function deserializeRswKeypair(s: SerializedRswKeypair): RswKeypair;

/** Build a minter for a specific squaring count `t`. Memoized when used via
 *  `generateChallenge({ keypair, t })`; this direct API is for callers who
 *  want full control. */
export function buildRswMinter(
  args: { N: bigint; p: bigint; q: bigint; t: number; g?: bigint },
  opts?: { bits?: number },
): RswMinter;
