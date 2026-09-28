import { getRippleGeometry } from './ripple-geometry.js'

const RIPPLE_SELECTOR = '[data-ripple]'
const RIPPLE_CLASS = 'ripple-ink'
const CLEANUP_DELAY = 700

function isDisabled(target) {
  return (
    target.matches?.(':disabled') ||
    target.getAttribute?.('aria-disabled') === 'true'
  )
}

function findSurface(source, root) {
  const surface = source?.closest?.(RIPPLE_SELECTOR)
  if (!surface || isDisabled(surface)) return null
  if (typeof root.contains === 'function' && !root.contains(surface)) return null

  return surface
}

function removeExistingInk(target) {
  for (const child of Array.from(target.children ?? [])) {
    if (child.classList?.contains(RIPPLE_CLASS)) child.remove()
  }
}

/**
 * 在目标元素上创建一次水波纹，返回可重复调用的清理函数。
 */
export function createRipple(target, point) {
  if (!target || isDisabled(target)) return null

  removeExistingInk(target)
  const rect = target.getBoundingClientRect()
  const centered = target.hasAttribute('data-ripple-centered')
  const geometry = getRippleGeometry(rect, centered ? undefined : point)
  const ink = target.ownerDocument.createElement('span')
  ink.className = RIPPLE_CLASS
  ink.setAttribute('aria-hidden', 'true')
  ink.style.setProperty('--ripple-x', `${geometry.x}px`)
  ink.style.setProperty('--ripple-y', `${geometry.y}px`)
  ink.style.setProperty('--ripple-size', `${geometry.size}px`)
  target.append(ink)

  let timeoutId
  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    ink.remove()
  }

  ink.addEventListener('animationend', cleanup, { once: true })
  timeoutId = setTimeout(cleanup, CLEANUP_DELAY)
  return cleanup
}

/**
 * 给 root 内所有 data-ripple 元素安装事件委托，返回卸载函数。
 */
export function installRippleFeedback(root = globalThis.document) {
  if (!root?.addEventListener) return () => {}

  const onPointerDown = (event) => {
    if (event.isPrimary === false || event.button > 0) return
    const surface = findSurface(event.target, root)
    if (!surface) return
    createRipple(surface, { x: event.clientX, y: event.clientY })
  }

  const onKeyDown = (event) => {
    if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
    const surface = findSurface(event.target, root)
    if (!surface) return
    createRipple(surface)
  }

  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('keydown', onKeyDown)

  return () => {
    root.removeEventListener('pointerdown', onPointerDown)
    root.removeEventListener('keydown', onKeyDown)
  }
}
