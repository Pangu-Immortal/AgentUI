/**
 * 办公室主场景管理器 - OfficeScene.ts
 *
 * 迁移自 claude-office 的 Y-sorted 分层渲染场景架构。
 * 使用 PixiJS 8 管理多层渲染容器，实现正确的深度排序。
 *
 * 渲染层级（从下到上）：
 *   1. Background（墙壁+地板）      — OfficeMap 负责
 *   2. Boss 地毯 / 墙壁装饰 / 电梯  — OfficeMap 包含
 *   3. Y-sorted 层（椅子 + Agent）   — 按 Y 坐标每帧排序，保证深度正确
 *   4. 桌面底层（desk + keyboard）   — OfficeMap 包含
 *   5. Agent 手臂层                  — 在桌面上方
 *   6. 桌面顶层（monitor + 配件）    — 在手臂上方
 *   7. 名字标签层
 *   8. 气泡层
 *
 * 函数列表：
 *   constructor()        - 创建 PixiJS Application 实例
 *   init()               - 初始化场景（纹理加载、分层容器、地图、寻路、ticker）
 *   updateAgents()       - 批量更新 Agent 状态和位置
 *   setOnAgentClick()    - 注册 Agent 点击回调
 *   selectAgent()        - 设置选中的 Agent（高亮）
 *   resize()             - 处理窗口尺寸变化
 *   destroy()            - 销毁场景释放所有资源
 *   getPositionForState()- 根据状态计算 Agent 目标位置（claude-office 工位布局）
 *   setAgentPath()       - 为 Agent 设置 A* 寻路路径
 *   updateAgentPath()    - 每帧更新 Agent 沿路径移动
 *   sortYSortedLayer()   - 每帧按 Y 坐标排序深度
 *   hashString()         - 字符串哈希工具函数
 */
import { Application, Container } from 'pixi.js'
import { Camera } from './Camera'
import { OfficeMap } from './OfficeMap'
import { AgentSprite } from './AgentSprite'
import { PathSystem } from './PathSystem'
import { loadAllTextures } from './TextureLoader'
import type { Waypoint } from './PathSystem'
import type { AgentRuntime, OfficeConfig } from '../types'

/** Agent 路径移动速度（像素/帧） */
const PATH_MOVE_SPEED = 1.5

/** 工位布局常量 — claude-office 风格 */
const DESK_ORIGIN_X = 256                                                  // 第一排工位起始 X
const DESK_ORIGIN_Y = 408                                                  // 第一排工位起始 Y
const DESK_SPACING_X = 256                                                 // 工位水平间距
const DESK_SPACING_Y = 192                                                 // 工位垂直间距
const DESKS_PER_ROW = 4                                                    // 每排工位数量

/** idle 散步区域 — 工位之间和饮水机附近均匀分布 */
const IDLE_AREA_X = 300                                                    // idle 区域起始 X
const IDLE_AREA_Y = 290                                                    // idle 区域起始 Y（墙壁下方）
const IDLE_SPREAD_X = 700                                                  // idle 区域水平扩散范围
const IDLE_SPREAD_Y = 80                                                   // idle 区域垂直扩散范围

/** error 位置 — 打印机附近（左下角） */
const ERROR_AREA_X = 100                                                   // error 区域 X
const ERROR_AREA_Y = 850                                                   // error 区域 Y
const ERROR_SPREAD = 80                                                    // error 区域扩散范围

/** Agent 寻路状态 */
interface AgentPathState {
  waypoints: Waypoint[]                                                    // 当前路径点列表
  currentIdx: number                                                       // 当前目标路径点索引
  isFollowing: boolean                                                     // 是否正在沿路径移动
}

export class OfficeScene {
  app: Application                                                         // PixiJS 应用实例

  private camera: Camera | null = null                                     // 摄像机控制器
  private officeMap: OfficeMap | null = null                                // 地图渲染器
  private agents: Map<string, AgentSprite> = new Map()                     // Agent 精灵映射表
  private config: OfficeConfig | null = null                                // 办公室配置缓存
  private onAgentClick: ((id: string) => void) | null = null               // Agent 点击回调
  private selectedAgentId: string | null = null                             // 当前选中的 Agent ID
  private pathSystem: PathSystem | null = null                              // A* 寻路系统
  private agentPaths: Map<string, AgentPathState> = new Map()              // Agent 路径状态

