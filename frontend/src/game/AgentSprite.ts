/**
 * Agent 精灵类 - AgentSprite.ts
 *
 * 严格 1:1 翻译自 claude-office/components/game/AgentSprite.tsx（React → 命令式 PixiJS 8）
 * 原版规格：
 * - 身体：48x80px 彩色圆角胶囊体，内缩 stroke 宽度后 44x76，圆角 22px
 * - 4px 白色 stroke 边框
 * - 无数字编号（原版无）
 * - 墨镜：texture sprite y=-37, scale 0.036x0.04（暂用 Graphics 圆角矩形替代）
 * - 名字标签在胶囊体上方 y=-70, scale=0.5, monospace 24px 白色粗体 + 4px 黑色 stroke
 * - 气泡在右上方 x=45, yOffset=-93
 * - 手臂参数：startY=-16, endY=16, handColor=0x1f2937
 * - 打字动画：time += delta*0.15, offset = sin(time*8) * 2
 *
 * 函数列表：
 *   constructor()    - 创建 Agent 精灵，绘制胶囊体身体
 *   moveTo()         - 设置平滑移动目标位置
 *   updateState()    - 更新状态和图标徽章
 *   update()         - 每帧更新（移动、呼吸、打字动画）
 *   onTap()          - 注册点击回调
 *   setSelected()    - 设置选中高亮
 *   setTyping()      - 控制打字手臂动画
 *   showBubble()     - 显示思考/对话气泡
 *   hideBubble()     - 隐藏气泡
 *   getId()          - 获取 Agent ID
 *   destroy()        - 销毁并释放资源
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { drawRightArm, drawLeftArm, type ArmDrawParams } from './drawArm' // 手臂绘制工具
import { drawBubble, drawIconBadge } from './drawBubble'                   // 气泡绘制工具
import { getTexture } from './TextureLoader'                                // 纹理加载器

/** 状态对应的图标 emoji 映射（原版 iconMap.ts 扩展） */
const STATE_ICONS: Record<string, string> = {
  idle: '\u{1F4A4}',          // 💤
  writing: '\u{1F4BB}',      // 💻
  researching: '\u{1F50D}',  // 🔍
  executing: '\u26A1',       // ⚡
  syncing: '\u{1F504}',      // 🔄
  error: '\u274C',           // ❌
}

/** 解析颜色字符串为 PixiJS 数值（原版 parseInt(color.replace("#",""), 16)） */
function parseColor(color: string): number {
  if (color.startsWith('#')) return parseInt(color.slice(1), 16) // 十六进制颜色
  if (color.startsWith('0x')) return parseInt(color, 16)         // 0x 前缀颜色
  const nameMap: Record<string, number> = {
    red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71,
    yellow: 0xf1c40f, orange: 0xe67e22, pink: 0xe91e63,
    purple: 0x9b59b6, cyan: 0x00bcd4, gray: 0x95a5a6, white: 0xecf0f1,
  }
  return nameMap[color] ?? 0xff6b6b                              // 默认粉红（原版默认值）
}

// ── 胶囊体尺寸常量（原版 AgentSprite.tsx 精确值） ──
const AGENT_WIDTH = 48             // 胶囊体总宽度（原版 AGENT_WIDTH = 48）
const AGENT_HEIGHT = 80            // 胶囊体总高度（原版 AGENT_HEIGHT = 80）
const STROKE_WIDTH = 4             // 白色边框宽度（原版 STROKE_WIDTH = 4）
const INNER_W = AGENT_WIDTH - STROKE_WIDTH   // 内部宽度 44（原版 innerWidth）
const INNER_H = AGENT_HEIGHT - STROKE_WIDTH  // 内部高度 76（原版 innerHeight）
const AGENT_RADIUS = INNER_W / 2             // 圆角半径 22（原版 agentRadius = innerWidth/2）

