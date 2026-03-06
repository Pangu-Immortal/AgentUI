/**
 * Agent 精灵类 - AgentSprite.ts
 *
 * 用纯代码绘制像素风格的小人，不依赖外部精灵图：
 * - 小人组成：头部（正方形）+ 身体（矩形）+ 双腿（两个小矩形）
 * - 头上方显示中文名字
 * - 状态气泡显示当前工作状态图标
 * - 支持呼吸动画（idle 状态下小幅上下浮动）
 * - moveTo(): 平滑移动到目标位置（帧插值）
 * - updateState(): 更新状态和气泡图标
 * - update(): 每帧调用，处理移动和动画
 *
 * 小人尺寸：宽 24px，高 36px
 */
import { Container, Graphics, Text } from 'pixi.js'

/** 状态对应的图标 emoji 映射 */
const STATE_ICONS: Record<string, string> = {
  idle: '\u{1F4A4}',          // idle = 💤
  writing: '\u{1F4BB}',      // writing = 💻
  researching: '\u{1F50D}',  // researching = 🔍
  executing: '\u26A1',       // executing = ⚡
  syncing: '\u{1F504}',      // syncing = 🔄
  error: '\u274C',           // error = ❌
}

/**
 * 解析颜色字符串为 PixiJS 数值
 * 支持格式：#e74c3c / 0xe74c3c / red 等
 */
function parseColor(color: string): number {
  if (color.startsWith('#')) return parseInt(color.slice(1), 16) // #hex 格式
  if (color.startsWith('0x')) return parseInt(color, 16)          // 0x 前缀
  // 颜色名称兜底映射
  const nameMap: Record<string, number> = {
    red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71,
    yellow: 0xf1c40f, orange: 0xe67e22, pink: 0xe91e63,
    purple: 0x9b59b6, cyan: 0x00bcd4, gray: 0x95a5a6, white: 0xecf0f1,
  }
  return nameMap[color] ?? 0x3498db                               // 默认蓝色
}

/** 移动插值速度（越大越快，0~1 范围） */
const MOVE_SPEED = 0.05

/** 呼吸动画参数 */
const BREATH_AMPLITUDE = 2   // 呼吸浮动幅度（像素）
const BREATH_SPEED = 0.03    // 呼吸速度

export class AgentSprite {
  container: Container             // 精灵根容器

  private id: string               // Agent 唯一标识
  private nameLabel: Text          // 名字标签
  private body: Graphics           // 身体图形
  private statusBubble: Text       // 状态气泡
  private bodyColor: number        // 身体颜色值
  private highlight: Graphics      // 选中高亮描边
  private _selected = false        // 是否被选中

  private targetX: number          // 移动目标 X
  private targetY: number          // 移动目标 Y
  private currentState = 'idle'    // 当前状态

  private breathTime = 0           // 呼吸动画时间累加器
  private bodyContainer: Container // 身体部分容器（用于呼吸动画）

  /**
   * 创建 Agent 精灵
   * @param id Agent 唯一标识
   * @param name Agent 中文名称
   * @param color 颜色名称字符串（如 'red', 'blue'）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   */
  constructor(id: string, name: string, color: string, x: number, y: number) {
    this.id = id                                          // 保存 ID
    this.targetX = x                                      // 初始化目标 X
    this.targetY = y                                      // 初始化目标 Y
    this.bodyColor = parseColor(color)                      // 解析颜色字符串为数值

    // 创建根容器
    this.container = new Container()
    this.container.label = `agent-${id}`                   // 容器标签
    this.container.position.set(x, y)                      // 设置初始位置

    // 启用交互事件（点击）
    this.container.eventMode = 'static'                    // 开启交互
    this.container.cursor = 'pointer'                      // 鼠标指针样式

    // 创建身体部分容器（呼吸动画作用于此容器）
    this.bodyContainer = new Container()
    this.container.addChild(this.bodyContainer)

    // 选中高亮描边（默认不可见）
    this.highlight = new Graphics()
    this.highlight.visible = false                         // 初始隐藏
    this.bodyContainer.addChild(this.highlight)

    // 绘制像素小人身体
    this.body = new Graphics()
    this.drawPixelBody()                                   // 绘制身体
    this.bodyContainer.addChild(this.body)

    // 名字标签（在小人上方 20px）
    this.nameLabel = new Text({
      text: name,
      style: {
        fontSize: 11,                                      // 名字字号
        fill: 0xdddddd,                                   // 浅灰白色
        fontFamily: 'sans-serif',                          // 无衬线字体
        fontWeight: 'bold',                                // 加粗
      },
    })
    this.nameLabel.anchor.set(0.5, 1)                      // 底部居中锚点
    this.nameLabel.position.set(0, -40)                    // 小人上方 40px（头顶上方）
    this.container.addChild(this.nameLabel)

    // 状态气泡（在名字上方）
    this.statusBubble = new Text({
      text: STATE_ICONS['idle'],                           // 默认 idle 图标
      style: {
        fontSize: 14,                                      // 气泡字号
        fill: 0xffffff,                                    // 白色
      },
    })
    this.statusBubble.anchor.set(0.5, 1)                   // 底部居中锚点
    this.statusBubble.position.set(0, -54)                 // 名字上方
    this.container.addChild(this.statusBubble)

    console.log(`[AgentSprite] 创建 ${name}(${id}) 位置=(${x},${y}) 颜色=${color}`)
  }

