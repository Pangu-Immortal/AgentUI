/**
 * Agent 状态管理组合式函数（兼容层）
 *
 * 对 Pinia agentStore 的二次封装，提供组合式 API。
 * 新代码建议直接使用 useAgentStore()，此文件保留向后兼容。
 *
 * 函数列表：
 * - useAgentStoreComposable: 返回 store 的响应式引用和方法
 */
import { storeToRefs } from 'pinia'
import { useAgentStore } from '@/stores/agentStore'

/** 组合式函数：返回 Agent Store 的响应式属性和操作方法 */
export function useAgentStoreComposable() {
  const store = useAgentStore()                                           // 获取 store 实例
  const { agents, selectedAgent, selectedAgentId, officeConfig } = storeToRefs(store) // 保持响应性

  return {
    agents,              // 响应式 Agent 列表
    selectedAgent,       // 响应式选中 Agent
    selectedAgentId,     // 响应式选中 ID
    officeConfig,        // 响应式办公室配置
    selectAgent: store.selectAgent,       // 选中 Agent
    init: store.init,                     // 初始化
    refreshAgents: store.refreshAgents,   // 刷新 Agent 状态
    startPolling: store.startPolling,     // 开始轮询
    stopPolling: store.stopPolling,       // 停止轮询
  }
}
