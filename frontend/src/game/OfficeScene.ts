/**
 * 办公室主场景管理器 - OfficeScene.ts
 *
 * PixiJS 8 场景管理器，负责：
 * - init(): 初始化 PixiJS Application 并创建 Camera、OfficeMap、AgentSprite
 * - updateAgents(): 批量更新所有 Agent 的状态和位置
 * - resize(): 处理窗口尺寸变化
 * - destroy(): 销毁场景释放所有资源
 *
 * 位置映射逻辑：
 *   idle -> 休息区（随机分散）
 *   writing/researching/executing -> 对应工位
 *   syncing -> 对应工位
 *   error -> Bug 角落
 */
import { Application } from 'pixi.js'
import { Camera } from './Camera'
import { OfficeMap } from './OfficeMap'
import { AgentSprite } from './AgentSprite'
import type { AgentRuntime, OfficeConfig } from '../types'

export class OfficeScene {
  app: Application                                     // PixiJS 应用实例

  private camera: Camera | null = null                 // 摄像机控制器
  private officeMap: OfficeMap | null = null            // 地图渲染器
  private agents: Map<string, AgentSprite> = new Map() // Agent 精灵映射表
  private config: OfficeConfig | null = null            // 办公室配置缓存
  private onAgentClick: ((id: string) => void) | null = null // Agent 点击回调
  private selectedAgentId: string | null = null         // 当前选中的 Agent ID

  constructor() {
    this.app = new Application()                       // 创建 PixiJS 应用（尚未初始化）
  }

  /**
   * 初始化场景
   * @param container 挂载容器 DOM 元素（div 或 canvas 均可）
   * @param config 办公室配置数据
   */
  async init(container: HTMLElement, config?: OfficeConfig): Promise<void> {
    if (config) this.config = config                   // 缓存配置

    const width = container.clientWidth || 800         // 获取容器宽度
    const height = container.clientHeight || 600       // 获取容器高度

    // 初始化 PixiJS 8 Application（让 PixiJS 自己创建 canvas）
    await this.app.init({
      width,                                           // 画布宽度
      height,                                          // 画布高度
      background: 0x1a1a2e,                            // 深蓝黑背景
      antialias: false,                                // 关闭抗锯齿（像素风格）
      resolution: window.devicePixelRatio || 1,        // 适配高清屏
      autoDensity: true,                               // 自动适配密度
    })

    // 将 PixiJS 创建的 canvas 追加到容器中
    container.appendChild(this.app.canvas)             // 挂载到 DOM
    console.log(`[OfficeScene] PixiJS 应用初始化完成 ${width}x${height}`)

    if (!this.config) return                           // 无配置则仅初始化画布

    // 创建摄像机
    this.camera = new Camera(width, height, this.config.map_width, this.config.map_height)
    this.app.stage.addChild(this.camera.container)     // 将世界容器添加到舞台
    this.camera.enableDrag(this.app.canvas as HTMLCanvasElement) // 启用拖拽和缩放

    // 创建并绘制地图
    this.officeMap = new OfficeMap()
    this.officeMap.drawMap(this.config.zones, this.config.desks, this.config.map_width, this.config.map_height)
    this.camera.container.addChild(this.officeMap.container) // 地图添加到世界容器

    // 初始自动缩放适配全地图
    this.camera.fitToScreen()

    // 注册 ticker 更新循环
    this.app.ticker.add((ticker) => {
      const delta = ticker.deltaTime                   // 获取帧间隔系数
      // 更新所有 Agent 精灵
      for (const sprite of this.agents.values()) {
        sprite.update(delta)                           // 调用每个精灵的帧更新
      }
    })

    console.log(`[OfficeScene] 场景初始化完成 办公室=${this.config.office_name}`)
  }

  /**
   * 注册 Agent 点击回调
   * @param callback 点击时触发的回调函数
   */
  setOnAgentClick(callback: (id: string) => void): void {
    this.onAgentClick = callback                           // 保存回调
  }

  /**
   * 设置选中的 Agent（高亮显示）
   * @param agentId 要选中的 Agent ID，null 取消选中
   */
  selectAgent(agentId: string | null): void {
    // 取消旧选中
    if (this.selectedAgentId) {
      const old = this.agents.get(this.selectedAgentId)
      old?.setSelected(false)                              // 取消旧高亮
    }
    this.selectedAgentId = agentId                         // 更新选中 ID
    // 设置新选中
    if (agentId) {
      const sprite = this.agents.get(agentId)
      sprite?.setSelected(true)                            // 显示新高亮
    }
  }

