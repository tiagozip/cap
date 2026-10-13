/* 上下文操作手势（长按 / 右键）。
   一个入口覆盖两种输入设备：触摸长按与鼠标右键都归一成同一次 onOpen(surface, anchor)，
   消费方只写一遍业务逻辑，再按视口自行决定呈现（移动端升起 Sheet、桌面在锚点开 Menu）。
   设备判定不读事件形状：Pointer Events L3 里键盘触发的 contextmenu pointerType 是空串，
   Firefox/Safari 的 contextmenu 是 MouseEvent 根本没有 pointerType，按它分类必然出错。
   模块只信自己的追踪状态——只有被追踪的触摸才震动、才写去重记录，其余路径一律当鼠标走。
   用法见 references/context-action.md；材质与呈现不在本模块职责内。 */

const SURFACE_SELECTOR = '[data-context-action]'

/* 行内可交互元素保留自己的触摸行为，不被长按劫持。summary 是原生的展开/收起控件；
   [draggable='true'] 的元素自带拖拽，与 500ms 的按住判定直接冲突；
   可编辑区选 [contenteditable] 而不是 [contenteditable='true']，才能把空串值与
   plaintext-only 一并覆盖进来，显式 false 的子树则跳过。data-context-action-ignore
   是逃逸钩子，给那些语义上不可交互、但产品希望排除的区域用（例如整块封面图）。 */
const IGNORE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='link']",
  "[draggable='true']",
  '[data-context-action-ignore]',
].join(',')

/* 部分浏览器在长按结束时还会补派一个原生 contextmenu。我们已经开过一次，
   窗口内同一位置的那次必须吞掉，否则菜单会开两遍。 */
const NATIVE_DEDUP_MS = 800
const NATIVE_DEDUP_DISTANCE = 24

/* 长按抬手后浏览器仍会派发 click，必须在冒泡前拦掉，否则卡片弹出的同时列表项也被点击。
   这条只对 iOS Safari 成立：它的长按抬手就是一次普通 tap，照常派发 click；
   Chrome / Firefox Android 长按结束派的是 pointercancel，根本不派 click。
   用带过期的时间窗口而不是一次性标记：手指移出后 click 可能根本不来，
   一次性标记会残留到下一次真实点击上。 */
const CLICK_SUPPRESS_MS = 400

/* options 的三个默认值。与上面三个常量一起构成契约取值表，由 check.ts 与
   references/context-action.md 对账。 */
const DEFAULT_DELAY_MS = 500
const DEFAULT_MOVE_TOLERANCE_PX = 10
const DEFAULT_HAPTICS_MS = 50

const defaultEnvironment = {
  now: () => Date.now(),
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: (timer) => clearTimeout(timer),
  vibrate: (duration) => globalThis.navigator?.vibrate?.(duration),
}

/** 长按不参与的目标：行内可交互元素与显式标注忽略的区域。 */
export function isContextActionIgnoredTarget(target) {
  return Boolean(target?.closest?.(IGNORE_SELECTOR))
}