// ── 手臂参数（原版 agentArmParams） ──
const ARM_BODY_HALF_W = INNER_W / 2          // 肩膀半宽 22（原版 (AGENT_WIDTH - STROKE_WIDTH) / 2）
const ARM_START_Y = -16                      // 肩膀 Y（原版 startY: -16）
const ARM_END_Y = 16                         // 键盘 Y（原版 endY: 16）
const HAND_COLOR = 0x1f2937                  // 手部颜色（原版 handColor: 0x1f2937，暗灰色）

// ── 打字动画常量（原版 useTick 中的值） ──
const TYPING_SPEED = 0.15                    // 打字计时增速（原版 ticker.deltaTime * 0.15）
const TYPING_SIN_FREQ = 8                    // sin 频率（原版 Math.sin(typingTime * 8)）
const TYPING_AMPLITUDE = 2                   // 振幅 2px（原版 * 2）
const TYPING_PHASE_OFFSET = Math.PI * 0.7    // 左手相位差（原版 + Math.PI * 0.7）

// ── 气泡参数（原版 Bubble 组件中的计算） ──
const BUBBLE_OFFSET_X = 45                   // 气泡 X 偏移（原版 x={45}）
const BUBBLE_OFFSET_Y = -93                  // 气泡 Y 偏移（原版 bubbleOffset = -93）
const BADGE_RADIUS = 16                      // 图标徽章半径（原版 badgeRadius = 16）

// ── 移动/呼吸动画 ──
const MOVE_SPEED = 0.05                      // 移动插值速度
const BREATH_AMPLITUDE = 2                   // 呼吸浮动幅度
const BREATH_SPEED = 0.03                    // 呼吸速度

// ── 墨镜 Graphics 参数（原版用 texture sprite，此处用 Graphics 替代绘制） ──
const SUNGLASSES_Y = -37                     // 墨镜 Y 位置（原版 y={-37}）
const SUNGLASSES_W = 30                      // 墨镜宽度
const SUNGLASSES_H = 8                       // 墨镜高度

export class AgentSprite {
  container: Container                       // 根容器（公共属性，供 OfficeScene 访问）
  labelContainer: Container                  // 名字标签容器（供 OfficeScene 提升到全局标签层）
  bubbleRoot: Container                      // 气泡根容器（供 OfficeScene 提升到全局气泡层）
  armContainer: Container                      // 手臂容器（供 OfficeScene 提升到全局手臂层）

  private id: string                         // Agent 唯一标识
  private agentColor: number                 // Agent 主色（数值）
  private nameLabel: Text                    // 名字标签
  private iconBadgeText: Text                // 图标徽章 emoji 文本
  private iconBadgeBg: Graphics              // 图标徽章背景圆
  private highlight: Graphics                // 选中高亮边框
  private _selected = false                  // 是否被选中

  private targetX: number                    // 移动目标 X
  private targetY: number                    // 移动目标 Y
  private currentState = 'idle'              // 当前状态
  private breathTime = 0                     // 呼吸动画计时器
  private typingTime = 0                     // 打字动画计时器
  private isTyping = false                   // 是否正在打字
  private isWalking = false                  // 是否正在行走

  private bodyContainer: Container           // 身体容器（呼吸动画作用于此）
  private rightArmGfx: Graphics              // 右手臂 Graphics
  private leftArmGfx: Graphics               // 左手臂 Graphics

  private headsetSprite: Sprite | null = null // 耳机精灵（工作时显示）

  private bubbleContainer: Container         // 气泡容器
  private bubbleGfx: Graphics                // 气泡背景 Graphics
  private bubbleText: Text                   // 气泡文字

