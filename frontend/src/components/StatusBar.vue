<!--
  StatusBar.vue - 顶部状态栏组件

  职责：
  - 显示办公室名称（来自 officeConfig）
  - 显示在线 Agent 数量统计
  - 显示当前时间
-->
<template>
  <!-- 顶部状态栏 -->
  <div class="status-bar">
    <!-- 左侧：办公室名称 -->
    <div class="office-name">{{ store.officeConfig?.office_name || '加载中...' }}</div>
    <!-- 右侧：在线状态和时间 -->
    <div class="status-info">
      <span class="agent-count">
        <span class="online">{{ onlineCount }}</span> 在线 /
        <span class="total">{{ store.agents.length }}</span> 总计
      </span>
      <span class="current-time">{{ currentTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAgentStore } from '../stores/agentStore'

const store = useAgentStore()                         // Agent 状态管理
const currentTime = ref('')                           // 当前时间字符串
let timer: ReturnType<typeof setInterval> | null = null // 时间更新定时器

/** 计算在线 Agent 数量（状态不为 idle 的 Agent） */
const onlineCount = computed(() =>
  store.agents.filter(a => a.state !== 'idle').length
)

/** 更新时间显示 */
function updateTime(): void {
  currentTime.value = new Date().toLocaleTimeString('zh-CN') // 中文格式时间
}

onMounted(() => {
  updateTime()                             // 首次更新
  timer = setInterval(updateTime, 1000)    // 每秒刷新
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer) // 清理定时器，防止内存泄漏
})
</script>

<style scoped>
.status-bar {
  height: 40px;                                       /* 状态栏高度 */
  background: #16213e;                                /* 深蓝背景 */
  display: flex;                                      /* 水平布局 */
  align-items: center;                                /* 垂直居中 */
  justify-content: space-between;                     /* 两端对齐 */
  padding: 0 20px;                                    /* 左右内边距 */
  color: #e0e0e0;                                     /* 默认文字颜色 */
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; /* 中文字体 */
  border-bottom: 1px solid #2a2a4a;                   /* 底部分割线 */
  flex-shrink: 0;                                     /* 不被压缩 */
}

.office-name {
  font-size: 16px;     /* 标题字号 */
  font-weight: bold;   /* 加粗 */
}

.status-info {
  display: flex;       /* 水平布局 */
  gap: 16px;           /* 元素间距 */
  font-size: 13px;     /* 信息字号 */
}

.online { color: #2ecc71; } /* 在线数量：绿色 */
.total { color: #95a5a6; }  /* 总数：灰色 */

.current-time {
  color: #7f8c8d;      /* 时间：浅灰 */
}
</style>
