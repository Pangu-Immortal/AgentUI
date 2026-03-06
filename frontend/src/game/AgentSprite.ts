/**
 * Agent 精灵类 - AgentSprite.ts
 *
 * 使用 PixiJS Graphics 纯代码绘制高质量角色，无需外部图片素材：
 * - 身体：彩色圆角胶囊体（roundRect），宽 32px，高 52px，4px 白色边框
 * - 头部：圆形，半径 14px，位于胶囊体上方
 * - 眼睛：两个白色小圆 + 黑色瞳孔
 * - 脚部：两个小椭圆，行走时左右交替摆动（sin 函数驱动）
 * - 每个 Agent 用不同颜色的胶囊体
 * - 保留名字标签和状态气泡 emoji
 * - 保留呼吸动画（idle 状态上下浮动）
 * - 新增行走动画：脚部左右交替移动
 * - 保留选中高亮、点击交互
 *
 * 函数列表：
 *   constructor() - 创建 Agent 精灵，绘制身体各部位
 *   moveTo() - 设置平滑移动目标位置
 *   updateState() - 更新状态和气泡图标
 *   update() - 每帧更新（移动、呼吸、行走动画）
 *   onTap() - 注册点击回调
 *   setSelected() - 设置选中高亮
 *   getId() - 获取 Agent ID
 *   destroy() - 销毁并释放资源
 */
import { Container, Graphics, Text } from 'pixi.js'

/** 状态对应的图标 emoji 映射 */
const STATE_ICONS: Record<string, string> = {
  idle: '\u{1F4A4}',          // 💤
  writing: '\u{1F4BB}',      // 💻
  researching: '\u{1F50D}',  // 🔍
  executing: '\u26A1',       // ⚡
  syncing: '\u{1F504}',      // 🔄
  error: '\u274C',           // ❌
}

/** 解析颜色字符串为 PixiJS 数值 */
function parseColor(color: string): number {
  if (color.startsWith('#')) return parseInt(color.slice(1), 16) // 十六进制颜色
  if (color.startsWith('0x')) return parseInt(color, 16)         // 0x 前缀颜色
  const nameMap: Record<string, number> = {
    red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71,
    yellow: 0xf1c40f, orange: 0xe67e22, pink: 0xe91e63,
    purple: 0x9b59b6, cyan: 0x00bcd4, gray: 0x95a5a6, white: 0xecf0f1,
  }
  return nameMap[color] ?? 0x3498db                              // 默认蓝色
}

/** 将数字颜色变亮指定比例 */
function lightenColor(c: number, amount: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + Math.round(255 * amount)) // 红通道
  const g = Math.min(255, ((c >> 8) & 0xff) + Math.round(255 * amount))  // 绿通道
  const b = Math.min(255, (c & 0xff) + Math.round(255 * amount))          // 蓝通道
  return (r << 16) | (g << 8) | b                                          // 合成颜色
}

/** 将数字颜色变暗指定比例 */
function darkenColor(c: number, amount: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) - Math.round(255 * amount)) // 红通道
  const g = Math.max(0, ((c >> 8) & 0xff) - Math.round(255 * amount))  // 绿通道
  const b = Math.max(0, (c & 0xff) - Math.round(255 * amount))          // 蓝通道
  return (r << 16) | (g << 8) | b                                        // 合成颜色
}

// 角色尺寸常量
const BODY_W = 32              // 胶囊体宽度
const BODY_H = 52              // 胶囊体高度
const BODY_RADIUS = 10         // 胶囊体圆角
const BORDER_W = 4             // 白色边框宽度
const HEAD_R = 14              // 头部圆形半径
const EYE_R = 4                // 眼白半径
const PUPIL_R = 2              // 瞳孔半径
const FOOT_W = 10              // 脚部宽度
const FOOT_H = 6               // 脚部高度

// 动画常量
const MOVE_SPEED = 0.05        // 移动插值速度
const BREATH_AMPLITUDE = 1.5   // 呼吸浮动幅度（像素）
const BREATH_SPEED = 0.03      // 呼吸速度
const WALK_SPEED = 0.12        // 行走脚步摆动速度
const WALK_AMPLITUDE = 4       // 行走脚步摆动幅度（像素）

