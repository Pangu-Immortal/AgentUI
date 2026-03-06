/**
 * 办公室主场景管理器 - OfficeScene.ts
 *
 * PixiJS 8 场景管理器，负责：
 * - init(): 初始化 PixiJS Application、创建 Camera、OfficeMap、AgentSprite、PetSprite
 * - updateAgents(): 批量更新所有 Agent 的状态和位置
 * - resize(): 处理窗口尺寸变化
 * - destroy(): 销毁场景释放所有资源
 *
 * 位置映射逻辑：
 *   idle -> 休息区（3x3 网格均匀分散）
 *   writing/researching/executing -> 对应工位
 *   syncing -> 对应工位
 *   error -> Bug 角落
 *
 * 不再依赖 AssetLoader（纯代码绘制），使用 PathSystem 进行 A* 寻路。
 *
 * 函数列表：
 *   constructor() - 创建 PixiJS Application 实例
 *   init() - 初始化场景（画布、摄像机、地图、宠物、寻路系统）
 *   createPets() - 创建宠物精灵
 *   setOnAgentClick() - 注册 Agent 点击回调
 *   selectAgent() - 设置选中的 Agent
 *   updateAgents() - 批量更新 Agent 状态和位置
 *   getPositionForState() - 根据状态计算目标位置
 *   hashString() - 字符串哈希函数
 *   resize() - 处理窗口尺寸变化
 *   destroy() - 销毁场景
 */
import { Application } from 'pixi.js'
import { Camera } from './Camera'
import { OfficeMap } from './OfficeMap'
import { AgentSprite } from './AgentSprite'
import { PetSprite } from './PetSprite'
import { PathSystem } from './PathSystem'
import type { Waypoint } from './PathSystem'
import type { AgentRuntime, OfficeConfig } from '../types'

/** 宠物数量配置 */
const PET_COUNT = 3                                                       // 场景中的宠物数量

/** Agent 路径移动速度（像素/帧） */
const PATH_MOVE_SPEED = 1.5                                               // 沿路径移动的速度

/** Agent 寻路状态 */
interface AgentPathState {
  waypoints: Waypoint[]     // 当前路径点列表
  currentIdx: number        // 当前目标路径点索引
  isFollowing: boolean      // 是否正在沿路径移动
}

export class OfficeScene {
  app: Application                                     // PixiJS 应用实例

  private camera: Camera | null = null                 // 摄像机控制器
  private officeMap: OfficeMap | null = null            // 地图渲染器
  private agents: Map<string, AgentSprite> = new Map() // Agent 精灵映射表
  private pets: PetSprite[] = []                        // 宠物精灵列表
  private config: OfficeConfig | null = null            // 办公室配置缓存
  private onAgentClick: ((id: string) => void) | null = null // Agent 点击回调
  private selectedAgentId: string | null = null         // 当前选中的 Agent ID
  private pathSystem: PathSystem | null = null          // A* 寻路系统
  private agentPaths: Map<string, AgentPathState> = new Map() // Agent 路径状态

  constructor() {
    this.app = new Application()                       // 创建 PixiJS 应用（尚未初始化）
  }

  /**
   * 初始化场景
   * @param container 挂载容器 DOM 元素
   * @param config 办公室配置数据
   */
  async init(container: HTMLElement, config?: OfficeConfig): Promise<void> {
    if (config) this.config = config                   // 缓存配置

    const width = container.clientWidth || 800         // 获取容器宽度
    const height = container.clientHeight || 600       // 获取容器高度

    // 初始化 PixiJS 8 Application
    await this.app.init({
      width,
      height,
      background: 0x1a1a2e,                            // 深蓝黑背景
      antialias: false,                                // 关闭抗锯齿（像素风格）
      roundPixels: true,                               // 像素对齐
      resolution: window.devicePixelRatio || 1,        // 适配高清屏
      autoDensity: true,                               // 自动适配密度
    })

    // 将 PixiJS 创建的 canvas 追加到容器中
    container.appendChild(this.app.canvas)
    console.log(`[OfficeScene] PixiJS 应用初始化完成 ${width}x${height}`)

    // 纯代码绘制，无需加载外部素材
    console.log('[OfficeScene] 使用纯 Graphics 绘制，无需加载素材')

    if (!this.config) return                           // 无配置则仅初始化画布

    // 创建摄像机
    this.camera = new Camera(width, height, this.config.map_width, this.config.map_height)
    this.app.stage.addChild(this.camera.container)     // 将世界容器添加到舞台
    this.camera.enableDrag(this.app.canvas as HTMLCanvasElement) // 启用拖拽和缩放

    // 创建并绘制地图
    this.officeMap = new OfficeMap()
    this.officeMap.drawMap(this.config.zones, this.config.desks, this.config.map_width, this.config.map_height)
    this.camera.container.addChild(this.officeMap.container)

    // 初始化寻路系统
    this.pathSystem = new PathSystem()
    const walkableGrid = this.officeMap.getWalkableGrid()                 // 获取可通行网格
    this.pathSystem.setGrid(walkableGrid)
    console.log('[OfficeScene] A* 寻路系统初始化完成')

    // 创建宠物精灵
    this.createPets()

    // 初始自动缩放适配全地图
    this.camera.fitToScreen()

    // 注册 ticker 更新循环
    this.app.ticker.add((ticker) => {
      const delta = ticker.deltaTime                   // 获取帧间隔系数

      // 更新所有 Agent 精灵（沿路径移动 + 动画）
      for (const [agentId, sprite] of this.agents) {
        this.updateAgentPath(agentId, sprite, delta)   // 路径移动逻辑
        sprite.update(delta)                           // 精灵动画更新
      }

      // 更新所有宠物精灵
      for (const pet of this.pets) {
        pet.update(delta)                              // 宠物漫游动画更新
      }
    })

    console.log(`[OfficeScene] 场景初始化完成 办公室=${this.config.office_name}`)
  }

