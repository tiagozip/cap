declare global {
  interface Window {
    CAP_CUSTOM_FETCH?: typeof fetch;
    CAP_CUSTOM_WASM_URL?: string;
    CAP_CSS_NONCE?: string;
    CAP_DONT_SKIP_REDEFINE?: boolean;
    Cap: typeof Cap;
  }
}

interface CapProgressEventDetail {
  progress: number;
}

interface CapSolveEventDetail {
  token: string;
}

interface CapErrorEventDetail {
  isCap: boolean;
  message: string;
}

interface CapProgressEvent extends CustomEvent {
  detail: CapProgressEventDetail;
}

interface CapSolveEvent extends CustomEvent {
  detail: CapSolveEventDetail;
}

interface CapErrorEvent extends CustomEvent {
  detail: CapErrorEventDetail;
}

interface CapResetEvent extends CustomEvent {
  detail: Record<string, never>;
}

interface SolveResult {
  success: boolean;
  token: string;
}

interface CapConfig {
  apiEndpoint?: string;
  "data-cap-api-endpoint"?: string;
  "data-cap-worker-count"?: string;
  "data-cap-hidden-field-name"?: string;
  "data-cap-i18n-initial-state"?: string;
  "data-cap-i18n-verifying-label"?: string;
  "data-cap-i18n-solved-label"?: string;
  "data-cap-i18n-error-label"?: string;
  "data-cap-i18n-verify-aria-label"?: string;
  "data-cap-i18n-verifying-aria-label"?: string;
  "data-cap-i18n-verified-aria-label"?: string;
  "data-cap-i18n-error-aria-label"?: string;
  "data-cap-i18n-wasm-disabled"?: string;
  onsolve?: string;
  onprogress?: string;
  onreset?: string;
  onerror?: string;
}

interface CapWidget extends HTMLElement {
  readonly token: string | null;
  readonly tokenValue: string | null;

  solve(): Promise<SolveResult>;
  reset(): void;
  setWorkersCount(workers: number): void;

  addEventListener(
    type: "progress",
    listener: (event: CapProgressEvent) => void
  ): void;
  addEventListener(
    type: "solve",
    listener: (event: CapSolveEvent) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: CapErrorEvent) => void
  ): void;
  addEventListener(
    type: "reset",
    listener: (event: CapResetEvent) => void
  ): void;
  addEventListener(type: string, listener: EventListener): void;

  removeEventListener(
    type: "progress",
    listener: (event: CapProgressEvent) => void
  ): void;
  removeEventListener(
    type: "solve",
    listener: (event: CapSolveEvent) => void
  ): void;
  removeEventListener(
    type: "error",
    listener: (event: CapErrorEvent) => void
  ): void;
  removeEventListener(
    type: "reset",
    listener: (event: CapResetEvent) => void
  ): void;
  removeEventListener(type: string, listener: EventListener): void;
}

declare class Cap {
  readonly widget: CapWidget;
  readonly token: string | null;

  constructor(config?: CapConfig, el?: CapWidget);

  solve(): Promise<SolveResult>;
  reset(): void;

  addEventListener(
    type: "progress",
    listener: (event: CapProgressEvent) => void
  ): void;
  addEventListener(
    type: "solve",
    listener: (event: CapSolveEvent) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: CapErrorEvent) => void
  ): void;
  addEventListener(
    type: "reset",
    listener: (event: CapResetEvent) => void
  ): void;
  addEventListener(type: string, listener: EventListener): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "cap-widget": CapWidget;
  }
}

export {
  Cap,
  type CapWidget,
  type CapConfig,
  type CapProgressEvent,
  type CapSolveEvent,
  type CapErrorEvent,
  type CapResetEvent,
  type SolveResult,
};

export default Cap;