  /**
   * 创建 Agent 精灵（严格翻译自原版 AgentSpriteComponent）
   * @param id Agent 唯一标识
   * @param name 名称
   * @param color 角色颜色（用于胶囊体填充）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param _deskIndex 工位序号（保留参数兼容性）
   */
  constructor(id: string, name: string, color: string, x: number, y: number, _deskIndex = 0) {
    this.id = id                                                          // 缓存 ID
    this.targetX = x                                                      // 初始目标位置
    this.targetY = y
    this.agentColor = parseColor(color)                                   // 解析主色

    // ── 创建根容器（原版 <pixiContainer x={position.x} y={position.y}>） ──
    this.container = new Container()
    this.container.label = `agent-${id}`                                  // 设置调试标签
    this.container.position.set(x, y)                                     // 设置初始位置
    this.container.eventMode = 'static'                                   // 开启交互
    this.container.cursor = 'pointer'                                     // 鼠标手型

    // ── 身体容器（呼吸动画作用于此） ──
    this.bodyContainer = new Container()
    this.container.addChild(this.bodyContainer)

    // ── 选中高亮边框（默认隐藏） ──
    this.highlight = new Graphics()
    this.highlight.visible = false
    this.bodyContainer.addChild(this.highlight)

    // ── 绘制胶囊体身体（原版 drawAgent 函数精确翻译） ──
    // 原版定位：roundRect(-innerWidth/2, -innerHeight + agentRadius, innerWidth, innerHeight, agentRadius)
    // 即：roundRect(-22, -54, 44, 76, 22)
    const body = new Graphics()
    body.roundRect(
      -INNER_W / 2,                                                       // x = -22
      -INNER_H + AGENT_RADIUS,                                            // y = -76 + 22 = -54（底部圆心在 y=0）
      INNER_W,                                                             // width = 44
      INNER_H,                                                             // height = 76
      AGENT_RADIUS,                                                        // radius = 22
    )
    body.fill(this.agentColor)                                             // 用 Agent 主色填充
    body.stroke({ width: STROKE_WIDTH, color: 0xffffff })                 // 4px 白色描边
    this.bodyContainer.addChild(body)

    // ── 墨镜（优先使用 texture sprite，回退为 Graphics 替代） ──
    // 原版：<pixiSprite texture={sunglassesTexture} anchor={0.5} x={0} y={-37} scale={{x:0.036, y:0.04}} />
    const sunglassesTexture = getTexture('sunglasses')                    // 尝试获取墨镜纹理
    if (sunglassesTexture) {
      const sgSprite = new Sprite(sunglassesTexture)                      // 创建墨镜 Sprite
      sgSprite.anchor.set(0.5, 0.5)                                      // 居中锚点
      sgSprite.position.set(0, SUNGLASSES_Y)                             // 原版 y={-37}
      sgSprite.scale.set(0.036, 0.04)                                    // 原版 scale={{x:0.036, y:0.04}}
      this.bodyContainer.addChild(sgSprite)
    } else {
      const sunglasses = new Graphics()                                   // Graphics 回退
      sunglasses.roundRect(-SUNGLASSES_W / 2, SUNGLASSES_Y - SUNGLASSES_H / 2, SUNGLASSES_W, SUNGLASSES_H, 3)
      sunglasses.fill({ color: 0x000000, alpha: 0.85 })                  // 黑色半透明镜片
      sunglasses.stroke({ width: 1, color: 0x333333 })                   // 暗色镜框
      sunglasses.rect(-2, SUNGLASSES_Y - 1, 4, 3)                        // 鼻梁连接条
      sunglasses.fill({ color: 0x333333 })
      this.bodyContainer.addChild(sunglasses)
    }

    // ── 名字标签（原版：y={-70}, scale={0.5}, monospace 24px 白色粗体 + 4px 黑色 stroke） ──
    // 原版完整代码：
    //   <pixiContainer y={-70} scale={0.5}>
    //     <pixiText text={name} anchor={0.5} style={{
    //       fontFamily: "monospace", fontSize: 24, fill: 0xffffff,
    //       fontWeight: "bold", stroke: { width: 4, color: 0x000000 }
    //     }} resolution={2} />
    //   </pixiContainer>
    this.labelContainer = new Container()                                  // 原版外层容器（全局层）
    this.labelContainer.position.set(x, y - 70)                          // 初始位置 = Agent位置 - 70
    this.labelContainer.scale.set(0.5)                                    // 原版 scale={0.5}
    this.nameLabel = new Text({
      text: name,
      style: {
        fontSize: 24,                                                     // 原版 fontSize: 24
        fill: 0xffffff,                                                   // 原版 fill: 0xffffff
        fontFamily: 'monospace',                                          // 原版 fontFamily: "monospace"
        fontWeight: 'bold',                                               // 原版 fontWeight: "bold"
        stroke: { width: 4, color: 0x000000 },                           // 原版 stroke: { width: 4, color: 0x000000 }
      },
    })
    this.nameLabel.anchor.set(0.5, 0.5)                                   // 原版 anchor={0.5}
    this.nameLabel.resolution = 2                                         // 原版 resolution={2}（锐利渲染）
    this.labelContainer.addChild(this.nameLabel)
    // 标签不添加到 this.container，由 OfficeScene 添加到全局标签层

    // ── 图标徽章（气泡左上角，原版 Bubble 组件内部） ──
    // 原版：badgeRadius = 16, 位于 bubble 左上角 x={-bWidth/2 - 6} y={-bHeight + 6}
    // 独立显示时放在胶囊体上方
    this.iconBadgeBg = new Graphics()
    drawIconBadge(this.iconBadgeBg, BADGE_RADIUS)                         // 绘制白色圆形徽章背景
    this.iconBadgeBg.position.set(0, -INNER_H + AGENT_RADIUS - 22)       // 胶囊体上方
    this.bodyContainer.addChild(this.iconBadgeBg)

    this.iconBadgeText = new Text({
      text: STATE_ICONS['idle'] ?? '',
      style: {
        fontSize: 20,                                                     // 原版 iconStyle fontSize: 40, 但 scale 0.5
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        fill: 0x000000,
      },
    })
    this.iconBadgeText.anchor.set(0.5, 0.5)                              // 居中锚点
    this.iconBadgeText.position.set(0, -INNER_H + AGENT_RADIUS - 22)     // 与徽章背景同位置
    this.bodyContainer.addChild(this.iconBadgeText)

    // ── 耳机（原版 AgentHeadset 组件，工作状态时显示） ──
    // 原版：<pixiSprite texture={headsetTexture} anchor={0.5} y={-38} scale={{x:0.66825, y:0.675}} />
    this.headsetSprite = null                                              // 默认无耳机
    const headsetTexture = getTexture('headset')                          // 尝试获取耳机纹理
    if (headsetTexture) {
      this.headsetSprite = new Sprite(headsetTexture)                     // 创建耳机 Sprite
      this.headsetSprite.anchor.set(0.5, 0.5)                            // 居中锚点
      this.headsetSprite.position.set(0, -38)                            // 原版 y={position.y - 38}
      this.headsetSprite.scale.set(0.66825, 0.675)                       // 原版 scale
      this.headsetSprite.visible = false                                  // 默认隐藏，工作时显示
      this.bodyContainer.addChild(this.headsetSprite)
    }

    // ── 手臂容器（独立于 body，供 OfficeScene 提升到全局手臂层） ──
    this.armContainer = new Container()
    this.armContainer.label = `arms-${id}`                               // 调试标签
    this.armContainer.visible = false                                     // 默认隐藏（打字时显示）
    this.armContainer.position.set(x, y)                                 // 初始位置跟随 Agent

    this.leftArmGfx = new Graphics()
    this.armContainer.addChild(this.leftArmGfx)                          // 添加到手臂容器

    this.rightArmGfx = new Graphics()
    this.armContainer.addChild(this.rightArmGfx)                         // 添加到手臂容器

    // ── 气泡容器（原版 Bubble 组件，默认隐藏） ──
    // 原版：<pixiContainer y={bubbleOffset} x={45}> bubbleOffset = -93
    this.bubbleContainer = new Container()
    this.bubbleContainer.visible = false                                   // 默认隐藏
    this.bubbleContainer.position.set(x + BUBBLE_OFFSET_X, y + BUBBLE_OFFSET_Y) // 全局层初始位置

    this.bubbleGfx = new Graphics()
    this.bubbleContainer.addChild(this.bubbleGfx)

    this.bubbleText = new Text({
      text: '',
      style: {
        fontSize: 20,                                                     // 原版 fontSize: 20（2x渲染）
        fill: 0x000000,                                                   // 原版 fill: "#000000"
        fontFamily: '"Courier New", Courier, monospace',                  // 原版 fontFamily
        fontWeight: 'bold',                                               // 原版 fontWeight: "bold"
        wordWrap: true,
        wordWrapWidth: 160,                                               // 原版 (bWidth - 30) * 2
      },
    })
    this.bubbleText.anchor.set(0, 0.5)                                    // 原版 anchor={{ x: 0, y: 0.5 }}
    this.bubbleText.scale.set(0.5)                                        // 原版 <pixiContainer scale={0.5}>
    this.bubbleContainer.addChild(this.bubbleText)

    // 气泡不添加到 this.container，由 OfficeScene 添加到全局气泡层
    this.bubbleRoot = this.bubbleContainer

    console.log(`[AgentSprite] 创建 ${name}(${id}) color=0x${this.agentColor.toString(16)} 位置=(${x},${y})`)
  }