function findSurface(target, root) {
  const surface = target?.closest?.(SURFACE_SELECTOR)
  if (!surface) return null
  if (typeof root.contains === 'function' && !root.contains(surface)) return null

  return surface
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 给 root 内所有 data-context-action 元素安装长按与右键手势，返回卸载函数。
 * onOpen 收到触发的表面元素与锚点坐标；业务数据请挂在该元素的 data-* 上，
 * 或由调用方用 WeakMap 关联，本模块不持有业务状态。
 */
export function installContextAction(options) {
  const {
    onOpen,
    root = globalThis.document,
    delay = DEFAULT_DELAY_MS,
    moveTolerance = DEFAULT_MOVE_TOLERANCE_PX,
    haptics = DEFAULT_HAPTICS_MS,
    environment,
  } = options ?? {}

  if (typeof onOpen !== 'function') {
    throw new TypeError('installContextAction 需要 onOpen 回调')
  }
  if (!root?.addEventListener) return () => {}

  const env = { ...defaultEnvironment, ...environment }

  /* 触觉选项归一成单一毫秒数，调用点只判 hapticsMs > 0：
     0 与 false 都是显式关闭，不得调 vibrate(0)。 */
  const hapticsMs = haptics === true ? DEFAULT_HAPTICS_MS : haptics === false ? 0 : haptics

  /* root 是子元素时，手指移出 root 后 root 收不到 pointermove / pointerup，
     超容差取消与抬手终止都会失效，留下幽灵长按；手势的中间与结束事件挂到
     所属文档。root 是 Document 时 ownerDocument 为 null，?? root 落回自己。 */
  const gestureTarget = root.ownerDocument ?? root

  /* 当次按压的追踪状态；pointerKind 是按下时的 pointerType，供触觉反馈归类。
     pointerdown 之后任何位置再来一根手指都是两指手势，resetTracking 兜底清空。 */
  let timer
  let pointerId
  let pointerKind
  let origin
  let surface
  let opened = false

  /* 跨按压保留：recentOpen 用于原生 contextmenu 去重（只由计时器路径写入）；
     suppressClick 记录触发抑制的表面，避免误吞刚弹出的 Sheet 上的点击。 */
  let recentOpen = null
  let suppressClick = null

  const clearTimer = () => {
    if (timer === undefined) return
    env.clearTimer(timer)
    timer = undefined
  }

  const resetTracking = () => {
    clearTimer()
    pointerId = undefined
    pointerKind = undefined
    origin = undefined
    surface = undefined
    opened = false
  }

  const onPointerDown = (event) => {
    /* 鼠标有右键，不进长按；触控笔的 barrel button（button > 0）是修饰键，也不算按压。 */
    if (event.pointerType === 'mouse' || event.button > 0) return
    /* 追踪中再来一根手指 = 两指手势，不是长按：取消当前追踪，也不为新手指出头。 */
    if (pointerId !== undefined) {
      resetTracking()
      return
    }
    if (isContextActionIgnoredTarget(event.target)) return

    const found = findSurface(event.target, root)
    if (!found) return

    opened = false
    pointerId = event.pointerId
    pointerKind = event.pointerType
    origin = { x: event.clientX, y: event.clientY }
    surface = found

    timer = env.setTimer(() => {
      timer = undefined
      /* 计时器到点时 surface/origin 一定还在——超容差、抬手与两指都会先清掉计时器。 */
      if (!surface || !origin) return
      opened = true
      /* recentOpen 只在此处写：计时器路径与浏览器随后补派的原生 contextmenu
         可能指向同一次长按，只有这条路径需要去重记录。 */
      recentOpen = { anchor: origin, time: env.now() }
      onOpen(surface, origin)
      if (pointerKind === 'touch' && hapticsMs > 0) env.vibrate?.(hapticsMs)
    }, delay)
  }

  const onPointerMove = (event) => {
    if (pointerId === undefined || event.pointerId !== pointerId) return
    if (!origin) return
    /* 手势已经打开后不再因位移取消：位移只在打开前用来区分「长按 vs 滚动」，
       打开之后与它无关；而且 pointerup 还要靠追踪状态决定 click 抑制，
       提前 reset 会让 iOS 抬手时随之而来的 click 穿透到列表项。 */
    if (opened) return
    /* 超出容差说明用户在滚动列表，不是在长按。 */
    if (distance(origin, { x: event.clientX, y: event.clientY }) <= moveTolerance) return
    resetTracking()
  }

  const onPointerUp = (event) => {
    if (pointerId === undefined || event.pointerId !== pointerId) return
    if (opened && surface) suppressClick = { surface, until: env.now() + CLICK_SUPPRESS_MS }
    resetTracking()
  }

  const onPointerCancel = (event) => {
    if (pointerId === undefined || event.pointerId !== pointerId) return
    resetTracking()
  }

  const onContextMenu = (event) => {
    if (isContextActionIgnoredTarget(event.target)) return

    const found = findSurface(event.target, root)
    if (!found) return

    /* 无论哪条路径、是否被去重，原生菜单都不出现——呈现由消费方接管。 */
    event.preventDefault()

    const anchor = { x: event.clientX, y: event.clientY }

    /* 去重只看「刚刚是否由计时器路径开过」：浏览器补派的原生 contextmenu 可能
       不带 pointerType 甚至不是 PointerEvent，按事件形状分类会漏判。命中时只
       返回，不 clearTimer——迟到的去重事件绝不能杀掉另一次正在计时的长按。 */
    if (
      recentOpen &&
      env.now() - recentOpen.time <= NATIVE_DEDUP_MS &&
      distance(recentOpen.anchor, anchor) <= NATIVE_DEDUP_DISTANCE
    ) {
      return
    }

    clearTimer()

    /* 开过一次且手势仍在进行（浏览器长按早于我们的计时器）才算触摸路径，
       按键与 MouseEvent 形态都靠追踪状态归位，不读本次事件的 pointerType。 */
    const tracked = pointerId !== undefined && surface === found
    if (tracked) opened = true

    onOpen(found, anchor)
    if (tracked && pointerKind === 'touch' && hapticsMs > 0) {
      env.vibrate?.(hapticsMs)
    }
  }

  const onClickCapture = (event) => {
    if (!suppressClick || env.now() >= suppressClick.until) return
    /* 只拦触发手势的那一个表面：长按弹出的 Sheet 是另一个表面，用户点它的
       第一次点击不能被误吞。没命中不消费抑制，下一次真实点击仍会被拦。 */
    if (event.target?.closest?.(SURFACE_SELECTOR) !== suppressClick.surface) return
    suppressClick = null
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation?.()
  }

  root.addEventListener('pointerdown', onPointerDown)
  gestureTarget.addEventListener('pointermove', onPointerMove)
  gestureTarget.addEventListener('pointerup', onPointerUp)
  gestureTarget.addEventListener('pointercancel', onPointerCancel)
  root.addEventListener('contextmenu', onContextMenu)
  root.addEventListener('click', onClickCapture, true)

  return () => {
    resetTracking()
    root.removeEventListener('pointerdown', onPointerDown)
    gestureTarget.removeEventListener('pointermove', onPointerMove)
    gestureTarget.removeEventListener('pointerup', onPointerUp)
    gestureTarget.removeEventListener('pointercancel', onPointerCancel)
    root.removeEventListener('contextmenu', onContextMenu)
    root.removeEventListener('click', onClickCapture, true)
  }
}
