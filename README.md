# AgentUI — 小舒舒办公室

## 项目概览

小舒舒办公室是一个 AI Agent 像素风格办公室实时看板，基于 [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI)（2.2K star）深度重构而来。

**做什么：**
- 以像素风格办公室的形式，实时展示 9 个 AI Agent 的工作状态
- 支持 4 大功能区（休息区 / 工作区 / 会议区 / Bug 角落），每个 Agent 拥有独立像素小人、中文名和状态气泡
- 提供 31+ REST API，支持状态推送、Agent 加入/离开等操作

**不做什么：**
- 不包含 AI 推理能力，仅负责状态展示和可视化
- 不使用 WebSocket，采用 HTTP 轮询（2.5s 间隔）实现近实时更新

---

## 架构设计

### 双层渲染架构

```
┌─────────────────────────────────────────────┐
│                Vue3 UI 层                    │
│   StatusBar / AgentCard / 交互组件            │
├─────────────────────────────────────────────┤
│              PixiJS 8 渲染层                  │
│   OfficeScene / AgentSprite / OfficeMap      │
└─────────────────────────────────────────────┘
```

- **Vue3 UI 层**：负责状态栏（StatusBar）、Agent 信息卡片（AgentCard）等 DOM 层交互组件
- **PixiJS 8 渲染层**：负责像素办公室场景渲染，包括地图区域、工位、墙壁和像素小人

### 数据流

```
HTTP 轮询 (2.5s) → API 服务层 → Pinia Store → PixiJS Scene（单向数据流）
```

- 状态驱动：Pinia store 作为唯一数据源，单向驱动 PixiJS 场景更新
- HTTP 轮询：前端每 2.5 秒向后端拉取最新状态，无 WebSocket 依赖

### 功能区划分

| 区域 | 说明 |
|------|------|
| 休息区 | Agent 空闲/待命时所在区域 |
| 工作区 | 3x3 九宫格工位布局，Agent 工作时所在区域 |
| 会议区 | Agent 协作/讨论时所在区域 |
| Bug 角落 | Agent 处理 Bug 时所在区域 |

### 设计决策

- 选用 PixiJS 8 而非 Canvas 2D，保证大量精灵渲染的性能
- Flask 作为轻量后端，JSON 文件存储，适合小规模部署
- 纯代码绘制像素小人，无需额外美术资源

---

## 工程结构

```
AgentUI/
├── backend/                # Flask 后端服务
│   ├── app.py              # 主服务入口（31+ REST API）
│   ├── store_utils.py      # JSON 文件存储工具
│   ├── security_utils.py   # 安全工具
│   └── memo_utils.py       # 备忘录工具
├── frontend/               # Vue3 + PixiJS 前端
│   └── src/
│       ├── game/            # PixiJS 渲染引擎
│       │   ├── Camera.ts        # 视口拖拽/缩放控制
│       │   ├── OfficeMap.ts     # 地图渲染（区域/工位/墙壁）
│       │   ├── AgentSprite.ts   # 像素小人精灵
│       │   └── OfficeScene.ts   # 场景管理器
│       ├── components/      # Vue 组件
│       │   ├── PixiCanvas.vue   # PixiJS 画布容器
│       │   ├── StatusBar.vue    # 顶部状态栏
│       │   └── AgentCard.vue    # Agent 信息卡片
│       ├── stores/          # Pinia 状态管理
│       ├── services/        # API 服务层
│       ├── types/           # TypeScript 类型定义
│       └── views/           # 页面视图
├── set_state.py             # 状态切换脚本
├── join-keys.json           # Agent 加入密钥
├── pyproject.toml           # Python 项目配置（uv）
└── README.md                # 本文件
```

---

## 运行环境

| 项目 | 要求 |
|------|------|
| Node.js | >= 18 |
| Python | >= 3.10 |
| 操作系统 | macOS / Linux |
| Python 包管理 | 推荐 uv |
| Node.js 包管理 | npm |

### 技术栈版本

| 技术 | 版本 |
|------|------|
| Vue | 3.5 |
| PixiJS | 8 |
| Pinia | 3 |
| Vue Router | 4 |
| Vite | 7 |
| TypeScript | 最新 |
| Sass | 最新 |
| Axios | 最新 |
| Flask | 3.0 |

---

## 从零搭建指南

本指南面向初次接触本工程的开发者，按步骤操作即可完成环境搭建。

### 1. 环境准备

```bash
# 检查 Node.js 版本（需 >= 18）
node -v

# 检查 Python 版本（需 >= 3.10）
python3 --version

# 安装 uv（如未安装）
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. 克隆项目

```bash
git clone <仓库地址>
cd AgentUI
```

### 3. 安装后端依赖

```bash
uv sync
```

### 4. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 5. 启动服务

需要两个终端窗口：

**终端 1 — 启动后端（端口 19000）：**

```bash
cd AgentUI
uv run python backend/app.py
```

**终端 2 — 启动前端（端口 5173）：**

```bash
cd AgentUI/frontend
npm run dev
```

### 6. 访问页面

浏览器打开 [http://localhost:5173](http://localhost:5173)

---

## 快速启动

```bash
# 一键安装依赖
cd AgentUI && uv sync
cd frontend && npm install && cd ..

