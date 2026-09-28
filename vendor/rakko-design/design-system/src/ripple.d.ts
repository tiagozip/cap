export type RipplePoint = {
  x: number
  y: number
}

export declare function createRipple(
  target: HTMLElement,
  point?: RipplePoint,
): (() => void) | null

export declare function installRippleFeedback(
  root?: Document | HTMLElement,
): () => void