  // ── 分层容器（claude-office Y-sorted 渲染架构） ──
  private layerYSorted: Container | null = null                             // Y-sorted 层（椅子 + Agent 身体）
  private layerArmOverDesk: Container | null = null                         // Agent 手臂层（桌面上方）
  private layerNameTags: Container | null = null                            // 名字标签层
  private layerBubbles: Container | null = null                             // 气泡层
  private layerDeskBase: Container | null = null                            // 桌面底层（desk + keyboard）
  private layerDeskTop: Container | null = null                             // 桌面顶层（monitor + accessories）

  constructor() {
    this.app = new Application()                                           // 创建 PixiJS 应用（尚未初始化）
  }

  /**
   * 初始化场景
   * 1. 初始化 PixiJS Application
   * 2. 加载所有纹理资源
   * 3. 创建分层容器结构
   * 4. 绘制地图
   * 5. 初始化寻路系统
   * 6. 启动 ticker 渲染循环
   * @param container 挂载容器 DOM 元素
   * @param config 办公室配置数据
   */
  async init(container: HTMLElement, config?: OfficeConfig): Promise<void> {
    if (config) this.config = config                                       // 缓存配置

    const width = container.clientWidth || 800                             // 获取容器宽度
    const height = container.clientHeight || 600                           // 获取容器高度

    // 初始化 PixiJS 8 Application
    await this.app.init({
      width,
      height,
      background: 0x1a1a1a,                                                // 深灰黑背景（匹配原版 BACKGROUND_COLOR）
      antialias: false,                                                    // 关闭抗锯齿（像素风格）
      roundPixels: true,                                                   // 像素对齐
      resolution: window.devicePixelRatio || 1,                            // 适配高清屏
      autoDensity: true,                                                   // 自动适配密度
    })

    // 将 PixiJS 创建的 canvas 追加到容器中
    container.appendChild(this.app.canvas)
    console.log(`[OfficeScene] PixiJS 应用初始化完成 ${width}x${height}`)

    // ── 加载所有纹理资源（必须在绘制地图前完成） ──
    console.log('[OfficeScene] 开始加载纹理资源...')
    const texturesLoaded = await loadAllTextures()                         // 批量加载精灵纹理
    if (texturesLoaded) {
      console.log('[OfficeScene] 纹理加载成功')
    } else {
      console.warn('[OfficeScene] 部分纹理加载失败，将使用 Graphics 回退绘制')
    }

    if (!this.config) return                                               // 无配置则仅初始化画布

    // ── 创建摄像机 ──
    this.camera = new Camera(width, height, this.config.map_width, this.config.map_height)
    this.app.stage.addChild(this.camera.container)                         // 将世界容器添加到舞台
    this.camera.enableDrag(this.app.canvas as HTMLCanvasElement)            // 启用拖拽和缩放

    // ── 创建分层容器结构（claude-office 渲染层级） ──
    this.initLayers()

    // ── 创建并绘制地图（背景层 + 桌面底层 + 桌面顶层） ──
    this.officeMap = new OfficeMap()
    this.officeMap.drawMap(
      this.config.zones,
      this.config.desks,
      this.config.map_width,
      this.config.map_height,
    )
    // 地图容器作为最底层，直接添加到摄像机世界容器
    this.camera.container.addChildAt(this.officeMap.container, 0)          // 确保地图在最底层

    // 将 OfficeMap 的桌面分层内容转移到场景层级
    // 椅子添加到 Y-sorted 层（含 zIndex 用于深度排序）
    for (const { sprite, sortY } of this.officeMap.getChairSprites()) {
      sprite.zIndex = sortY                                                // 椅子深度 = deskY + 20
      this.layerYSorted!.addChild(sprite)
    }
    // 桌面底层内容（desk + keyboard）
    for (const child of [...this.officeMap.deskBaseContainer.children]) {
      this.layerDeskBase!.addChild(child)
    }
    // 桌面顶层内容（monitor + accessories + marquee）
    for (const child of [...this.officeMap.deskTopContainer.children]) {
      this.layerDeskTop!.addChild(child)
    }
    console.log('[OfficeScene] 桌面分层容器已转移到场景层级')

    // ── 初始化 A* 寻路系统 ──
    this.pathSystem = new PathSystem()
    const walkableGrid = this.officeMap.getWalkableGrid()                  // 获取可通行网格
    this.pathSystem.setGrid(walkableGrid)
    console.log('[OfficeScene] A* 寻路系统初始化完成')

    // ── 初始自动缩放适配全地图 ──
    this.camera.fitToScreen()

    // ── 注册 ticker 渲染循环 ──
    this.app.ticker.add((ticker) => {
      const delta = ticker.deltaTime                                       // 获取帧间隔系数

      // 更新所有 Agent 精灵（路径移动 + 动画）
      for (const [agentId, sprite] of this.agents) {
        this.updateAgentPath(agentId, sprite, delta)                       // 路径移动逻辑
        sprite.update(delta)                                               // 精灵动画更新
      }

      // 每帧按 Y 坐标排序 Y-sorted 层
      this.sortYSortedLayer()

      // 每帧驱动桌面滚动文字动画
      this.officeMap?.tickMarquees()
    })

    console.log(`[OfficeScene] 场景初始化完成 办公室=${this.config.office_name}`)
  }

