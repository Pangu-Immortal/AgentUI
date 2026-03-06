<!--
  AgentCard.vue - Agent 信息卡片组件

  职责：
  - 展示单个 Agent 的基本信息（名称、状态、详情）
  - 根据 Agent 颜色显示边框
  - 状态文字中文映射
-->
<template>
  <!-- Agent 信息卡片，边框颜色取自 Agent 配置色，选中时高亮 -->
  <div
    v-if="agent"
    class="agent-card"
    :class="{ selected: isSelected }"
    :style="{ borderColor: agent.color }"
    @click="$emit('select', agent.id)"
  >
    <!-- Agent 名称 + 状态 emoji -->
    <div class="name">{{ stateIcon }} {{ agent.name }}</div>
    <!-- 当前状态（中文） -->
    <div class="state">{{ stateLabel }}</div>
    <!-- 状态详情描述 -->
    <div class="detail">{{ agent.detail || '待命中' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AgentRuntime } from '../types'

/** 组件 Props */
const props = defineProps<{
  agent: AgentRuntime | null       // Agent 数据
  isSelected?: boolean             // 是否被选中
}>()

/** 组件 Events */
defineEmits<{
  select: [id: string]            // 选中事件
}>()

/** 状态中文映射表 */
const stateMap: Record<string, string> = {
  idle: '休息中',         // 空闲状态
  writing: '编码中',      // 编码状态
  researching: '调研中',  // 调研状态
  executing: '执行中',    // 执行状态
  syncing: '同步中',      // 同步状态
  error: '异常',          // 错误状态
}

/** 状态 emoji 映射 */
const stateIconMap: Record<string, string> = {
  idle: '\u{1F4A4}',          // 💤
  writing: '\u{1F4BB}',      // 💻
  researching: '\u{1F50D}',  // 🔍
  executing: '\u26A1',       // ⚡
  syncing: '\u{1F504}',      // 🔄
  error: '\u274C',           // ❌
}

/** 计算当前状态的中文标签 */
const stateLabel = computed(() =>
  stateMap[props.agent?.state || 'idle'] || props.agent?.state
)

/** 计算状态图标 */
const stateIcon = computed(() =>
  stateIconMap[props.agent?.state || 'idle'] || ''
)
</script>

<style scoped>
.agent-card {
  background: #1a1a2e;                                /* 深色背景 */
  border: 2px solid;                                  /* 边框宽度，颜色由 style 绑定 */
  border-radius: 8px;                                 /* 圆角 */
  padding: 12px;                                      /* 内边距 */
  color: #e0e0e0;                                     /* 文字颜色 */
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; /* 中文字体 */
  cursor: pointer;                                    /* 鼠标指针 */
  transition: background 0.2s, box-shadow 0.2s;       /* 过渡动画 */
}

.agent-card:hover {
  background: #222240;                                /* 悬停高亮 */
}

.agent-card.selected {
  background: #2a2a50;                                /* 选中背景 */
  box-shadow: 0 0 8px rgba(255, 255, 0, 0.3);        /* 黄色发光 */
}

.name {
  font-size: 14px;       /* 名称字号 */
  font-weight: bold;     /* 加粗 */
  margin-bottom: 4px;    /* 底部间距 */
}

.state {
  font-size: 12px;       /* 状态字号 */
  margin-bottom: 4px;    /* 底部间距 */
}

.detail {
  font-size: 11px;       /* 详情字号 */
  color: #888;           /* 灰色文字 */
}
</style>
