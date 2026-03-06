/**
 * 办公室逻辑组合式函数（兼容层）
 *
 * 封装办公室场景相关的状态与操作。
 * 新代码建议直接使用 useAgentStore().officeConfig，此文件保留向后兼容。
 *
 * 函数列表：
 * - useOffice: 返回办公室配置和加载状态
 */
import { ref, computed } from 'vue'
import { useAgentStore } from '@/stores/agentStore'
import type { OfficeConfig } from '@/types'

/** 组合式函数：办公室配置和操作 */
export function useOffice() {
  const store = useAgentStore()                                    // 获取 store 实例
  const isLoading = ref(false)                                     // 加载状态

  /** 办公室配置（从 store 获取） */
  const officeConfig = computed<OfficeConfig | null>(() => store.officeConfig)

  /** 初始化办公室配置（委托给 store.init） */
  async function initOffice(): Promise<void> {
    isLoading.value = true                                         // 开始加载
    try {
      await store.init()                                           // 委托初始化
    } finally {
      isLoading.value = false                                      // 加载结束
    }
  }

  return {
    officeConfig,   // 响应式办公室配置
    isLoading,      // 加载状态
    initOffice,     // 初始化方法
  }
}