  /**
   * 批量更新所有 Agent 的状态和位置
   * @param agentsData Agent 数据数组
   */
  updateAgents(agentsData: AgentRuntime[]): void {
    if (!this.camera || !this.config) return            // 未初始化则跳过

    const currentIds = new Set<string>()               // 记录本次更新中的所有 ID

    for (const data of agentsData) {
      currentIds.add(data.id)                          // 标记此 ID 存在

      let sprite = this.agents.get(data.id)            // 查找已有精灵

      if (!sprite) {
        // 新 Agent：创建精灵
        const pos = this.getPositionForState(data.state, data.desk_index, data.id) // 计算初始位置
        sprite = new AgentSprite(data.id, data.name, data.color, pos.x, pos.y)
        // 绑定点击事件
        if (this.onAgentClick) {
          const cb = this.onAgentClick                  // 捕获回调引用
          sprite.onTap((id) => cb(id))                  // 注册点击回调
        }
        this.agents.set(data.id, sprite)               // 保存到映射表
        this.camera.container.addChild(sprite.container) // 添加到世界容器
        console.log(`[OfficeScene] 新增 Agent: ${data.name}(${data.id})`)
      }

      // 更新状态
      sprite.updateState(data.state, data.detail)      // 更新状态气泡

      // 根据状态计算目标位置并移动
      const pos = this.getPositionForState(data.state, data.desk_index, data.id)
      sprite.moveTo(pos.x, pos.y)                     // 平滑移动到目标位置
    }

    // 移除不再存在的 Agent
    for (const [id, sprite] of this.agents) {
      if (!currentIds.has(id)) {
        sprite.destroy()                               // 销毁精灵
        this.agents.delete(id)                         // 从映射表移除
        console.log(`[OfficeScene] 移除 Agent: ${id}`)
      }
    }
  }

  /**
   * 根据 Agent 状态计算目标位置
   * @param state Agent 当前状态
   * @param deskIndex 分配的工位编号
   * @param agentId Agent ID（用于在区域内随机分散）
   * @returns 目标坐标 {x, y}
   */
  private getPositionForState(state: string, deskIndex: number, agentId: string): { x: number; y: number } {
    if (!this.config) return { x: 100, y: 100 }        // 兜底位置

    const zones = this.config.zones                    // 区域配置
    const desks = this.config.desks                    // 工位配置

    // 使用 agentId 的哈希值生成稳定的伪随机偏移
    const hash = this.hashString(agentId)              // 计算字符串哈希
    const offsetX = (hash % 60) - 30                   // X 偏移 [-30, 30]
    const offsetY = ((hash >> 8) % 40) - 20            // Y 偏移 [-20, 20]

    switch (state) {
      case 'idle': {
        // idle 状态：移动到休息区（随机分散）
        const restZone = zones['rest']                 // 获取休息区配置
        if (restZone) {
          return {
            x: restZone.x + restZone.width / 2 + offsetX,  // 休息区中心 + 随机偏移
            y: restZone.y + restZone.height / 2 + offsetY,
          }
        }
        return { x: 100 + offsetX, y: 100 + offsetY } // 兜底位置
      }

      case 'writing':
      case 'researching':
      case 'executing':
      case 'syncing': {
        // 工作状态：移动到对应工位
        const desk = desks.find(d => d.index === deskIndex) // 查找对应工位
        if (desk) {
          return {
            x: desk.x + desk.width / 2,               // 工位水平中心
            y: desk.y - 10,                            // 工位上方（椅子位置）
          }
        }
        // 找不到工位则移动到工作区中心
        const workZone = zones['work']
        if (workZone) {
          return {
            x: workZone.x + workZone.width / 2 + offsetX,
            y: workZone.y + workZone.height / 2 + offsetY,
          }
        }
        return { x: 300, y: 300 }                      // 兜底
      }

      case 'error': {
        // error 状态：移动到 Bug 角落
        const bugZone = zones['bug']                   // 获取 Bug 角配置
        if (bugZone) {
          return {
            x: bugZone.x + bugZone.width / 2 + offsetX,
            y: bugZone.y + bugZone.height / 2 + offsetY,
          }
        }
        return { x: 50 + offsetX, y: 50 + offsetY }   // 兜底
      }

      default: {
        // 未知状态：休息区
        const defaultZone = zones['rest']
        if (defaultZone) {
          return {
            x: defaultZone.x + defaultZone.width / 2 + offsetX,
            y: defaultZone.y + defaultZone.height / 2 + offsetY,
          }
        }
        return { x: 200 + offsetX, y: 200 + offsetY } // 兜底
      }
    }
  }

  /**
   * 简单字符串哈希函数（用于生成稳定的伪随机数）
   * @param str 输入字符串
   * @returns 哈希值（正整数）
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)                   // 获取字符编码
      hash = ((hash << 5) - hash) + char               // hash * 31 + char
      hash = hash & hash                               // 转为 32 位整数
    }
    return Math.abs(hash)                              // 返回正数
  }

  /**
   * 处理窗口尺寸变化
   * @param width 新宽度
   * @param height 新高度
   */
  resize(width: number, height: number): void {
    if (!this.app?.renderer) return                    // 渲染器未就绪则跳过
    this.app.renderer.resize(width, height)            // 调整渲染器尺寸
    this.camera?.resize(width, height)                 // 通知摄像机
    console.log(`[OfficeScene] 窗口尺寸变化 ${width}x${height}`)
  }

  /** 销毁场景，释放所有资源 */
  destroy(): void {
    // 销毁所有 Agent 精灵
    for (const sprite of this.agents.values()) {
      sprite.destroy()                                 // 逐个销毁
    }
    this.agents.clear()                                // 清空映射表

    // 销毁摄像机
    this.camera?.destroy()
    this.camera = null

    // 销毁地图
    this.officeMap = null

    // 销毁 PixiJS 应用
    this.app.destroy(true)                             // 同时销毁画布
    console.log('[OfficeScene] 场景已销毁，所有资源已释放')
  }
}
