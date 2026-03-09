/**
 * 气泡绘制工具 - drawBubble.ts
 *
 * 从 claude-office 迁移的思考/对话气泡绘制函数。
 * 支持两种气泡类型：thought（思考泡泡）和 speech（对话尖角）。
 *
 * 函数列表：
 *   drawBubble() - 绘制气泡主体和尾部
 *   drawIconBadge() - 绘制圆形图标徽章背景
 */
import { Graphics } from 'pixi.js'

/**
 * 绘制思考或对话气泡
 * @param g Graphics 实例
 * @param width 气泡宽度
 * @param height 气泡高度
 * @param type 气泡类型：thought=圆点尾部，speech=三角尾部
 */
export function drawBubble(
  g: Graphics,
  width: number,
  height: number,
  type: 'thought' | 'speech' = 'thought',
): void {
  g.clear()                                                                  // 清除旧绘制

  const halfW = width / 2                                                    // 半宽
  const radius = type === 'thought' ? 20 : 12                               // 圆角半径
  const shadowOff = 2                                                        // 阴影偏移
  const shadowAlpha = 0.2                                                    // 阴影透明度

  // ── 阴影层 ──
  if (type === 'thought') {
    g.circle(-10 + shadowOff, 6 + shadowOff, 4)                             // 思考泡泡阴影点1
    g.fill({ color: 0x000000, alpha: shadowAlpha })
    g.circle(-20 + shadowOff, 14 + shadowOff, 2)                            // 思考泡泡阴影点2
    g.fill({ color: 0x000000, alpha: shadowAlpha })
  } else {
    g.moveTo(-15 + shadowOff, 0 + shadowOff)                                // 对话尖角阴影
    g.lineTo(-20 + shadowOff, 12 + shadowOff)
    g.lineTo(-5 + shadowOff, 0 + shadowOff)
    g.closePath()
    g.fill({ color: 0x000000, alpha: shadowAlpha })
  }
  g.roundRect(-halfW + shadowOff, -height + shadowOff, width, height, radius) // 主体阴影
  g.fill({ color: 0x000000, alpha: shadowAlpha })

  // ── 气泡主体 ──
  g.roundRect(-halfW, -height, width, height, radius)                       // 白色气泡主体
  g.fill(0xffffff)
  g.stroke({ width: 1.5, color: 0x000000 })                                // 黑色边框

  // ── 尾部 ──
  if (type === 'thought') {
    g.circle(-10, 6, 4)                                                      // 大思考泡泡点
    g.fill(0xffffff)
    g.stroke({ width: 1.5, color: 0x000000 })
    g.circle(-20, 14, 2)                                                     // 小思考泡泡点
    g.fill(0xffffff)
    g.stroke({ width: 1, color: 0x000000 })
  } else {
    g.moveTo(-15, -2)                                                        // 对话三角尾部填充
    g.lineTo(-20, 12)
    g.lineTo(-5, -2)
    g.closePath()
    g.fill(0xffffff)
    g.moveTo(-15, 0)                                                         // 对话尖角描边
    g.lineTo(-20, 12)
    g.lineTo(-5, 0)
    g.stroke({ width: 1.5, color: 0x000000 })
  }
}

/**
 * 绘制圆形图标徽章背景
 * @param g Graphics 实例
 * @param radius 徽章半径
 */
export function drawIconBadge(g: Graphics, radius: number): void {
  g.clear()                                                                  // 清除旧绘制
  g.circle(1, 1, radius)                                                     // 阴影圆
  g.fill({ color: 0x000000, alpha: 0.2 })
  g.circle(0, 0, radius)                                                     // 白色背景圆
  g.fill(0xffffff)
  g.stroke({ width: 1.5, color: 0x000000 })                                // 黑色边框
}