# 启动后端（端口 19000）
uv run python backend/app.py

# 新终端，启动前端（端口 5173）
cd frontend && npm run dev

# 浏览器打开 http://localhost:5173
```

### 状态切换

```bash
# 切换为 writing 状态
python3 set_state.py writing "正在编码"

# 切换为 idle 状态
python3 set_state.py idle "待命中"
```

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| 端口 19000 被占用 | 检查是否有其他 Flask 实例运行，`lsof -i :19000` 查看占用进程 |
| 前端无法连接后端 | 确认后端已启动且监听 19000 端口，检查 CORS 配置 |
| npm install 失败 | 删除 `node_modules` 和 `package-lock.json` 后重试 |
| uv sync 失败 | 确认 Python >= 3.10，尝试 `uv sync --reinstall` |

---

## 核心流程列表

### 主流程：Agent 状态实时展示

1. 后端接收 Agent 状态推送（`/agent-push`）
2. 前端每 2.5 秒轮询后端（`/agents`）获取最新状态
3. Pinia Store 更新状态数据
4. PixiJS 场景根据状态驱动像素小人位置、动画和气泡文字

### 关键分支

- **Agent 加入**：通过 `/join-agent` 接口携带密钥加入，密钥存储在 `join-keys.json`
- **Agent 离开**：通过 `/leave-agent` 接口退出办公室
- **状态切换**：通过 `set_state.py` 脚本或 `/set_state` 接口切换 Agent 状态
- **角色点击交互**：点击地图上的像素小人或右侧卡片，双向联动高亮选中

### 9 个 Agent 角色

| AgentId | 中文名 | 角色 | 代表颜色 |
|---------|--------|------|----------|
| main | 小浩仔 | 主控 | #e74c3c |
| android-dev | 安卓仔 | Android 开发 | #2ecc71 |
| ios-dev | 苹果仔 | iOS 开发 | #ecf0f1 |
| web-dev | 前端仔 | Web 开发 | #e67e22 |
| backend-dev | 后端仔 | 后端开发 | #2c3e50 |
| qa-lead | 测试仔 | 测试负责人 | #f1c40f |
| devops | 运维仔 | DevOps | #95a5a6 |
| ui-designer | 设计仔 | UI 设计 | #e91e8a |
| pm | 产品仔 | 产品经理 | #3498db |

### 核心 API

| 路由 | 方法 | 说明 |
|------|------|------|
| /health | GET | 健康检查 |
| /status | GET | 主状态查询 |
| /agents | GET | 全部 Agent 状态 |
| /agent-roles | GET | Agent 角色配置 |
| /office-config | GET | 办公室布局配置 |
| /set_state | POST | 设置 Agent 状态 |
| /join-agent | POST | Agent 加入办公室 |
| /agent-push | POST | Agent 推送状态更新 |
| /leave-agent | POST | Agent 离开办公室 |

---

## 技术债与风险

| 位置 | 成因 | 风险等级 | 处理建议 |
|------|------|---------|----------|
| backend/store_utils.py | JSON 文件存储，无并发锁 | 中 | 高并发场景下可能数据竞争，建议迁移至 SQLite 或 Redis |
| frontend/src/game/AgentSprite.ts | 纯代码绘制像素小人 | 低 | 未来可替换为精灵图（Spritesheet）提升渲染效率和视觉效果 |
| 原版 game.js | 原版死代码，已在重构中移除 | 无 | 已处理，无需额外操作 |
| HTTP 轮询机制 | 2.5s 间隔轮询，非实时 | 低 | 如需更高实时性，可升级为 WebSocket |

---

## 开源依赖

| 库名 | 用途 | 开源地址 |
|------|------|----------|
| PixiJS 8 | 2D WebGL 渲染引擎 | https://github.com/pixijs/pixijs |
| Vue 3 | 响应式 UI 框架 | https://github.com/vuejs/core |
| Pinia | Vue 状态管理 | https://github.com/vuejs/pinia |
| Vue Router | Vue 路由管理 | https://github.com/vuejs/router |
| Vite | 前端构建工具 | https://github.com/vitejs/vite |
| Flask | Python Web 框架 | https://github.com/pallets/flask |
| Axios | HTTP 客户端 | https://github.com/axios/axios |
| Sass | CSS 预处理器 | https://github.com/sass/sass |
| Star-Office-UI | 原版像素办公室（本项目基于此深度重构） | https://github.com/ringhyacinth/Star-Office-UI |
