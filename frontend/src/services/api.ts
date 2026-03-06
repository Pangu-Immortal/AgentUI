/**
 * API 服务层 - HTTP 请求封装
 *
 * 所有后端接口请求的统一出口，通过 Vite proxy 代理到 localhost:19000。
 * 后端 API 不带 /api 前缀，直接使用路径（如 /status、/agents）。
 *
 * 函数列表：
 * - fetchOfficeConfig: 获取办公室布局配置
 * - fetchAgentRoles: 获取 Agent 角色配置（9 个角色）
 * - fetchAgents: 获取所有 Agent 运行时状态
 * - fetchStatus: 获取主状态信息
 * - healthCheck: 健康检查
 * - setAgentState: 设置 Agent 状态
 */
import axios from 'axios'
import type { AxiosInstance } from 'axios'

/** 创建 Axios 实例，baseURL 为空，所有请求通过 Vite proxy 转发 */
const apiClient: AxiosInstance = axios.create({
  baseURL: '',        // 不设前缀，由 Vite proxy 逐路径代理
  timeout: 10000,     // 请求超时 10 秒
  headers: {
    'Content-Type': 'application/json', // 默认 JSON 格式
  },
})

// ==================== 响应拦截器 ====================
apiClient.interceptors.response.use(
  (response) => response, // 直接返回，由调用方取 data
  (error) => {
    console.error('[API 错误]', error.message) // 统一错误日志
    return Promise.reject(error)
  },
)

/**
 * 获取办公室布局配置
 * GET /office-config
 * 返回：办公室名称、地图尺寸、区域、工位、轮询间隔等
 */
export async function fetchOfficeConfig() {
  const { data } = await apiClient.get('/office-config') // 办公室配置接口
  return data
}

/**
 * 获取 Agent 角色配置
 * GET /agent-roles
 * 返回：9 个角色的名称、角色描述、颜色、工位索引
 */
export async function fetchAgentRoles() {
  const { data } = await apiClient.get('/agent-roles') // 角色配置接口
  return data
}

/**
 * 获取所有 Agent 运行时状态
 * GET /agents
 * 返回：Agent 列表数组，包含 agent_id、state、detail 等
 */
export async function fetchAgents() {
  const { data } = await apiClient.get('/agents') // Agent 状态列表接口
  return data
}

/**
 * 获取主状态信息
 * GET /status
 * 返回：{ state, detail, progress, updated_at }
 */
export async function fetchStatus() {
  const { data } = await apiClient.get('/status') // 主状态接口
  return data
}

/**
 * 健康检查
 * GET /health
 * 返回：后端健康状态
 */
export async function healthCheck() {
  const { data } = await apiClient.get('/health') // 健康检查接口
  return data
}

/**
 * 设置 Agent 状态
 * POST /set_state
 * @param state - 目标状态
 * @param detail - 状态详情描述
 */
export async function setAgentState(state: string, detail: string) {
  const { data } = await apiClient.post('/set_state', { state, detail }) // 状态设置接口
  return data
}

export default apiClient
