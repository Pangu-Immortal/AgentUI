/**
 * Agent 精灵类 - AgentSprite.ts
 *
 * 使用 Kenney RPG Urban Pack (CC0) 的像素角色精灵图：
 * - 16x16 原始尺寸，渲染时放大 TILE_SCALE 倍
 * - 支持 tint 染色区分 9 个 Agent
 * - 头顶显示中文名字 + 状态气泡
 * - 支持呼吸动画、平滑移动、点击交互
 *
 * 素材来源：https://kenney.nl/assets/rpg-urban-pack (CC0)
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { getTile } from './AssetLoader'
import { AGENT_IDLE_TILES, TILE_SCALE } from './TileConfig'

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
  if (color.startsWith('#')) return parseInt(color.slice(1), 16)
  if (color.startsWith('0x')) return parseInt(color, 16)
  const nameMap: Record<string, number> = {
    red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71,
    yellow: 0xf1c40f, orange: 0xe67e22, pink: 0xe91e63,
    purple: 0x9b59b6, cyan: 0x00bcd4, gray: 0x95a5a6, white: 0xecf0f1,
  }
  return nameMap[color] ?? 0x3498db
}

const MOVE_SPEED = 0.05        // 移动插值速度
const BREATH_AMPLITUDE = 1.5   // 呼吸浮动幅度
const BREATH_SPEED = 0.03      // 呼吸速度

export class AgentSprite {
  container: Container

  private id: string
  private charSprite: Sprite       // Kenney 角色精灵
  private nameLabel: Text
  private statusBubble: Text
  private highlight: Graphics
  private _selected = false

  private targetX: number
  private targetY: number
  private currentState = 'idle'
  private breathTime = 0
  private bodyContainer: Container

  /**
   * 创建 Agent 精灵
   * @param id Agent 唯一标识
   * @param name 中文名称
   * @param color 角色颜色（用于 tint 染色）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param deskIndex 工位序号（用于选择角色精灵变体）
   */
  constructor(id: string, name: string, color: string, x: number, y: number, deskIndex = 0) {
    this.id = id
    this.targetX = x
    this.targetY = y

    this.container = new Container()
    this.container.label = `agent-${id}`
    this.container.position.set(x, y)
    this.container.eventMode = 'static'       // 开启交互
    this.container.cursor = 'pointer'

    // 身体容器（呼吸动画作用于此）
    this.bodyContainer = new Container()
    this.container.addChild(this.bodyContainer)

    // 选中高亮
    this.highlight = new Graphics()
    this.highlight.visible = false
    this.bodyContainer.addChild(this.highlight)

    // 角色精灵 — 从 Kenney tilemap 加载
    const tileIdx = AGENT_IDLE_TILES[deskIndex % AGENT_IDLE_TILES.length] ?? 23
    const texture = getTile('urban', tileIdx)
    this.charSprite = new Sprite(texture !== Texture.EMPTY ? texture : Texture.WHITE)
    this.charSprite.anchor.set(0.5, 1)        // 底部中心锚点（脚底）
    this.charSprite.scale.set(TILE_SCALE)     // 放大 3 倍（16→48px）

    // 对部分 Agent 应用 tint 染色以区分身份
    const agentColor = parseColor(color)
    // 仅对 desk_index >= 4 的 Agent 微调 tint（前 4 个用原色更自然）
    if (deskIndex >= 4) {
      this.charSprite.tint = this.blendColor(0xffffff, agentColor, 0.25) // 25% 混合
    }

    this.bodyContainer.addChild(this.charSprite)

    // 角色底部彩色标识条（区分 Agent 身份）
    const badge = new Graphics()
    badge.roundRect(-12, 2, 24, 4, 2)
    badge.fill({ color: agentColor, alpha: 0.8 })
    this.bodyContainer.addChild(badge)

    // 名字标签（精灵上方）
    const spriteH = 16 * TILE_SCALE            // 放大后高度
    this.nameLabel = new Text({
      text: name,
      style: { fontSize: 11, fill: 0xeeeeee, fontFamily: 'sans-serif', fontWeight: 'bold' },
    })
    this.nameLabel.anchor.set(0.5, 1)
    this.nameLabel.position.set(0, -(spriteH + 4))
    this.container.addChild(this.nameLabel)

    // 状态气泡（名字上方）
    this.statusBubble = new Text({
      text: STATE_ICONS['idle'] ?? '',
      style: { fontSize: 14, fill: 0xffffff },
    })
    this.statusBubble.anchor.set(0.5, 1)
    this.statusBubble.position.set(0, -(spriteH + 18))
    this.container.addChild(this.statusBubble)

    console.log(`[AgentSprite] 创建 ${name}(${id}) tile=${tileIdx} 位置=(${x},${y})`)
  }

  /** 混合两个颜色 */
  private blendColor(c1: number, c2: number, ratio: number): number {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio)
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio)
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio)
    return (r << 16) | (g << 8) | b
  }

  /** 平滑移动到目标位置 */
  moveTo(x: number, y: number): void {
    this.targetX = x
    this.targetY = y
  }

  /** 更新状态和气泡图标 */
  updateState(state: string, _detail?: string): void {
    this.currentState = state
    const icon = STATE_ICONS[state] ?? STATE_ICONS['idle'] ?? ''
    this.statusBubble.text = icon
  }

  /** 每帧更新 */
  update(delta: number): void {
    // 平滑移动
    const dx = this.targetX - this.container.x
    const dy = this.targetY - this.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 1) {
      const speed = MOVE_SPEED * delta
      this.container.x += dx * speed
      this.container.y += dy * speed
    } else {
      this.container.x = this.targetX
      this.container.y = this.targetY
    }

    // 呼吸动画（仅 idle 状态）
    if (this.currentState === 'idle') {
      this.breathTime += BREATH_SPEED * delta
      this.bodyContainer.y = Math.sin(this.breathTime) * BREATH_AMPLITUDE
    } else {
      this.bodyContainer.y = 0
      this.breathTime = 0
    }
  }

  /** 注册点击回调 */
  onTap(callback: (id: string) => void): void {
    this.container.on('pointerdown', () => callback(this.id))
  }

  /** 设置选中状态 */
  setSelected(selected: boolean): void {
    this._selected = selected
    this.highlight.visible = selected
    if (selected) this.drawHighlight()
  }

  /** 绘制选中高亮 */
  private drawHighlight(): void {
    this.highlight.clear()
    const s = 16 * TILE_SCALE                                 // 精灵显示尺寸
    this.highlight.roundRect(-s / 2 - 4, -(s + 4), s + 8, s + 12, 4)
    this.highlight.stroke({ color: 0xffff00, width: 2, alpha: 0.8 })
  }

  getId(): string { return this.id }

  destroy(): void {
    this.container.removeAllListeners()
    this.container.destroy({ children: true })
  }
}