export class AgentSprite {
  container: Container                       // 根容器

  private id: string                         // Agent 唯一标识
  private nameLabel: Text                    // 名字标签
  private statusBubble: Text                 // 状态气泡
  private highlight: Graphics                // 选中高亮边框
  private _selected = false                  // 是否被选中

  private targetX: number                    // 移动目标 X
  private targetY: number                    // 移动目标 Y
  private currentState = 'idle'              // 当前状态
  private breathTime = 0                     // 呼吸动画计时器
  private walkTime = 0                       // 行走动画计时器
  private isWalking = false                  // 是否正在行走
  private bodyContainer: Container           // 身体容器（呼吸动画作用于此）
  private leftFoot: Graphics                 // 左脚图形
  private rightFoot: Graphics                // 右脚图形
  private agentColor: number                 // Agent 主色
  private footBaseY: number                  // 脚部基准 Y 坐标

  /**
   * 创建 Agent 精灵
   * @param id Agent 唯一标识
   * @param name 中文名称
   * @param color 角色颜色（用于胶囊体颜色）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param _deskIndex 工位序号（保留参数兼容性）
   */
  constructor(id: string, name: string, color: string, x: number, y: number, _deskIndex = 0) {
    this.id = id                                                          // 缓存 ID
    this.targetX = x                                                      // 初始目标位置
    this.targetY = y
    this.agentColor = parseColor(color)                                   // 解析主色

    // 创建根容器
    this.container = new Container()
    this.container.label = `agent-${id}`                                  // 设置调试标签
    this.container.position.set(x, y)                                     // 设置初始位置
    this.container.eventMode = 'static'                                   // 开启交互
    this.container.cursor = 'pointer'                                     // 鼠标手型

    // 身体容器（呼吸动画作用于此）
    this.bodyContainer = new Container()
    this.container.addChild(this.bodyContainer)

    // 选中高亮边框（默认隐藏）
    this.highlight = new Graphics()
    this.highlight.visible = false
    this.bodyContainer.addChild(this.highlight)

    // 计算各部件 Y 坐标（以脚底为锚点 y=0）
    // 脚底 y=0，脚部高度 FOOT_H，胶囊体底部在 -FOOT_H 处，胶囊体顶部在 -(FOOT_H+BODY_H)
    const bodyBottomY = -FOOT_H                                           // 胶囊体底部 Y
    const bodyTopYFinal = bodyBottomY - BODY_H                            // 胶囊体顶部 Y
    const headCenterY = bodyTopYFinal - 4 - HEAD_R                        // 头部中心 Y（胶囊体上方留 4px 间距）
    this.footBaseY = -FOOT_H / 2                                          // 脚部中心 Y

    // ── 绘制阴影（半透明椭圆） ──
    const shadow = new Graphics()
    shadow.ellipse(0, 2, BODY_W / 2 + 2, 4)                              // 脚底下方的椭圆阴影
    shadow.fill({ color: 0x000000, alpha: 0.25 })                         // 25% 不透明黑色
    this.bodyContainer.addChild(shadow)

    // ── 绘制脚部（两个小椭圆） ──
    this.leftFoot = new Graphics()
    this.drawFoot(this.leftFoot, -7, this.footBaseY)                      // 左脚
    this.bodyContainer.addChild(this.leftFoot)

    this.rightFoot = new Graphics()
    this.drawFoot(this.rightFoot, 7, this.footBaseY)                      // 右脚
    this.bodyContainer.addChild(this.rightFoot)

    // ── 绘制胶囊体身体 ──
    const body = new Graphics()
    // 白色边框（先画大一圈的白色底）
    body.roundRect(
      -BODY_W / 2 - BORDER_W / 2,                                        // 左边多出边框宽度一半
      bodyTopYFinal - BORDER_W / 2,                                       // 顶部多出边框宽度一半
      BODY_W + BORDER_W,                                                  // 宽度加边框
      BODY_H + BORDER_W,                                                  // 高度加边框
      BODY_RADIUS + 2                                                     // 圆角也要大一点
    )
    body.fill({ color: 0xffffff })                                        // 白色边框
    // 彩色胶囊体主体
    body.roundRect(-BODY_W / 2, bodyTopYFinal, BODY_W, BODY_H, BODY_RADIUS) // 主体矩形
    body.fill({ color: this.agentColor })                                 // 用 Agent 主色填充
    // 高光条（左侧亮条模拟立体感）
    body.roundRect(
      -BODY_W / 2 + 4,                                                   // 左侧偏内
      bodyTopYFinal + 4,                                                  // 顶部偏内
      6,                                                                  // 窄条
      BODY_H - 8,                                                        // 略短
      3                                                                   // 小圆角
    )
    body.fill({ color: lightenColor(this.agentColor, 0.2), alpha: 0.5 }) // 半透明亮色
    this.bodyContainer.addChild(body)

    // ── 绘制头部（圆形） ──
    const head = new Graphics()
    // 白色边框圆
    head.circle(0, headCenterY, HEAD_R + BORDER_W / 2)                    // 大一圈做边框
    head.fill({ color: 0xffffff })                                        // 白色
    // 彩色头部主体
    head.circle(0, headCenterY, HEAD_R)                                   // 头部圆
    head.fill({ color: lightenColor(this.agentColor, 0.1) })              // 略亮的主色
    this.bodyContainer.addChild(head)

    // ── 绘制眼睛 ──
    const eyes = new Graphics()
    const eyeY = headCenterY - 1                                          // 眼睛 Y（略偏上）
    const eyeSpacing = 7                                                  // 两眼间距
    // 左眼白
    eyes.circle(-eyeSpacing, eyeY, EYE_R)
    eyes.fill({ color: 0xffffff })
    // 右眼白
    eyes.circle(eyeSpacing, eyeY, EYE_R)
    eyes.fill({ color: 0xffffff })
    // 左瞳孔
    eyes.circle(-eyeSpacing + 1, eyeY + 1, PUPIL_R)
    eyes.fill({ color: 0x222222 })
    // 右瞳孔
    eyes.circle(eyeSpacing + 1, eyeY + 1, PUPIL_R)
    eyes.fill({ color: 0x222222 })
    // 眼睛高光（小白点）
    eyes.circle(-eyeSpacing - 0.5, eyeY - 1, 1)
    eyes.fill({ color: 0xffffff })
    eyes.circle(eyeSpacing - 0.5, eyeY - 1, 1)
    eyes.fill({ color: 0xffffff })
    this.bodyContainer.addChild(eyes)

    // ── 名字标签（头部上方） ──
    const labelY = headCenterY - HEAD_R - BORDER_W / 2 - 4               // 头顶上方 4px
    this.nameLabel = new Text({
      text: name,
      style: {
        fontSize: 11,
        fill: 0xeeeeee,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 2,
          distance: 1,
          alpha: 0.6,
        },
      },
    })
    this.nameLabel.anchor.set(0.5, 1)                                     // 底部中心锚点
    this.nameLabel.position.set(0, labelY)
    this.container.addChild(this.nameLabel)

