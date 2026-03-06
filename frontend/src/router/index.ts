/**
 * Vue Router 路由配置
 *
 * 路由表：
 * - /: 主页（办公室场景）
 */
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'), // 办公室主场景
  },
]

const router = createRouter({
  history: createWebHistory(), // HTML5 History 模式
  routes,
})

export default router
