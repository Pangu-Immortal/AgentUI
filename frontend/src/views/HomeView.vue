<!--
  HomeView.vue - 首页视图（办公室主场景）

  布局结构：
  - StatusBar: 顶部状态栏（办公室名称 + 在线统计）
  - PixiCanvas: 中央 PixiJS 画布（办公室场景）
  - AgentCard 列表: 右侧 Agent 信息面板
-->
<template>
  <div class="home-view">
    <!-- 顶部状态栏 -->
    <StatusBar />
    <!-- 主内容区域 -->
    <div class="main-area">
      <!-- 左侧：PixiJS 办公室画布 -->
      <div class="office-container">
        <PixiCanvas />
      </div>
      <!-- 右侧：Agent 信息面板 -->
      <aside class="sidebar">
        <AgentCard
          v-for="agent in store.agents"
          :key="agent.id"
          :agent="agent"
          :is-selected="store.selectedAgentId === agent.id"
          @select="handleSelectAgent"
        />
        <!-- 空状态提示 -->
        <div v-if="store.agents.length === 0" class="empty-hint">
          暂无 Agent
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBar from '@/components/StatusBar.vue'
import PixiCanvas from '@/components/PixiCanvas.vue'
import AgentCard from '@/components/AgentCard.vue'
import { useAgentStore } from '@/stores/agentStore'

const store = useAgentStore() // Agent 状态管理

/** 处理 Agent 卡片点击选中（需通过事件总线通知 PixiJS 高亮） */
function handleSelectAgent(id: string) {
  const newId = store.selectedAgentId === id ? null : id // 再次点击取消选中
  store.selectAgent(newId)                               // 更新 Store 选中状态
}
</script>

<style scoped>
.home-view {
  width: 100vw;                /* 视口宽度 */
  height: 100vh;               /* 视口高度 */
  display: flex;               /* 弹性布局 */
  flex-direction: column;      /* 垂直排列 */
  overflow: hidden;            /* 隐藏溢出 */
  background: #0f0f23;         /* 深色背景 */
}

.main-area {
  flex: 1;                     /* 占满剩余空间 */
  display: flex;               /* 水平布局 */
  overflow: hidden;            /* 隐藏溢出 */
}

.office-container {
  flex: 1;                     /* 画布区域占满剩余宽度 */
  overflow: hidden;            /* 隐藏溢出 */
  position: relative;          /* 定位上下文 */
}

.sidebar {
  width: 240px;                /* 侧边栏宽度 */
  padding: 12px;               /* 内边距 */
  overflow-y: auto;            /* 垂直滚动 */
  background: #16213e;         /* 深蓝背景 */
  border-left: 1px solid #2a2a4a; /* 左侧分割线 */
  display: flex;               /* 弹性布局 */
  flex-direction: column;      /* 垂直排列 */
  gap: 8px;                    /* 卡片间距 */
}

.empty-hint {
  text-align: center;          /* 文字居中 */
  color: #666;                 /* 灰色文字 */
  padding: 40px 0;             /* 上下内边距 */
  font-size: 14px;             /* 字号 */
}
</style>
