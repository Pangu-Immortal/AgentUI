/**
 * 手臂绘制工具 - drawArm.ts
 *
 * 从 claude-office 迁移的参数化手臂绘制函数。
 * 用贝塞尔曲线绘制从肩膀到键盘的手臂，支持打字动画偏移。
 *
 * 函数列表：
 *   drawRightArm() - 绘制右手臂
 *   drawLeftArm() - 绘制左手臂（镜像）
 */
import { Graphics } from 'pixi.js'

/** 手臂绘制参数 */
export interface ArmDrawParams {
  bodyHalfWidth: number   // 身体半宽（肩膀位置）
  startY: number          // 肩膀 Y 坐标
  endY: number            // 键盘/手部终点 Y 坐标
  handColor: number       // 手部填充颜色
  animOffset?: number     // 打字动画偏移量
}

const ARM_WIDTH = 4                                                          // 手臂线宽
const HAND_WIDTH = 10                                                        // 手掌宽度
const HAND_HEIGHT = 14                                                       // 手掌高度

/**
 * 绘制右手臂（从右肩到键盘的贝塞尔曲线）
 * @param g Graphics 实例
 * @param params 绘制参数
 */
export function drawRightArm(g: Graphics, params: ArmDrawParams): void {
  g.clear()                                                                  // 清除旧绘制

  const { bodyHalfWidth, startY, endY, handColor, animOffset = 0 } = params

  const startX = bodyHalfWidth                                               // 右肩 X 坐标
  const cp1X = startX + 20                                                   // 控制点1 X（向外弯曲）
  const cp1Y = startY + 10 + animOffset * 0.5                               // 控制点1 Y
  const cp2X = startX + 15                                                   // 控制点2 X（向内收回）
  const cp2Y = endY - 4 + animOffset * 0.7                                  // 控制点2 Y
  const endX = 12                                                            // 手部终点 X
  const finalEndY = endY + animOffset                                        // 手部终点 Y（含动画偏移）

  // 手臂曲线
  g.moveTo(startX, startY)                                                   // 起点：肩膀
  g.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, finalEndY)                // 贝塞尔曲线
  g.stroke({ width: ARM_WIDTH, color: 0xffffff, cap: 'round' })            // 白色手臂

  // 手掌（圆角矩形）
  const handRadius = HAND_WIDTH / 2                                          // 手掌圆角
  g.roundRect(endX - HAND_WIDTH / 2, finalEndY - HAND_HEIGHT / 2, HAND_WIDTH, HAND_HEIGHT, handRadius)
  g.fill(handColor)                                                          // 手掌填色
  g.stroke({ width: 2, color: 0xffffff })                                  // 白色手掌边框
}

/**
 * 绘制左手臂（右手臂的镜像）
 * @param g Graphics 实例
 * @param params 绘制参数
 */
export function drawLeftArm(g: Graphics, params: ArmDrawParams): void {
  g.clear()                                                                  // 清除旧绘制

  const { bodyHalfWidth, startY, endY, handColor, animOffset = 0 } = params

  const startX = -bodyHalfWidth                                              // 左肩 X 坐标（镜像）
  const cp1X = startX - 20                                                   // 控制点1 X（向外弯曲）
  const cp1Y = startY + 10 + animOffset * 0.5                               // 控制点1 Y
  const cp2X = startX - 15                                                   // 控制点2 X
  const cp2Y = endY - 4 + animOffset * 0.7                                  // 控制点2 Y
  const endX = -12                                                           // 手部终点 X（镜像）
  const finalEndY = endY + animOffset                                        // 手部终点 Y

  // 手臂曲线（镜像）
  g.moveTo(startX, startY)                                                   // 起点：左肩
  g.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, finalEndY)                // 贝塞尔曲线
  g.stroke({ width: ARM_WIDTH, color: 0xffffff, cap: 'round' })            // 白色手臂

  // 手掌
  const handRadius = HAND_WIDTH / 2                                          // 手掌圆角
  g.roundRect(endX - HAND_WIDTH / 2, finalEndY - HAND_HEIGHT / 2, HAND_WIDTH, HAND_HEIGHT, handRadius)
  g.fill(handColor)                                                          // 手掌填色
  g.stroke({ width: 2, color: 0xffffff })                                  // 白色手掌边框
}
