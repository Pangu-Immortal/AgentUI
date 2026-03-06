/**
 * Vite 构建配置
 *
 * - 配置 Vue 插件
 * - 配置路径别名 @ -> src
 * - 配置开发服务器代理，逐路径转发到后端 localhost:19000
 *   后端 API 不带 /api 前缀，直接使用原始路径
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/** 后端服务地址 */
const BACKEND_TARGET = 'http://localhost:19000'

/** 需要代理到后端的路由路径列表 */
const proxyPaths = [
  '/status',          // 主状态接口
  '/agents',          // Agent 状态列表
  '/health',          // 健康检查
  '/agent-roles',     // 角色配置
  '/office-config',   // 办公室布局配置
  '/set_state',       // 状态设置
  '/agent-push',      // Agent 推送
  '/join-agent',      // 加入 Agent
  '/leave-agent',     // 离开 Agent
  '/assets',          // 静态资源
  '/yesterday-memo',  // 昨日备忘
]

/** 批量生成 proxy 配置 */
const proxy: Record<string, { target: string; changeOrigin: boolean }> = {}
for (const path of proxyPaths) {
  proxy[path] = { target: BACKEND_TARGET, changeOrigin: true }
}

export default defineConfig({
  plugins: [vue()],       // Vue 插件
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), // 路径别名：@ 指向 src 目录
    },
  },
  server: {
    port: 5173,           // 前端开发服务器端口
    proxy,                // 代理配置
  },
})