  /** 平滑移动到目标位置 */
  moveTo(x: number, y: number): void {
    this.targetX = x                                                      // 设置目标 X
    this.targetY = y                                                      // 设置目标 Y
  }

  /** 更新状态和图标徽章 */
  updateState(state: string, detail?: string): void {
    this.currentState = state                                             // 更新当前状态
    const icon = STATE_ICONS[state] ?? STATE_ICONS['idle'] ?? ''          // 查找对应图标
    this.iconBadgeText.text = icon                                        // 更新徽章 emoji

    // 自动控制打字状态
    if (state === 'writing' || state === 'executing' || state === 'researching' || state === 'syncing') {
      this.setTyping(true)                                                // 工作状态开启打字
    } else {
      this.setTyping(false)                                               // 其他状态关闭打字
    }

    // 工作状态自动显示思考气泡
    if (detail && ['writing', 'researching', 'executing', 'syncing'].includes(state)) {
      this.showBubble(detail, 'thought')                                  // 显示任务详情气泡
    } else {
      this.hideBubble()                                                   // 非工作状态隐藏气泡
    }
  }

  /**
   * 控制打字手臂动画
   * @param typing 是否开启打字动画
   */
  setTyping(typing: boolean): void {
    this.isTyping = typing                                                // 更新打字标记
    this.armContainer.visible = typing                                    // 显示/隐藏手臂容器
    if (this.headsetSprite) {
      this.headsetSprite.visible = typing                                 // 工作时显示耳机
    }
    if (!typing) {
      this.typingTime = 0                                                 // 停止打字时重置计时器
    }
  }

