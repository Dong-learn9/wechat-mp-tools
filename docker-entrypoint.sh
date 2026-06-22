#!/bin/sh
# Docker 容器入口脚本
# 启动 Xvfb 虚拟显示 + x11vnc + noVNC，使扫码登录浏览器可通过 Web 远程查看

set -e

# 默认环境变量
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-5200}"
export NO_BROWSER="${NO_BROWSER:-1}"
export PYTHONUNBUFFERED="${PYTHONUNBUFFERED:-1}"
export DISPLAY="${DISPLAY:-:99}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

# ── 启动 Xvfb 虚拟帧缓冲（扫码登录浏览器需要非 headless 模式）──
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
sleep 1
if kill -0 $XVFB_PID 2>/dev/null; then
    echo "[entrypoint] Xvfb started (PID=$XVFB_PID, DISPLAY=$DISPLAY, 1920x1080)"
else
    echo "[entrypoint] WARNING: Xvfb failed to start" >&2
fi

# ── 启动 x11vnc（将 Xvfb 显示通过 VNC 协议输出，强制使用 5900 端口）──
# -rfbport 5900: 强制使用 5900 端口（避免 x11vnc 自动选择 5901）
# -forever: 持续运行，不退出
# -nopw: 无密码
# -shared: 允许多个客户端连接
x11vnc -display :99 -rfbport 5900 -forever -nopw -shared -o /tmp/x11vnc.log >/tmp/x11vnc-stdout.log 2>&1 &
X11VNC_PID=$!
sleep 2
if kill -0 $X11VNC_PID 2>/dev/null; then
    echo "[entrypoint] x11vnc started (PID=$X11VNC_PID, VNC port 5900)"
else
    echo "[entrypoint] WARNING: x11vnc failed to start, check /tmp/x11vnc.log" >&2
    cat /tmp/x11vnc.log 2>/dev/null | tail -5 >&2
fi

# ── 启动 noVNC（通过浏览器访问容器内桌面，用于扫码登录）──
NOVNC_WEB="/usr/share/novnc"
if [ ! -d "$NOVNC_WEB" ]; then
    NOVNC_WEB="/usr/share/websockify"
fi
websockify --web "$NOVNC_WEB" "$NOVNC_PORT" localhost:5900 >/tmp/novnc.log 2>&1 &
NOVNC_PID=$!
sleep 1
if kill -0 $NOVNC_PID 2>/dev/null; then
    echo "[entrypoint] noVNC started (http://0.0.0.0:${NOVNC_PORT}/vnc.html)"
else
    echo "[entrypoint] WARNING: noVNC failed to start" >&2
    cat /tmp/novnc.log 2>/dev/null | tail -5 >&2
fi

# ── 优雅退出：转发信号给子进程 ──
cleanup() {
    echo "[entrypoint] Stopping services..."
    kill $NOVNC_PID $X11VNC_PID $XVFB_PID 2>/dev/null || true
    pkill -f "x11vnc" 2>/dev/null || true
    pkill -f "websockify" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[entrypoint] Flask service: http://${HOST}:${PORT}"
echo "[entrypoint] Scan login desktop: http://localhost:${NOVNC_PORT}/vnc.html"
exec python app.py --host "$HOST" --port "$PORT" --no-browser
