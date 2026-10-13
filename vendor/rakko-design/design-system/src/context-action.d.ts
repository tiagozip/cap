export type ContextActionAnchor = {
  x: number
  y: number
}

export type ContextActionEnvironment = {
  now?: () => number
  setTimer?: (callback: () => void, delay: number) => unknown
  clearTimer?: (timer: unknown) => void
  vibrate?: (duration: number) => void
}

export type ContextActionOptions = {
  /** 长按或右键命中 data-context-action 元素时调用；呈现由调用方决定。 */
  onOpen: (surface: HTMLElement, anchor: ContextActionAnchor) => void
  /** 事件委托的根节点，默认 document。 */
  root?: Document | HTMLElement
  /** 长按判定时长，默认 500ms。 */
  delay?: number
  /** 按压期间允许的位移，超出即判定为滚动并取消，默认 10px。 */
  moveTolerance?: number
  /** 触摸路径打开时的触觉反馈时长，默认 50ms；false 关闭。只在支持 Vibration API 的平台生效，Safari（含 iOS）静默无效。 */
  haptics?: number | boolean
  /** 注入计时器、时钟与震动，便于测试。 */
  environment?: ContextActionEnvironment
}

export declare function isContextActionIgnoredTarget(
  target: EventTarget | null,
): boolean

export declare function installContextAction(
  options: ContextActionOptions,
): () => void