    // ── 状态气泡 emoji（名字上方） ──
    this.statusBubble = new Text({
      text: STATE_ICONS['idle'] ?? '',
      style: { fontSize: 14, fill: 0xffffff },
    })
    this.statusBubble.anchor.set(0.5, 1)                                  // 底部中心锚点
    this.statusBubble.position.set(0, labelY - 14)                        // 名字上方 14px
    this.container.addChild(this.statusBubble)

    console.log(`[AgentSprite] 创建 ${name}(${id}) color=0x${this.agentColor.toString(16)} 位置=(${x},${y})`)
  }

  /**
   * 绘制单只脚（小椭圆）
   * @param gfx Graphics 对象
   * @param cx 中心 X
   * @param cy 中心 Y
   */
  private drawFoot(gfx: Graphics, cx: number, cy: number): void {
    gfx.ellipse(cx, cy, FOOT_W / 2, FOOT_H / 2)                         // 椭圆形脚
    gfx.fill({ color: darkenColor(this.agentColor, 0.15) })              // 比主色暗一点
  }

  /** 平滑移动到目标位置 */
  moveTo(x: number, y: number): void {
    this.targetX = x                                                      // 设置目标 X
    this.targetY = y                                                      // 设置目标 Y
  }

  /** 更新状态和气泡图标 */
  updateState(state: string, _detail?: string): void {
    this.currentState = state                                             // 更新当前状态
    const icon = STATE_ICONS[state] ?? STATE_ICONS['idle'] ?? ''          // 查找对应图标
    this.statusBubble.text = icon                                         // 更新气泡文本
  }

  /**
   * 每帧更新（移动、呼吸动画、行走动画）
   * @param delta 帧间隔系数
   */
  update(delta: number): void {
    // ── 平滑移动 ──
    const dx = this.targetX - this.container.x                            // 水平差值
    const dy = this.targetY - this.container.y                            // 垂直差值
    const dist = Math.sqrt(dx * dx + dy * dy)                            // 欧几里得距离

    if (dist > 1) {
      const speed = MOVE_SPEED * delta                                    // 帧速度系数
      this.container.x += dx * speed                                      // 插值移动 X
      this.container.y += dy * speed                                      // 插值移动 Y
      this.isWalking = true                                               // 标记正在行走
    } else {
      this.container.x = this.targetX                                     // 到达目标，精确对齐
      this.container.y = this.targetY
      this.isWalking = false                                              // 停止行走
    }

    // ── 行走动画（脚部交替摆动） ──
    if (this.isWalking) {
      this.walkTime += WALK_SPEED * delta                                 // 递增行走计时
      const offset = Math.sin(this.walkTime) * WALK_AMPLITUDE             // sin 驱动的摆动偏移
      this.leftFoot.x = -offset                                          // 左脚水平偏移（与右脚相反）
      this.rightFoot.x = offset                                          // 右脚水平偏移
      this.breathTime = 0                                                 // 行走时重置呼吸
      this.bodyContainer.y = 0                                            // 行走时不浮动
    } else {
      // 脚部归位
      this.leftFoot.x = 0
      this.rightFoot.x = 0

      // ── 呼吸动画（仅 idle 状态） ──
      if (this.currentState === 'idle') {
        this.breathTime += BREATH_SPEED * delta                           // 递增呼吸计时
        this.bodyContainer.y = Math.sin(this.breathTime) * BREATH_AMPLITUDE // 上下浮动
      } else {
        this.bodyContainer.y = 0                                          // 非 idle 不浮动
        this.breathTime = 0                                               // 重置呼吸计时
      }
    }
  }

  /** 注册点击回调 */
  onTap(callback: (id: string) => void): void {
    this.container.on('pointerdown', () => callback(this.id))             // 绑定 pointerdown 事件
  }

  /** 设置选中状态 */
  setSelected(selected: boolean): void {
    this._selected = selected                                             // 更新选中标记
    this.highlight.visible = selected                                     // 显示/隐藏高亮
    if (selected) this.drawHighlight()                                    // 选中时绘制高亮
  }

  /** 绘制选中高亮边框 */
  private drawHighlight(): void {
    this.highlight.clear()                                                // 清除旧绘制
    const totalH = FOOT_H + BODY_H + 4 + HEAD_R * 2 + BORDER_W           // 角色总高度
    this.highlight.roundRect(
      -BODY_W / 2 - 6,                                                   // 左边多出 6px
      -(totalH + 2),                                                      // 顶部多出 2px
      BODY_W + 12,                                                        // 宽度加 12px
      totalH + 8,                                                         // 高度加 8px
      6                                                                   // 圆角
    )
    this.highlight.stroke({ color: 0xffff00, width: 2, alpha: 0.8 })     // 黄色高亮边框
  }

  /** 获取 Agent ID */
  getId(): string { return this.id }

  /** 销毁并释放所有资源 */
  destroy(): void {
    this.container.removeAllListeners()                                   // 移除所有事件监听
    this.container.destroy({ children: true })                            // 销毁容器及子对象
  }
}
