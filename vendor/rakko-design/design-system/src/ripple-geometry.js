/**
 * 计算覆盖整个目标表面的最小圆形水波纹。
 * point 使用 viewport 坐标；省略时从目标中心扩散。
 */
export function getRippleGeometry(rect, point) {
  const localX = point ? point.x - rect.left : rect.width / 2
  const localY = point ? point.y - rect.top : rect.height / 2
  const x = Math.min(Math.max(localX, 0), rect.width)
  const y = Math.min(Math.max(localY, 0), rect.height)
  const radius = Math.hypot(
    Math.max(x, rect.width - x),
    Math.max(y, rect.height - y),
  )

  return { x, y, size: radius * 2 }
}
