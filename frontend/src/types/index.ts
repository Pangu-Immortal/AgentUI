/**
 * 全局 TypeScript 类型定义
 *
 * 包含：
 * - AgentRole: 角色配置（来自后端 /agent-roles）
 * - AgentRuntime: Agent 运行时状态（合并角色+运行数据）
 * - OfficeConfig: 办公室布局配置（来自后端 /office-config）
 * - ZoneConfig: 区域配置
 * - DeskConfig: 工位配置
 */

/** Agent 角色配置（来自后端 /agent-roles 接口） */
export interface AgentRole {
  name: string       // 角色名称，如 "前端工程师"
  role: string       // 角色标识，如 "frontend"
  color: string      // 角色代表色，如 "#4a90d9"
  desk_index: number // 分配的工位索引
}

/** Agent 运行时状态（合并角色信息和后端运行数据） */
export interface AgentRuntime {
  id: string         // Agent 唯一标识
  name: string       // 名称（来自角色配置）
  color: string      // 代表色（来自角色配置）
  state: string      // 当前状态，如 idle/writing/researching/executing
  detail: string     // 状态详情描述
  desk_index: number // 工位索引（来自角色配置）
}

/** 区域配置（办公室功能区域） */
export interface ZoneConfig {
  x: number          // 区域左上角 X 坐标
  y: number          // 区域左上角 Y 坐标
  width: number      // 区域宽度
  height: number     // 区域高度
  label: string      // 区域标签名称
}

/** 工位配置（办公桌位置和尺寸） */
export interface DeskConfig {
  index: number      // 工位编号
  x: number          // 工位左上角 X 坐标
  y: number          // 工位左上角 Y 坐标
  width: number      // 工位宽度
  height: number     // 工位高度
}

/** 办公室布局配置（来自后端 /office-config 接口） */
export interface OfficeConfig {
  office_name: string                    // 办公室名称
  map_width: number                      // 地图宽度（像素）
  map_height: number                     // 地图高度（像素）
  zones: Record<string, ZoneConfig>      // 功能区域字典
  desks: DeskConfig[]                    // 工位列表
  poll_interval_ms: number               // 轮询间隔（毫秒）
}