  /**
   * 显示思考/对话气泡（翻译自原版 Bubble 组件）
   * @param text 气泡文字内容
   * @param type 气泡类型，默认 thought
   */
  showBubble(text: string, type: 'thought' | 'speech' = 'thought'): void {
    // 原版动态计算气泡尺寸
    const charWidth = 7.5                                                 // 原版 charWidth = 7.5
    const paddingH = 30                                                   // 原版 paddingH = 30
    const maxW = 220                                                      // 原版 maxW = 220
    const rawWidth = text.length * charWidth + paddingH                   // 原版计算
    const bWidth = Math.min(maxW, Math.max(80, rawWidth))                 // 原版 bWidth 计算
    const capacity = (bWidth - paddingH) / charWidth                      // 原版 capacity
    const lines = Math.max(1, Math.ceil(text.length / capacity))          // 原版行数计算
    const bHeight = 35 + lines * 14                                       // 原版 bHeight 计算

    drawBubble(this.bubbleGfx, bWidth, bHeight, type)                     // 绘制气泡背景
    // 原版文字位置：<pixiContainer x={-bWidth/2 + 15} y={-bHeight/2} scale={0.5}>
    this.bubbleText.position.set(-bWidth / 2 + 15, -bHeight / 2)         // 文字定位
    this.bubbleText.text = text                                           // 设置气泡文字
    this.bubbleContainer.visible = true                                   // 显示气泡容器
  }

  /** 隐藏气泡 */
  hideBubble(): void {
    this.bubbleContainer.visible = false                                   // 隐藏气泡容器
  }