  /**
   * 创建分层容器结构
   * 按照 claude-office 渲染层级从下到上添加到摄像机世界容器：
   *   地图（由 drawMap 添加） → Y-sorted → 手臂层 → 名字标签层 → 气泡层
   */
  private initLayers(): void {
    if (!this.camera) return

    // Y-sorted 层：椅子 + Agent 身体，启用 sortableChildren 自动按 zIndex 排序
    this.layerYSorted = new Container()
    this.layerYSorted.label = 'layer-y-sorted'                             // 调试标签
    this.layerYSorted.sortableChildren = true                              // 启用子元素按 zIndex 排序
    this.camera.container.addChild(this.layerYSorted)

    // 桌面底层（desk + keyboard）
    this.layerDeskBase = new Container()
    this.layerDeskBase.label = 'layer-desk-base'
    this.camera.container.addChild(this.layerDeskBase)

    // Agent 手臂层：在桌面上方渲染
    this.layerArmOverDesk = new Container()
    this.layerArmOverDesk.label = 'layer-arm-over-desk'
    this.camera.container.addChild(this.layerArmOverDesk)

    // 桌面顶层（monitor + accessories + marquee）
    this.layerDeskTop = new Container()
    this.layerDeskTop.label = 'layer-desk-top'
    this.camera.container.addChild(this.layerDeskTop)

    // 名字标签层：始终在最上方显示
    this.layerNameTags = new Container()
    this.layerNameTags.label = 'layer-name-tags'
    this.camera.container.addChild(this.layerNameTags)

    // 气泡层：最顶层，状态气泡/对话气泡
    this.layerBubbles = new Container()
    this.layerBubbles.label = 'layer-bubbles'
    this.camera.container.addChild(this.layerBubbles)

    console.log('[OfficeScene] 分层容器已创建：Y-sorted / 桌面底层 / 手臂 / 桌面顶层 / 标签 / 气泡')
  }

