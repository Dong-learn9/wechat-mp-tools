# Dockerfile for WeChat MP Tools (Web 模式)
# 基于 python:3.11-slim，内置 ffmpeg + Playwright Chromium + Xvfb
# 支持扫码登录（通过 Xvfb 虚拟显示运行非 headless 浏览器）

FROM python:3.11-slim

# ── 切换为国内镜像源（阿里云）加速 apt 下载 ───────────────
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null \
    || sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null \
    || true

# ── 系统依赖 ──────────────────────────────────────────────
# ffmpeg/ffprobe: 视频转码
# xvfb + xauth: 虚拟显示，让 Playwright headless=False 可在容器内运行
# x11vnc + novnc + websockify: 通过浏览器远程查看容器内桌面，解决扫码登录问题
# fonts-noto-cjk: 中文字体，避免页面/截图乱码
# fonts-noto-color-emoji: emoji 渲染
# ca-certificates curl: HTTPS 与下载
# Playwright Chromium 运行所需的共享库（libnss3, libatk1.0, libxkbcommon0 等）
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    xvfb \
    xauth \
    x11vnc \
    novnc \
    websockify \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── 安装 Python 依赖 ─────────────────────────────────────
# 使用阿里云 PyPI 镜像加速 pip 安装
COPY requirements-docker.txt /app/requirements-docker.txt
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r /app/requirements-docker.txt

# ── 安装 Playwright Chromium（使用国内镜像加速）─────────
# npmmirror.com/mirrors/playwright 是淘宝镜像，提供完整的 Playwright 二进制镜像
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
RUN playwright install chromium

# ── 复制应用代码 ─────────────────────────────────────────
COPY . /app/

# 入口脚本可执行（兼容 Windows CRLF 行尾，避免 Linux 容器执行报错）
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# ── 环境变量 ─────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=5200 \
    NO_BROWSER=1 \
    DISPLAY=:99 \
    NOVNC_PORT=6080

# 数据持久化目录
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 5200 6080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-5200}/api/settings" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