  /**
   * 每帧更新（移动、呼吸动画、打字动画）
   * 打字动画严格翻译自原版 AgentArmsComponent 的 useTick
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

    // ── 打字手臂动画（原版 AgentArmsComponent） ──
    if (this.isTyping) {
      // 原版：setTypingTime(t => t + ticker.deltaTime * 0.15)
      this.typingTime += TYPING_SPEED * delta                             // 递增打字计时
      // 原版：rightArmOffset = Math.sin(typingTime * 8) * 2
      const rightOffset = Math.sin(this.typingTime * TYPING_SIN_FREQ) * TYPING_AMPLITUDE
      // 原版：leftArmOffset = Math.sin(typingTime * 8 + Math.PI * 0.7) * 2
      const leftOffset = Math.sin(this.typingTime * TYPING_SIN_FREQ + TYPING_PHASE_OFFSET) * TYPING_AMPLITUDE

      // 原版 agentArmParams
      const armParams: ArmDrawParams = {
        bodyHalfWidth: ARM_BODY_HALF_W,                                   // 原版 (AGENT_WIDTH - STROKE_WIDTH) / 2 = 22
        startY: ARM_START_Y,                                              // 原版 -16
        endY: ARM_END_Y,                                                  // 原版 16
        handColor: HAND_COLOR,                                            // 原版 0x1f2937
      }

      drawRightArm(this.rightArmGfx, { ...armParams, animOffset: rightOffset }) // 绘制右手臂
      drawLeftArm(this.leftArmGfx, { ...armParams, animOffset: leftOffset })    // 绘制左手臂
    }

    // ── 呼吸动画（AgentUI 扩展，原版无此功能） ──
    if (!this.isWalking) {
      if (this.currentState === 'idle' || !this.isTyping) {
        this.breathTime += BREATH_SPEED * delta                           // 递增呼吸计时
        this.bodyContainer.y = Math.sin(this.breathTime) * BREATH_AMPLITUDE // 上下浮动 2px
      } else {
        this.bodyContainer.y = 0                                          // 打字时不浮动
        this.breathTime = 0                                               // 重置呼吸计时
      }
    } else {
      this.bodyContainer.y = 0                                            // 行走时不浮动
      this.breathTime = 0                                                 // 行走时重置呼吸
    }

    // 同步标签和气泡位置（它们在全局层中，不跟随 container 自动移动）
    const gx = this.container.x                                           // Agent 全局 X
    const gy = this.container.y                                           // Agent 全局 Y
    this.labelContainer.position.set(gx, gy - 70)                        // 原版标签在 Agent 上方 70px
    this.bubbleRoot.position.set(gx + BUBBLE_OFFSET_X, gy + BUBBLE_OFFSET_Y) // 原版 x=45, y=-93
    this.armContainer.position.set(gx, gy + this.bodyContainer.y)        // 手臂跟随 Agent（含呼吸偏移）
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

  /** 绘制选中高亮边框（匹配原版胶囊体尺寸） */
  private drawHighlight(): void {
    this.highlight.clear()                                                // 清除旧绘制
    const pad = 6                                                         // 高亮扩展边距
    this.highlight.roundRect(
      -INNER_W / 2 - pad,                                                 // 匹配原版胶囊体位置
      -INNER_H + AGENT_RADIUS - pad,                                      // 匹配原版 y 偏移
      INNER_W + pad * 2,                                                   // 宽度加 2*pad
      INNER_H + pad * 2,                                                   // 高度加 2*pad
      AGENT_RADIUS + 4                                                     // 圆角也加大
    )
    this.highlight.stroke({ color: 0xffff00, width: 2, alpha: 0.8 })     // 黄色高亮边框
  }

  /** 获取 Agent ID */
  getId(): string { return this.id }

  /** 销毁并释放所有资源 */
  destroy(): void {
    this.container.removeAllListeners()                                   // 移除所有事件监听
    this.container.destroy({ children: true })                            // 销毁容器及子对象
    this.labelContainer.destroy({ children: true })                       // 销毁标签容器
    this.bubbleRoot.destroy({ children: true })                           // 销毁气泡容器
    this.armContainer.destroy({ children: true })                        // 销毁手臂容器
  }
}