  /**
   * 每帧按 Y 坐标排序 Y-sorted 层中的所有子元素
   * 利用 sortableChildren 特性，设置每个子元素的 zIndex 为其 Y 坐标
   * Y 值越大（越靠下方）渲染层级越高，实现正确的前后遮挡
   */
  private sortYSortedLayer(): void {
    if (!this.layerYSorted) return

    const children = this.layerYSorted.children                            // 获取所有子元素
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!
      // 只对 Agent 容器动态更新 zIndex，椅子保持创建时设定的固定 zIndex
      if (child.label?.startsWith('agent-')) {
        child.zIndex = Math.floor(child.y)                                 // Agent 按 Y 坐标排序
      }
    }
  }

  /**
   * 注册 Agent 点击回调
   * @param callback 点击时触发的回调函数，参数为 Agent ID
   */
  setOnAgentClick(callback: (id: string) => void): void {
    this.onAgentClick = callback                                           // 缓存回调
  }

  /**
   * 设置选中的 Agent（高亮显示）
   * @param agentId 要选中的 Agent ID，null 取消选中
   */
  selectAgent(agentId: string | null): void {
    // 取消旧选中
    if (this.selectedAgentId) {
      const old = this.agents.get(this.selectedAgentId)
      old?.setSelected(false)                                              // 移除高亮
    }
    this.selectedAgentId = agentId                                         // 更新选中 ID
    // 设置新选中
    if (agentId) {
      const sprite = this.agents.get(agentId)
      sprite?.setSelected(true)                                            // 添加高亮
    }
  }

  /**
   * 批量更新所有 Agent 的状态和位置
   * - 新 Agent：创建精灵并添加到 Y-sorted 层
   * - 已有 Agent：更新状态，通过 A* 寻路移动到新位置
   * - 消失的 Agent：销毁并从场景中移除
   * @param agentsData Agent 数据数组
   */
  updateAgents(agentsData: AgentRuntime[]): void {
    if (!this.camera || !this.config || !this.layerYSorted) return

    const currentIds = new Set<string>()                                   // 记录本次更新中的所有 ID

    for (const data of agentsData) {
      currentIds.add(data.id)

      let sprite = this.agents.get(data.id)

      if (!sprite) {
        // ── 新 Agent：创建精灵 ──
        const pos = this.getPositionForState(data.state, data.desk_index, data.id, data.name)
        sprite = new AgentSprite(
          data.id,
          data.name,
          data.color,
          pos.x,
          pos.y,
          data.desk_index,
        )

        // 绑定点击事件
        if (this.onAgentClick) {
          const cb = this.onAgentClick                                     // 闭包捕获回调
          sprite.onTap((id) => cb(id))
        }

        this.agents.set(data.id, sprite)                                   // 注册到映射表
        this.layerYSorted.addChild(sprite.container)                       // 添加到 Y-sorted 层
        this.layerNameTags?.addChild(sprite.labelContainer)                // 标签提升到全局标签层
        this.layerBubbles?.addChild(sprite.bubbleRoot)                     // 气泡提升到全局气泡层
        this.layerArmOverDesk?.addChild(sprite.armContainer)               // 手臂提升到全局手臂层
        console.log(`[OfficeScene] 新增 Agent: ${data.name}(${data.id}) desk=${data.desk_index}`)
      }

      // 更新 Agent 状态（触发动画/图标切换）
      sprite.updateState(data.state, data.detail)

      // 根据状态计算目标位置，通过 A* 寻路移动
      const pos = this.getPositionForState(data.state, data.desk_index, data.id, data.name)
      this.setAgentPath(data.id, pos.x, pos.y)                            // 使用 A* 寻路

      // 工作状态下激活打字动画
      const isWorking = ['writing', 'researching', 'executing', 'syncing'].includes(data.state)
      sprite.setTyping(isWorking)                                          // 控制打字动画

      // 更新桌面滚动文字（原版：工作中显示 currentTask 或 name）
      if (this.officeMap && data.desk_index >= 0) {
        const deskIdx = data.desk_index                                      // desk_index 已是 0-based
        const marqueeText = isWorking ? (data.detail || data.name || '') : ''
        this.officeMap.updateDeskMarquee(deskIdx, marqueeText)             // 更新 marquee 文字
      }
    }

    // ── 移除不再存在的 Agent ──
    for (const [id, sprite] of this.agents) {
      if (!currentIds.has(id)) {
        sprite.destroy()                                                   // 销毁精灵
        this.agents.delete(id)                                             // 从映射表移除
        this.agentPaths.delete(id)                                         // 清理路径状态
        console.log(`[OfficeScene] 移除 Agent: ${id}`)
      }
    }
  }

  /**
   * 根据 Agent 状态计算目标位置（claude-office 工位布局风格）
   *
   * 工位布局：4 个一排，起始 (256, 408)，间距 256x192
   * idle：在饮水机/休息区附近随机分散
   * working（writing/researching/executing/syncing）：对应工位椅子位置
   * error：在打印机附近
   *
   * @param state Agent 当前状态
   * @param deskIndex 分配的工位编号
   * @param agentId Agent ID（用于散列分散位置）
   * @returns 目标坐标 {x, y}
   */
  private getPositionForState(
    state: string,
    deskIndex: number,
    agentId: string,
    agentName?: string,
  ): { x: number; y: number } {
    const hash = this.hashString(agentId)                                  // 基于 ID 的散列值

    switch (state) {
      case 'idle': {
        // Boss（小浩仔）idle 也在地毯区域附近
        if (agentName === '小浩仔') {
          return { x: 640 + (hash % 3 - 1) * 30, y: 900 + (hash % 3) * 20 }
        }
        // idle 状态：在墙壁下方空地均匀分散排列（使用 deskIndex 保证不重叠）
        const idx = deskIndex >= 0 ? deskIndex : (hash % 9)                  // 使用 deskIndex 或散列
        const col = idx % 5                                                   // 5 列分布
        const row = Math.floor(idx / 5)                                       // 行号
        return {
          x: IDLE_AREA_X + col * (IDLE_SPREAD_X / 4),                        // 均匀水平分布
          y: IDLE_AREA_Y + row * (IDLE_SPREAD_Y),                             // 均匀垂直分布
        }
      }

      case 'writing':
      case 'researching':
      case 'executing':
      case 'syncing': {
        // Boss（小浩仔）在地毯区域独立位置
        if (agentName === '小浩仔') {
          return { x: 640, y: 940 }                                         // Boss 地毯位置
        }
        // 普通 Agent：desk_index 1-8 映射到工位 0-7
        const idx = deskIndex > 0 ? deskIndex - 1 : (hash % 8)            // Boss desk=0 已处理
        const col = idx % DESKS_PER_ROW                                    // 列号（0-3）
        const row = Math.floor(idx / DESKS_PER_ROW)                        // 行号（0-1）
        return {
          x: DESK_ORIGIN_X + col * DESK_SPACING_X,                         // 工位 X 坐标
          y: DESK_ORIGIN_Y + row * DESK_SPACING_Y,                          // 工位 Y（无 +32 偏移）
        }
      }

      case 'error': {
        // error 状态：在打印机附近分散
        const errOffX = (hash % 5) * (ERROR_SPREAD / 5)                    // 水平分散
        const errOffY = ((hash >> 2) % 3) * (ERROR_SPREAD / 3)            // 垂直分散
        return {
          x: ERROR_AREA_X + errOffX,
          y: ERROR_AREA_Y + errOffY,
        }
      }

      default: {
        // 未知状态：回退到 idle 区域
        return {
          x: IDLE_AREA_X + (hash % 5) * 50,
          y: IDLE_AREA_Y + ((hash >> 2) % 4) * 40,
        }
      }
    }
  }

  /**
   * 为 Agent 设置新的 A* 寻路移动路径
   * @param agentId Agent ID
   * @param targetX 目标世界 X 坐标
   * @param targetY 目标世界 Y 坐标
   */
  private setAgentPath(agentId: string, targetX: number, targetY: number): void {
    const sprite = this.agents.get(agentId)
    if (!sprite || !this.pathSystem) {
      sprite?.moveTo(targetX, targetY)                                     // 无寻路系统时直接移动
      return
    }

    const startX = sprite.container.x                                      // 当前位置 X
    const startY = sprite.container.y                                      // 当前位置 Y

    // 如果距离目标很近则跳过寻路
    const dx = targetX - startX
    const dy = targetY - startY
    if (dx * dx + dy * dy < 16) return                                     // 距离 < 4px 不需要移动

    const waypoints = this.pathSystem.findPath(startX, startY, targetX, targetY) // A* 计算路径

    if (waypoints.length === 0) {
      sprite.moveTo(targetX, targetY)                                      // 无路径直接移动
      return
    }

    // 设置路径状态
    const pathState: AgentPathState = {
      waypoints,
      currentIdx: 0,
      isFollowing: true,
    }
    this.agentPaths.set(agentId, pathState)                                // 注册路径状态

    // 开始移动到第一个路径点
    const firstWp = waypoints[0]!
    sprite.moveTo(firstWp.x, firstWp.y)                                    // 启动向第一个路径点移动
  }

  /**
   * 每帧更新 Agent 沿路径移动
   * 当 Agent 到达当前路径点时，切换到下一个路径点
   * @param agentId Agent ID
   * @param sprite Agent 精灵
   * @param delta 帧间隔系数
   */
  private updateAgentPath(agentId: string, sprite: AgentSprite, delta: number): void {
    const pathState = this.agentPaths.get(agentId)                         // 获取路径状态
    if (!pathState || !pathState.isFollowing) return                        // 无路径或不在跟随

    const target = pathState.waypoints[pathState.currentIdx]               // 当前目标路径点
    if (!target) {
      pathState.isFollowing = false                                        // 路径结束
      return
    }

    // 计算到当前目标点的距离
    const dx = target.x - sprite.container.x                               // 水平差
    const dy = target.y - sprite.container.y                               // 垂直差
    const dist = Math.sqrt(dx * dx + dy * dy)                             // 欧氏距离

    if (dist < PATH_MOVE_SPEED * delta + 2) {
      // 到达当前路径点，切换到下一个
      pathState.currentIdx++
      if (pathState.currentIdx >= pathState.waypoints.length) {
        pathState.isFollowing = false                                      // 路径全部完成
        // 精确设置到终点位置
        const lastWp = pathState.waypoints[pathState.waypoints.length - 1]
        if (lastWp) sprite.moveTo(lastWp.x, lastWp.y)
      } else {
        // 继续移动到下一个路径点
        const nextWp = pathState.waypoints[pathState.currentIdx]!
        sprite.moveTo(nextWp.x, nextWp.y)
      }
    }
    // 实际移动由 AgentSprite.update() 内部的插值完成
  }

  /**
   * 简单字符串哈希函数
   * 用于将 Agent ID 映射为数值，实现位置分散
   * @param str 输入字符串
   * @returns 哈希值（正整数）
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)                                       // 获取字符编码
      hash = ((hash << 5) - hash) + char                                   // hash * 31 + char
      hash = hash & hash                                                   // 转为 32 位整数
    }
    return Math.abs(hash)                                                  // 返回正整数
  }

  /**
   * 处理窗口尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  resize(width: number, height: number): void {
    if (!this.app?.renderer) return
    this.app.renderer.resize(width, height)                                // 调整渲染器尺寸
    this.camera?.resize(width, height)                                     // 通知摄像机尺寸变化
    console.log(`[OfficeScene] 窗口尺寸变化 ${width}x${height}`)
  }

  /**
   * 销毁场景，释放所有资源
   * 按依赖关系逆序销毁：Agent → 分层容器 → 摄像机 → 地图 → 寻路 → PixiJS
   */
  destroy(): void {
    // 销毁所有 Agent 精灵
    for (const sprite of this.agents.values()) {
      sprite.destroy()
    }
    this.agents.clear()                                                    // 清空映射表
    this.agentPaths.clear()                                                // 清空路径状态

    // 销毁分层容器
    this.layerYSorted?.destroy({ children: true })                         // 销毁 Y-sorted 层及子元素
    this.layerArmOverDesk?.destroy({ children: true })                     // 销毁手臂层
    this.layerDeskBase?.destroy({ children: true })                        // 销毁桌面底层
    this.layerDeskTop?.destroy({ children: true })                         // 销毁桌面顶层
    this.layerNameTags?.destroy({ children: true })                        // 销毁标签层
    this.layerBubbles?.destroy({ children: true })                         // 销毁气泡层
    this.layerYSorted = null
    this.layerArmOverDesk = null
    this.layerDeskBase = null
    this.layerDeskTop = null
    this.layerNameTags = null
    this.layerBubbles = null

    // 销毁摄像机
    this.camera?.destroy()
    this.camera = null

    // 清理地图和寻路系统
    this.officeMap = null
    this.pathSystem = null

    // 销毁 PixiJS 应用
    this.app.destroy(true)
    console.log('[OfficeScene] 场景已销毁，所有资源已释放')
  }
}
