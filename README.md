# AgentUI — 小舒舒办公室

AI Agent 像素风格办公室实时看板，9 个 AI Agent 在像素办公室中实时展示工作状态。

> 基于 [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI)（2.2K star）深度重构

![Vue3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![PixiJS](https://img.shields.io/badge/PixiJS-8-E91E63?logo=pixijs)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

## 项目概览

**做什么：**
- 以像素风格办公室实时展示 9 个 AI Agent 的工作状态
- 4 大功能区（休息区 / 工作区 / 会议区 / Bug 角落）
- 每个 Agent 拥有独立像素小人、中文名和状态气泡
- 点击角色 / 卡片双向联动高亮
- 支持拖拽平移、滚轮缩放、触摸屏双指缩放

**不做什么：**
- 不包含 AI 推理能力，仅负责状态展示
- 不需要任何 API Key 即可运行（Gemini 生图为可选功能）

## 快速启动

### 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | >= 18 |
| Python | >= 3.10 |
| 包管理 | 推荐 [uv](https://github.com/astral-sh/uv)（可选，也支持 pip） |

### 一键启动

```bash
git clone https://github.com/Pangu-Immortal/AgentUI.git
cd AgentUI
chmod +x start.sh
./start.sh
```

浏览器打开 **http://localhost:5173** 即可看到办公室。

### 手动启动

如果一键脚本不适用，可以手动分步启动：

```bash
# 1. 安装后端依赖
uv sync                    # 或 pip install flask

# 2. 安装前端依赖
cd frontend && npm install && cd ..

# 3. 启动后端（终端 1）
uv run python backend/app.py

# 4. 启动前端（终端 2）
cd frontend && npm run dev
```

> 后端默认监听 `127.0.0.1:19000`，前端 Vite 代理自动转发 API 请求。

### 状态切换测试

```bash
# 切换主 Agent 为编码状态
python3 set_state.py writing "正在编码新功能"

# 切换为休息状态
python3 set_state.py idle "待命中"
```

## 架构设计

```
┌─────────────────────────────────────────────┐
│           Vue3 UI 层（DOM）                   │
│   StatusBar / AgentCard / 交互组件            │
├─────────────────────────────────────────────┤
│         PixiJS 8 渲染层（Canvas）              │
│   OfficeScene / AgentSprite / OfficeMap      │
├─────────────────────────────────────────────┤
│         Pinia Store（状态中心）                │
│   agentStore → 单向驱动两层 UI               │
├─────────────────────────────────────────────┤
│         HTTP 轮询 2.5s                       │
│   Axios → Flask REST API :19000             │
└─────────────────────────────────────────────┘
```

- **Vue3 UI 层**：状态栏、Agent 信息卡片等 DOM 组件
- **PixiJS 8 渲染层**：像素办公室场景（地图、小人、动画）
- **Pinia Store**：唯一数据源，单向驱动两层 UI 更新
- **HTTP 轮询**：每 2.5 秒拉取后端状态，无 WebSocket 依赖

## 工程结构

```
AgentUI/
├── backend/                    # Flask 后端服务
│   ├── app.py                  # 主服务入口（31+ REST API）
│   ├── store_utils.py          # JSON 文件存储工具
│   ├── security_utils.py       # 安全工具（开发/生产模式）
│   └── memo_utils.py           # 备忘录工具
├── frontend/                   # Vue3 + PixiJS 前端
│   └── src/
│       ├── game/               # PixiJS 渲染引擎
│       │   ├── OfficeScene.ts  # 场景管理器（初始化/更新/销毁）
│       │   ├── AgentSprite.ts  # 像素小人（纯代码绘制+动画+交互）
│       │   ├── OfficeMap.ts    # 地图渲染（区域/工位/墙壁）
│       │   └── Camera.ts       # 视口控制（拖拽/缩放/边界）
│       ├── components/         # Vue 组件
│       │   ├── PixiCanvas.vue  # PixiJS 画布容器
│       │   ├── StatusBar.vue   # 顶部状态栏
│       │   └── AgentCard.vue   # Agent 信息卡片（点击联动）
│       ├── stores/             # Pinia 状态管理
│       ├── services/           # API 服务层
│       ├── types/              # TypeScript 类型定义
│       └── views/              # 页面视图
├── start.sh                    # 一键启动脚本
├── set_state.py                # Agent 状态切换工具
├── join-keys.json              # Agent 接入标识（9 个 Agent）
├── state.sample.json           # 状态文件模板
└── pyproject.toml              # Python 项目配置
```

## 9 个 Agent 角色

| AgentId | 中文名 | 角色 | 代表颜色 | 工位 |
|---------|--------|------|---------|------|
| main | 小浩仔 | 主控 | #e74c3c | 0 |
| android-dev | 安卓仔 | Android 开发 | #2ecc71 | 1 |
| ios-dev | 苹果仔 | iOS 开发 | #ecf0f1 | 2 |
| web-dev | 前端仔 | Web 开发 | #e67e22 | 3 |
| backend-dev | 后端仔 | 后端开发 | #2c3e50 | 4 |
| qa-lead | 测试仔 | 测试负责人 | #f1c40f | 5 |
| devops | 运维仔 | DevOps | #95a5a6 | 6 |
| ui-designer | 设计仔 | UI 设计 | #e91e8a | 7 |
| pm | 产品仔 | 产品经理 | #3498db | 8 |

## 功能区划分

```
┌──────────────────────────────────────────────────────────┐
│                    小舒舒办公室                              │
│  ┌──────────┐   ┌────────────────────────┐   ┌────────┐ │
│  │          │   │    工作区（3x3 九宫格）    │   │ Bug   │ │
│  │  休息区   │   │ [0][1][2]              │   │ 角落   │ │
│  │          │   │ [3][4][5]              │   │       │ │
│  │          │   │ [6][7][8]              │   │       │ │
│  └──────────┘   └────────────────────────┘   └────────┘ │
│                    ┌──────────────────┐                   │
│                    │     会议区        │                   │
│                    └──────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

| 区域 | Agent 状态 | 说明 |
|------|-----------|------|
| 休息区 | `idle` | Agent 空闲/待命 |
| 工作区 | `writing` / `researching` / `executing` / `syncing` | Agent 在自己工位工作 |
| Bug 角落 | `error` | Agent 遇到异常 |

## 核心 API

| 路由 | 方法 | 说明 | 需要认证 |
|------|------|------|--------|
| `/health` | GET | 健康检查 | 否 |
| `/status` | GET | 主状态查询 | 否 |
| `/agents` | GET | 全部 Agent 状态 | 否 |
| `/agent-roles` | GET | Agent 角色配置 | 否 |
| `/office-config` | GET | 办公室布局配置 | 否 |
| `/set_state` | POST | 设置 Agent 状态 | 否 |
| `/join-agent` | POST | Agent 加入办公室 | 需 joinKey |
| `/agent-push` | POST | Agent 推送状态 | 需 joinKey |
| `/leave-agent` | POST | Agent 离开办公室 | 否 |

## 环境变量（全部可选）

项目零配置即可运行。以下环境变量仅在需要定制时使用：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `STAR_BACKEND_PORT` | `19000` | 后端监听端口 |
| `BIND_HOST` | `127.0.0.1` | 绑定地址（设为 `0.0.0.0` 允许外网访问） |
| `ASSET_DRAWER_PASS` | 随机生成 | 素材编辑器密码（`start.sh` 默认设为 `demo`） |
| `GEMINI_API_KEY` | 空 | Gemini API Key（仅 RPG 背景生图功能需要） |
| `FLASK_SECRET_KEY` | 随机生成 | Flask Session 密钥（仅生产环境需要固定值） |
| `STAR_OFFICE_ENV` | 空 | 设为 `production` 启用安全强制检查 |

## 常见问题

| 问题 | 解决方案 |
|------|--------|
| 端口 19000 被占用 | `lsof -i :19000` 查看占用进程，或设置 `STAR_BACKEND_PORT=3009` |
| 前端无法连接后端 | 确认后端已启动且监听 19000 端口 |
| npm install 失败 | 删除 `node_modules` 和 `package-lock.json` 后重试 |
| uv 未安装 | `curl -LsSf https://astral.sh/uv/install.sh | sh` 或直接用 `pip install flask` |
| 素材编辑需要密码 | 启动时设置 `ASSET_DRAWER_PASS=你的密码`，或使用 `start.sh`（默认 `demo`） |

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Vue 3](https://github.com/vuejs/core) | 3.5 | 响应式 UI 框架 |
| [PixiJS](https://github.com/pixijs/pixijs) | 8 | 2D WebGL 渲染引擎 |
| [Pinia](https://github.com/vuejs/pinia) | 3 | Vue 状态管理 |
| [Vite](https://github.com/vitejs/vite) | 7 | 前端构建工具 |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5 | 类型安全 |
| [Flask](https://github.com/pallets/flask) | 3.0 | Python Web 框架 |
| [Axios](https://github.com/axios/axios) | 最新 | HTTP 客户端 |
| [Vue Router](https://github.com/vuejs/router) | 4 | Vue 路由管理 |
| [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) | - | 原版像素办公室（本项目基于此重构） |

## License

MIT
