<!--
  PixiCanvas.vue - PixiJS 画布容器组件

  职责：
  - 提供 PixiJS 渲染挂载点（div 容器）
  - 初始化 OfficeScene 并传入办公室配置
  - 监听 agentStore 变化，调用 scene.updateAgents()
  - 处理窗口 resize 事件
-->
<template>
  <!-- PixiJS 画布挂载容器 -->
  <div ref="containerRef" class="pixi-canvas"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAgentStore } from '../stores/agentStore'
import { OfficeScene } from '../game/OfficeScene'

const containerRef = ref<HTMLDivElement | null>(null)  // 容器 DOM 引用
const store = useAgentStore()                          // Agent 状态管理
let scene: OfficeScene | null = null                   // 场景实例
let sceneReady = false                                 // 场景是否初始化完成

onMounted(async () => {
  if (!containerRef.value) return // 容器未挂载则退出

  console.log('[PixiCanvas] 开始初始化...')
  await store.init()                                   // 初始化 Store（加载角色和办公室配置）

  scene = new OfficeScene()                            // 创建场景实例
  // 注册 Agent 点击回调：选中/取消选中
  scene.setOnAgentClick((id) => {
    const newId = store.selectedAgentId === id ? null : id // 再次点击取消选中
    store.selectAgent(newId)                            // 更新 Store 选中状态
    scene?.selectAgent(newId)                           // 更新场景高亮
  })
  await scene.init(containerRef.value, store.officeConfig!) // 传入容器和办公室配置
  sceneReady = true                                    // 标记场景已就绪

  scene.updateAgents(store.agents)                     // 初次渲染所有 Agent
  store.startPolling()                                 // 开始轮询 Agent 状态

  window.addEventListener('resize', handleResize)      // 监听窗口大小变化
  handleResize()                                       // 首次触发适配
  console.log('[PixiCanvas] 画布已挂载')
})

/** 监听 agents 数据变化，同步更新场景中的 Agent 精灵 */
watch(() => store.agents, (newAgents) => {
  if (sceneReady && scene) {
    scene.updateAgents(newAgents)                      // 将最新数据传给场景
  }
}, { deep: true })

/** 监听选中 Agent 变化（来自侧边栏卡片点击），同步场景高亮 */
watch(() => store.selectedAgentId, (newId) => {
  if (sceneReady && scene) {
    scene.selectAgent(newId)                           // 同步场景选中状态
  }
})

/** 处理窗口大小变化 */
function handleResize() {
  const parent = containerRef.value
  if (parent && sceneReady && scene) {
    scene.resize(parent.clientWidth, parent.clientHeight)
  }
}

onUnmounted(() => {
  store.stopPolling()                                  // 停止轮询
  scene?.destroy()                                     // 销毁场景
  sceneReady = false                                   // 重置标记
  window.removeEventListener('resize', handleResize)   // 移除监听
  console.log('[PixiCanvas] 画布已卸载')
})
</script>

<style scoped>
.pixi-canvas {
  width: 100%;      /* 撑满父容器宽度 */
  height: 100%;     /* 撑满父容器高度 */
  overflow: hidden; /* 隐藏溢出内容 */
}

/* PixiJS 生成的 canvas 默认 display:inline 会产生底部空白 */
.pixi-canvas :deep(canvas) {
  display: block;   /* 消除 inline 元素底部空白 */
}
</style>
