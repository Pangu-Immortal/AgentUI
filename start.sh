#!/bin/bash
# AgentUI 一键启动脚本
# 同时启动后端（Flask :19000）和前端（Vite :5173）

set -e

# 项目根目录
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  AgentUI - 小舒舒办公室"
echo "=========================================="

# 检查 Python
if ! command -v python3 &>/dev/null; then
    echo "[错误] 未找到 python3，请先安装 Python >= 3.10"
    exit 1
fi

# 检查 Node.js
if ! command -v node &>/dev/null; then
    echo "[错误] 未找到 node，请先安装 Node.js >= 18"
    exit 1
fi

# 安装后端依赖
echo "[1/4] 安装后端依赖..."
if command -v uv &>/dev/null; then
    cd "$ROOT_DIR" && uv sync --quiet
else
    echo "  (未找到 uv，使用 pip 安装)"
    pip install flask Pillow --quiet 2>/dev/null || pip3 install flask Pillow --quiet
fi

# 安装前端依赖
echo "[2/4] 安装前端依赖..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent
else
    echo "  (node_modules 已存在，跳过)"
fi

# 启动后端
echo "[3/4] 启动后端服务 (端口 19000)..."
cd "$ROOT_DIR"
ASSET_DRAWER_PASS=demo uv run python backend/app.py &
BACKEND_PID=$!

# 等待后端就绪
sleep 2

# 启动前端
echo "[4/4] 启动前端服务 (端口 5173)..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "  启动完成！"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:19000"
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="

# 捕获退出信号，同时停止前后端
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# 等待子进程
wait
