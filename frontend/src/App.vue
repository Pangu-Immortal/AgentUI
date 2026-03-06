<!--
  App.vue - 应用根组件

  职责：
  - 提供 router-view 路由出口
  - 定义全局样式重置
-->
<template>
  <!-- 路由视图出口 -->
  <router-view />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;           /* 清除外边距 */
  padding: 0;          /* 清除内边距 */
  box-sizing: border-box; /* 盒模型统一 */
}

html, body {
  width: 100%;         /* 全屏宽 */
  height: 100%;        /* 全屏高 */
  overflow: hidden;    /* 禁止滚动 */
  background: #0f0f23; /* 深色背景 */
}

#app {
  width: 100%;         /* 应用容器全屏宽 */
  height: 100%;        /* 应用容器全屏高 */
}
</style>
