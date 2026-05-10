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

export interface GenerateChallengeOptions {
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
}

export interface ChallengeResult {
  challenge: ChallengeSpec;
  token: string;
  expires: number;
  instrumentation?: string;
}

export interface InstrumentationPayload {
  i: string;
  state: Record<string, number>;
  ts?: number;
}

export interface ValidateChallengeBody {
  token: string;
  solutions: number[];
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
