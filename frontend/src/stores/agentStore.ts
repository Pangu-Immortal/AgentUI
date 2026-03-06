/**
 * Agent 状态管理 Store (Pinia)
 *
 * 管理所有 Agent 的状态数据和轮询逻辑，包括：
 * - agents: 合并角色配置和运行时状态的 Agent 列表
 * - roles: 角色配置字典（来自 /agent-roles）
 * - officeConfig: 办公室布局配置（来自 /office-config）
 * - selectedAgent: 当前选中的 Agent
 * - init: 初始化加载角色和办公室配置
 * - refreshAgents: 刷新 Agent 运行时状态
 * - startPolling / stopPolling: 轮询控制
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAgents, fetchAgentRoles, fetchOfficeConfig } from '../services/api'
import type { AgentRole, AgentRuntime, OfficeConfig } from '../types'

export const useAgentStore = defineStore('agent', () => {
  // ==================== State ====================
  const agents = ref<AgentRuntime[]>([])                          // 所有 Agent 列表（合并后）
  const roles = ref<Record<string, AgentRole>>({})                // 角色配置字典
  const officeConfig = ref<OfficeConfig | null>(null)             // 办公室布局配置
  const selectedAgentId = ref<string | null>(null)                // 当前选中的 Agent ID
  let pollTimer: ReturnType<typeof setInterval> | null = null     // 轮询定时器

  // ==================== Getters ====================
  /** 获取当前选中的 Agent，未选中返回 null */
  const selectedAgent = computed(() =>
    agents.value.find(a => a.id === selectedAgentId.value) ?? null
  )

  // ==================== Actions ====================

  /**
   * 初始化：并行加载角色配置和办公室配置，然后刷新 Agent 状态
   */
  async function init() {
    console.log('[AgentStore] 开始初始化...') // 初始化日志
    const [rolesData, configData] = await Promise.all([ // 并行请求
      fetchAgentRoles(),  // 加载角色配置
      fetchOfficeConfig(), // 加载办公室配置
    ])
    roles.value = rolesData           // 存储角色配置
    officeConfig.value = configData   // 存储办公室配置
    console.log('[AgentStore] 角色配置已加载，共', Object.keys(rolesData).length, '个角色')
    console.log('[AgentStore] 办公室配置已加载:', configData.office_name)
    await refreshAgents()             // 首次刷新 Agent 状态
  }

  /**
   * 刷新 Agent 运行时状态
   * 将后端 /agents 返回的运行数据与角色配置合并
   */
  async function refreshAgents() {
    try {
      const data = await fetchAgents() // 从后端获取 Agent 状态列表
      const merged: AgentRuntime[] = [] // 合并结果

      // 遍历所有角色，通过 name 字段与运行时数据合并
      for (const [agentId, role] of Object.entries(roles.value)) {
        const typedRole = role as AgentRole // 类型断言
        // 通过 name 匹配运行时 Agent（后端 agentId 是自动生成的，无法直接匹配角色 key）
        const runtime = Array.isArray(data)
          ? data.find((a: Record<string, unknown>) => a.name === typedRole.name)
          : null
        merged.push({
          id: agentId,                                        // Agent 唯一标识
          name: typedRole.name,                               // 名称来自角色配置
          color: typedRole.color,                             // 颜色来自角色配置
          state: (runtime?.state as string) || 'idle',        // 状态，默认 idle
          detail: (runtime?.detail as string) || '',          // 详情，默认空
          desk_index: typedRole.desk_index,                   // 工位索引来自角色配置
        })
      }
      agents.value = merged // 更新 Agent 列表
    } catch (e) {
      console.error('[AgentStore] 刷新 Agent 状态失败', e) // 错误日志
    }
  }

  /**
   * 开始轮询 Agent 状态
   * 轮询间隔取自办公室配置，默认 2500ms
   */
  function startPolling() {
    const interval = officeConfig.value?.poll_interval_ms || 2500 // 轮询间隔
    stopPolling() // 先停止已有轮询
    pollTimer = setInterval(refreshAgents, interval) // 启动定时刷新
    console.log('[AgentStore] 轮询已启动，间隔', interval, 'ms')
  }

  /**
   * 停止轮询
   */
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer) // 清除定时器
      pollTimer = null
      console.log('[AgentStore] 轮询已停止')
    }
  }

  /**
   * 选中某个 Agent
   * @param id - Agent ID，传 null 取消选中
   */
  function selectAgent(id: string | null) {
    selectedAgentId.value = id // 更新选中 ID
  }

  return {
    agents,             // Agent 列表
    roles,              // 角色配置
    officeConfig,       // 办公室配置
    selectedAgentId,    // 选中的 Agent ID
    selectedAgent,      // 选中的 Agent 对象
    init,               // 初始化方法
    refreshAgents,      // 刷新 Agent 状态
    startPolling,       // 开始轮询
    stopPolling,        // 停止轮询
    selectAgent,        // 选中 Agent
  }
})