  /**
   * 更新 Agent 沿路径移动
   * @param agentId Agent ID
   * @param sprite Agent 精灵
   * @param delta 帧间隔
   */
  private updateAgentPath(agentId: string, sprite: AgentSprite, delta: number): void {
    const pathState = this.agentPaths.get(agentId)                        // 获取路径状态
    if (!pathState || !pathState.isFollowing) return                       // 无路径或不在跟随

    const target = pathState.waypoints[pathState.currentIdx]              // 当前目标点
    if (!target) {
      pathState.isFollowing = false                                       // 路径结束
      return
    }

    // 计算到当前目标点的距离
    const dx = target.x - sprite.container.x                              // 水平差
    const dy = target.y - sprite.container.y                              // 垂直差
    const dist = Math.sqrt(dx * dx + dy * dy)                            // 距离

    if (dist < PATH_MOVE_SPEED * delta + 2) {
      // 到达当前路径点，切换到下一个
      pathState.currentIdx++
      if (pathState.currentIdx >= pathState.waypoints.length) {
        pathState.isFollowing = false                                     // 路径完成
        // 精确设置到终点
        const lastWp = pathState.waypoints[pathState.waypoints.length - 1]
        if (lastWp) sprite.moveTo(lastWp.x, lastWp.y)
      } else {
        // 移动到下一个路径点
        const nextWp = pathState.waypoints[pathState.currentIdx]!
        sprite.moveTo(nextWp.x, nextWp.y)
      }
    }
    // moveTo 由 AgentSprite.update() 内部的插值完成实际移动
  }

  /**
   * 为 Agent 设置新的移动路径
   * @param agentId Agent ID
   * @param targetX 目标世界 X
   * @param targetY 目标世界 Y
   */
  private setAgentPath(agentId: string, targetX: number, targetY: number): void {
    const sprite = this.agents.get(agentId)
    if (!sprite || !this.pathSystem) {
      // 无寻路系统时直接移动
      sprite?.moveTo(targetX, targetY)
      return
    }

    // 使用 A* 寻路
    const startX = sprite.container.x                                     // 当前位置 X
    const startY = sprite.container.y                                     // 当前位置 Y
    const waypoints = this.pathSystem.findPath(startX, startY, targetX, targetY) // 计算路径

    if (waypoints.length === 0) {
      sprite.moveTo(targetX, targetY)                                     // 无路径直接移动
      return
    }

    // 设置路径状态
    const pathState: AgentPathState = {
      waypoints,
      currentIdx: 0,
      isFollowing: true,
    }
    this.agentPaths.set(agentId, pathState)

    // 开始移动到第一个路径点
    const firstWp = waypoints[0]!
    sprite.moveTo(firstWp.x, firstWp.y)
  }

  /**
   * 创建宠物精灵并添加到场景
   */
  private createPets(): void {
    if (!this.camera || !this.config) return

    const mw = this.config.map_width                   // 地图宽度
    const mh = this.config.map_height                  // 地图高度

    for (let i = 0; i < PET_COUNT; i++) {
      const x = 100 + Math.random() * (mw - 200)      // 随机初始 X
      const y = 100 + Math.random() * (mh - 200)      // 随机初始 Y
      const pet = new PetSprite(i, x, y, mw, mh)      // 创建宠物
      this.pets.push(pet)
      this.camera.container.addChild(pet.container)    // 添加到世界容器
    }

    console.log(`[OfficeScene] 已创建 ${PET_COUNT} 只宠物（沿固定路线巡回）`)
  }

  /**
   * 注册 Agent 点击回调
   * @param callback 点击时触发的回调函数
   */
  setOnAgentClick(callback: (id: string) => void): void {
    this.onAgentClick = callback
  }

  /**
   * 设置选中的 Agent（高亮显示）
   * @param agentId 要选中的 Agent ID，null 取消选中
   */
  selectAgent(agentId: string | null): void {
    // 取消旧选中
    if (this.selectedAgentId) {
      const old = this.agents.get(this.selectedAgentId)
      old?.setSelected(false)
    }
    this.selectedAgentId = agentId
    // 设置新选中
    if (agentId) {
      const sprite = this.agents.get(agentId)
      sprite?.setSelected(true)
    }
  }

