/**
 * 应用入口文件
 *
 * 初始化：
 * - Vue 应用实例
 * - Pinia 状态管理
 * - Vue Router 路由
 * - 挂载到 #app
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

const app = createApp(App)   // 创建 Vue 应用

app.use(createPinia())        // 注册 Pinia 状态管理
app.use(router)               // 注册路由

app.mount('#app')             // 挂载到 DOM

console.log('[AgentUI] 应用启动完成')