  /** 绘制像素风格小人身体 */
  private drawPixelBody(): void {
    this.body.clear()                                      // 清除旧图形

    // --- 头部：12x12 正方形，居中 ---
    const headSize = 12                                    // 头部尺寸
    const headX = -headSize / 2                            // 头部左上角 X（居中）
    const headY = -36 + 4                                  // 头部顶部 Y（小人总高 36px，顶部偏移 4px）
    this.body.rect(headX, headY, headSize, headSize)       // 头部矩形
    this.body.fill({ color: 0xffdbac })                    // 肤色填充

    // --- 身体：16x14 矩形，居中 ---
    const bodyW = 16                                       // 身体宽度
    const bodyH = 14                                       // 身体高度
    const bodyX = -bodyW / 2                               // 身体左上角 X
    const bodyY = headY + headSize + 1                     // 身体紧接头部下方
    this.body.rect(bodyX, bodyY, bodyW, bodyH)             // 身体矩形
    this.body.fill({ color: this.bodyColor })              // 用角色颜色填充

    // --- 双腿：每条腿 6x8，中间间隔 4px ---
    const legW = 6                                         // 腿宽度
    const legH = 8                                         // 腿高度
    const legY = bodyY + bodyH + 1                         // 腿紧接身体下方
    const legGap = 4                                       // 两腿间距
    const leftLegX = -legGap / 2 - legW                    // 左腿 X
    const rightLegX = legGap / 2                           // 右腿 X

    this.body.rect(leftLegX, legY, legW, legH)             // 左腿矩形
    this.body.rect(rightLegX, legY, legW, legH)            // 右腿矩形
    this.body.fill({ color: 0x555555 })                    // 深灰色裤子
  }

  /**
   * 设置平滑移动目标位置
   * @param x 目标 X 坐标
   * @param y 目标 Y 坐标
   */
  moveTo(x: number, y: number): void {
    this.targetX = x                                       // 更新目标 X
    this.targetY = y                                       // 更新目标 Y
  }

  /**
   * 更新 Agent 状态和气泡图标
   * @param state 新状态字符串
   * @param _detail 状态详情（预留，暂未使用）
   */
  updateState(state: string, _detail?: string): void {
    this.currentState = state                              // 更新当前状态
    const icon = STATE_ICONS[state] ?? STATE_ICONS['idle'] ?? '' // 获取对应图标
    this.statusBubble.text = icon                                // 更新气泡文字
  }

  /**
   * 每帧更新（由 ticker 调用）
   * @param delta 帧间隔系数（通常为 1）
   */
  update(delta: number): void {
    // --- 平滑移动插值 ---
    const dx = this.targetX - this.container.x             // X 方向差值
    const dy = this.targetY - this.container.y             // Y 方向差值
    const dist = Math.sqrt(dx * dx + dy * dy)              // 距离

    if (dist > 1) {
      // 使用线性插值平滑移动
      const speed = MOVE_SPEED * delta                     // 帧率无关速度
      this.container.x += dx * speed                       // X 方向插值
      this.container.y += dy * speed                       // Y 方向插值
    } else {
      // 距离足够近时直接到达
      this.container.x = this.targetX                      // 精确对齐 X
      this.container.y = this.targetY                      // 精确对齐 Y
    }

    // --- 呼吸动画（仅 idle 状态） ---
    if (this.currentState === 'idle') {
      this.breathTime += BREATH_SPEED * delta              // 累加呼吸时间
      const offsetY = Math.sin(this.breathTime) * BREATH_AMPLITUDE // 正弦波浮动
      this.bodyContainer.y = offsetY                       // 应用浮动偏移
    } else {
      this.bodyContainer.y = 0                             // 非 idle 状态无浮动
      this.breathTime = 0                                  // 重置呼吸计时
    }
  }

  /**
   * 注册点击回调
   * @param callback 点击时触发的回调函数，参数为 agentId
   */
  onTap(callback: (id: string) => void): void {
    this.container.on('pointerdown', () => {               // 监听指针按下事件
      callback(this.id)                                    // 触发回调
      console.log(`[AgentSprite] 点击了 ${this.id}`)
    })
  }

  /**
   * 设置选中/取消选中状态
   * @param selected 是否选中
   */
  setSelected(selected: boolean): void {
    this._selected = selected                              // 更新选中标记
    this.highlight.visible = selected                      // 控制高亮可见性
    if (selected) {
      this.drawHighlight()                                 // 选中时绘制高亮框
    }
  }

  /** 绘制选中高亮描边效果 */
  private drawHighlight(): void {
    this.highlight.clear()                                 // 清除旧高亮
    this.highlight.rect(-16, -38, 32, 50)                  // 包围小人的矩形区域
    this.highlight.stroke({ color: 0xffff00, width: 2, alpha: 0.8 }) // 黄色描边
  }

  /** 获取 Agent ID */
  getId(): string {
    return this.id
  }

  /** 销毁精灵，释放资源 */
  destroy(): void {
    this.container.removeAllListeners()                    // 移除所有事件监听
    this.container.destroy({ children: true })             // 递归销毁所有子对象
    console.log(`[AgentSprite] 已销毁 ${this.id}`)
  }
}