  /**
   * 批量更新所有 Agent 的状态和位置
   * @param agentsData Agent 数据数组
   */
  updateAgents(agentsData: AgentRuntime[]): void {
    if (!this.camera || !this.config) return

    const currentIds = new Set<string>()               // 记录本次更新中的所有 ID

    for (const data of agentsData) {
      currentIds.add(data.id)

      let sprite = this.agents.get(data.id)

      if (!sprite) {
        // 新 Agent：创建精灵
        const pos = this.getPositionForState(data.state, data.desk_index, data.id)
        sprite = new AgentSprite(data.id, data.name, data.color, pos.x, pos.y, data.desk_index)
        // 绑定点击事件
        if (this.onAgentClick) {
          const cb = this.onAgentClick
          sprite.onTap((id) => cb(id))
        }
        this.agents.set(data.id, sprite)
        this.camera.container.addChild(sprite.container)
        console.log(`[OfficeScene] 新增 Agent: ${data.name}(${data.id}) desk=${data.desk_index}`)
      }

      // 更新状态
      sprite.updateState(data.state, data.detail)

      // 根据状态计算目标位置，通过寻路系统移动
      const pos = this.getPositionForState(data.state, data.desk_index, data.id)
      this.setAgentPath(data.id, pos.x, pos.y)        // 使用 A* 寻路
    }

    // 移除不再存在的 Agent
    for (const [id, sprite] of this.agents) {
      if (!currentIds.has(id)) {
        sprite.destroy()
        this.agents.delete(id)
        this.agentPaths.delete(id)                     // 清理路径状态
        console.log(`[OfficeScene] 移除 Agent: ${id}`)
      }
    }
  }

  /**
   * 根据 Agent 状态计算目标位置
   * @param state Agent 当前状态
   * @param deskIndex 分配的工位编号
   * @param agentId Agent ID
   * @returns 目标坐标 {x, y}
   */
  private getPositionForState(state: string, deskIndex: number, agentId: string): { x: number; y: number } {
    if (!this.config) return { x: 100, y: 100 }

    const zones = this.config.zones
    const desks = this.config.desks
    const idx = deskIndex >= 0 ? deskIndex : this.hashString(agentId) % 9

    switch (state) {
      case 'idle': {
        // idle 状态：在休息区 3x3 网格均匀分散排列
        const restZone = zones['rest']
        if (restZone) {
          const col = idx % 3, row = Math.floor(idx / 3)
          const padX = 50, padY = 50
          const cellW = (restZone.width - padX * 2) / 3
          const cellH = (restZone.height - padY * 2) / 3
          return {
            x: restZone.x + padX + cellW * col + cellW / 2,
            y: restZone.y + padY + cellH * row + cellH / 2,
          }
        }
        return { x: 100 + idx * 30, y: 150 }
      }

      case 'writing':
      case 'researching':
      case 'executing':
      case 'syncing': {
        // 工作状态：移动到对应工位椅子位置
        const desk = desks.find(d => d.index === deskIndex)
        if (desk) {
          return {
            x: desk.x + desk.width / 2,
            y: desk.y + desk.height + 20,              // 椅子位置（桌子下方）
          }
        }
        const workZone = zones['work']
        if (workZone) {
          return { x: workZone.x + 60 + idx * 40, y: workZone.y + 60 }
        }
        return { x: 300, y: 300 }
      }

      case 'error': {
        // error 状态：在 Bug 角落分散排列
        const bugZone = zones['bug']
        if (bugZone) {
          const col = idx % 3, row = Math.floor(idx / 3)
          return {
            x: bugZone.x + 50 + col * 60,
            y: bugZone.y + 80 + row * 60,
          }
        }
        return { x: 50, y: 50 }
      }

      default: {
        const defaultZone = zones['rest']
        if (defaultZone) {
          return {
            x: defaultZone.x + 50 + (idx % 3) * 50,
            y: defaultZone.y + 50 + Math.floor(idx / 3) * 50,
          }
        }
        return { x: 200, y: 200 }
      }
    }
  }

  /**
   * 简单字符串哈希函数
   * @param str 输入字符串
   * @returns 哈希值（正整数）
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  /**
   * 处理窗口尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  resize(width: number, height: number): void {
    if (!this.app?.renderer) return
    this.app.renderer.resize(width, height)
    this.camera?.resize(width, height)
    console.log(`[OfficeScene] 窗口尺寸变化 ${width}x${height}`)
  }

  /** 销毁场景，释放所有资源 */
  destroy(): void {
    // 销毁所有 Agent 精灵
    for (const sprite of this.agents.values()) {
      sprite.destroy()
    }
    this.agents.clear()
    this.agentPaths.clear()                            // 清理路径状态

    // 销毁所有宠物精灵
    for (const pet of this.pets) {
      pet.destroy()
    }
    this.pets = []

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
