/**
 * 抖音账号订阅管理页面
 * - 通过主页链接添加订阅
 * - 批量导入主页链接
 * - 全量下载订阅用户作品（含风控间隔）
 * - 增量扫描新作品
 */
const DySubscriptionsPage = {
    subscriptions: [],
    progressTimer: null,
    schedulerRunning: false,
    scanInterval: 60,

    render() {
        return `
            <div class="page-header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h2 class="page-title">账号订阅</h2>
                        <p class="page-description">订阅抖音用户，自动下载全部作品并定期增量更新</p>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="DySubscriptionsPage.refreshList()" id="dy-sub-refresh-btn">
                            <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px; margin-right: 6px;">
                                <polyline points="23 4 23 10 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            刷新列表
                        </button>
                        <button class="btn btn-secondary" onclick="DySubscriptionsPage.refreshUserInfo()" id="dy-sub-refresh-info-btn">
                            更新用户信息
                        </button>
                        <button class="btn btn-primary" onclick="DySubscriptionsPage.scanAll()" id="dy-sub-scan-all-btn">
                            <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px; margin-right: 6px;">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            增量扫描全部
                        </button>
                    </div>
                </div>
            </div>

            <!-- 添加订阅区 -->
            <div class="card" style="margin-bottom: var(--spacing-lg);">
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;">
                    <div style="flex: 1; min-width: 280px;">
                        <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">添加单个订阅（主页链接或 sec_uid）</label>
                        <input type="text" id="dy-sub-url-input" class="input" placeholder="https://www.douyin.com/user/MS4wLjABAAAA..." style="width: 100%;">
                    </div>
                    <button class="btn btn-primary" onclick="DySubscriptionsPage.addSingle()" id="dy-sub-add-btn">添加订阅</button>
                </div>
                <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">批量导入（每行一个主页链接，支持分享文本）</label>
                    <textarea id="dy-sub-batch-input" class="input" rows="5" placeholder="https://www.douyin.com/user/MS4wLjABAAAA...&#10;https://v.douyin.com/xxxxxxx/&#10;每行一个链接" style="width: 100%; resize: vertical; font-family: inherit;"></textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                        <button class="btn btn-secondary" onclick="DySubscriptionsPage.addBatch()" id="dy-sub-batch-btn">批量导入</button>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">支持从文件复制粘贴链接到此</span>
                        <label style="margin-left: auto; cursor: pointer; color: var(--primary); font-size: 0.85rem;">
                            📁 从文件加载
                            <input type="file" accept=".txt,.csv" style="display: none;" onchange="DySubscriptionsPage.loadFromFile(event)">
                        </label>
                    </div>
                </div>
            </div>

            <!-- 调度器配置 -->
            <div class="card" style="margin-bottom: var(--spacing-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0 0 4px 0;">自动增量扫描调度器</h3>
                        <p style="margin: 0; color: var(--text-muted); font-size: 0.85rem;">定期扫描订阅用户的新作品并自动下载</p>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">间隔(分钟):</label>
                        <input type="number" id="dy-sub-interval-input" min="5" max="1440" value="60" style="width: 80px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
                        <label style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 8px;">下载并发:</label>
                        <input type="number" id="dy-sub-concurrency-input" min="1" max="10" value="3" style="width: 60px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
                        <button class="btn btn-secondary btn-sm" onclick="DySubscriptionsPage.saveConcurrency()" id="dy-sub-concurrency-btn">保存</button>
                        <button class="btn btn-primary" onclick="DySubscriptionsPage.toggleScheduler()" id="dy-sub-scheduler-btn">启动调度器</button>
                    </div>
                </div>
            </div>

            <!-- 下载进度区 -->
            <div id="dy-sub-progress-card" class="card" style="display: none; margin-bottom: var(--spacing-lg); border-left: 3px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0;">
                        <span id="dy-sub-progress-mode"></span>
                        <span id="dy-sub-progress-user" style="color: var(--primary); margin-left: 8px;"></span>
                        <span id="dy-sub-progress-paused-tag" style="display: none; color: var(--warning); margin-left: 8px; font-size: 0.85rem;">⏸ 已暂停</span>
                    </h3>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="DySubscriptionsPage.togglePause()" id="dy-sub-pause-btn">暂停</button>
                        <button class="btn btn-error btn-sm" onclick="DySubscriptionsPage.cancelDownload()">取消</button>
                    </div>
                </div>

                <!-- 下载队列 -->
                <div id="dy-sub-queue-section" style="display: none; margin-bottom: 12px; padding: 8px 12px; background: var(--bg-glass); border-radius: var(--radius-sm); font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="color: var(--text-secondary);">📋 下载队列 (<span id="dy-sub-queue-count">0</span>)</span>
                        <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 2px 8px;" onclick="DySubscriptionsPage.clearQueue()">清空队列</button>
                    </div>
                    <div id="dy-sub-queue-list" style="color: var(--text-secondary);"></div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 8px;">
                    <div id="dy-sub-progress-bar" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary);">
                    <span id="dy-sub-progress-text">0 / 0</span>
                    <span><span style="color: #2e7d32;">✓ <span id="dy-sub-progress-success">0</span></span> · <span style="color: #c62828;">✗ <span id="dy-sub-progress-failed">0</span></span> · <span style="color: var(--text-secondary);">⏭ <span id="dy-sub-progress-skipped">0</span></span></span>
                </div>
                <div id="dy-sub-progress-current" style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);"></div>
                <div id="dy-sub-progress-logs" style="margin-top: 12px; max-height: 200px; overflow-y: auto; background: var(--bg-body); border-radius: 6px; padding: 8px; font-size: 0.8rem; font-family: monospace; color: var(--text-secondary);"></div>
            </div>

            <!-- 订阅列表 -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                    <h3 style="margin: 0;">订阅列表 <span id="dy-sub-count" style="color: var(--text-muted); font-size: 0.9rem; font-weight: normal;"></span></h3>
                </div>
                <div id="dy-sub-list"></div>
                <div id="dy-sub-empty" style="display: none; text-align: center; padding: var(--spacing-2xl); color: var(--text-muted);">
                    <p style="font-size: 1.1rem; margin-bottom: 8px;">暂无订阅</p>
                    <p>通过上方输入框添加抖音用户主页链接</p>
                </div>
            </div>
        `;
    },

    async init() {
        await this.loadSchedulerStatus();
        await this.loadConcurrency();
        await this.loadList();
        this.startProgressPolling();
    },

    async loadList() {
        try {
            const data = await API.douyinSubscription.list();
            this.subscriptions = data.subscriptions || [];
            this.renderList();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async refreshList() {
        const btn = document.getElementById('dy-sub-refresh-btn');
        if (btn) { btn.disabled = true; btn.textContent = '刷新中...'; }
        await this.loadList();
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px; margin-right: 6px;"><polyline points="23 4 23 10 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>刷新列表`; }
    },

    renderList() {
        const listEl = document.getElementById('dy-sub-list');
        const emptyEl = document.getElementById('dy-sub-empty');
        const countEl = document.getElementById('dy-sub-count');

        if (countEl) countEl.textContent = `(${this.subscriptions.length})`;

        if (this.subscriptions.length === 0) {
            if (listEl) listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';
        if (listEl) {
            listEl.innerHTML = this.subscriptions.map(sub => this.renderSubscriptionItem(sub)).join('');
        }
    },

    renderSubscriptionItem(sub) {
        const nickname = sub.nickname || '未知用户';
        const avatar = sub.avatar || '';
        const secUid = sub.sec_uid;
        const awemeCount = sub.aweme_count || 0;
        const followerCount = sub.follower_count || 0;
        const autoScan = sub.auto_scan !== false;
        const status = sub.status || 'idle';
        const lastDownloadAt = sub.last_download_at || '从未下载';
        const lastDownloadCount = sub.last_download_count || 0;
        const downloadedCount = (sub.downloaded_aweme_ids || []).length;
        const subscribedAt = sub.subscribed_at || '';

        const statusBadge = this.getStatusBadge(status);
        const autoScanBadge = autoScan
            ? '<span style="background: rgba(76, 175, 80, 0.15); color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">自动扫描</span>'
            : '<span style="background: rgba(158, 158, 158, 0.2); color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">已暂停</span>';

        return `
            <div class="subscription-item" style="display: flex; gap: 16px; padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 12px; background: var(--bg-secondary); align-items: flex-start;">
                <img src="${avatar}" alt="${nickname}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; cursor: pointer;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22%3E%3Ccircle fill=%22%23ddd%22 cx=%2228%22 cy=%2228%22 r=%2228%22/%3E%3C/svg%3E'" onclick="window.open('https://www.douyin.com/user/${secUid}', '_blank')">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                        <a href="#dy_user?sec_uid=${secUid}" style="font-weight: 600; font-size: 1rem; color: var(--text-primary); text-decoration: none;" onmouseenter="this.style.color='var(--primary)'" onmouseleave="this.style.color='var(--text-primary)'">${nickname}</a>
                        ${statusBadge}
                        ${autoScanBadge}
                    </div>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                        <span>作品: <strong style="color: var(--text-primary);">${awemeCount}</strong></span>
                        <span>粉丝: <strong style="color: var(--text-primary);">${this.formatNumber(followerCount)}</strong></span>
                        <span>已下载: <strong style="color: var(--text-primary);">${downloadedCount}</strong></span>
                        <span>上次下载: ${lastDownloadAt} (${lastDownloadCount})</span>
                        ${subscribedAt ? `<span>订阅于: ${subscribedAt}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm" onclick="DySubscriptionsPage.downloadOne('${secUid}')" ${status === 'downloading' ? 'disabled' : ''}>下载全部作品</button>
                        <button class="btn btn-secondary btn-sm" onclick="DySubscriptionsPage.toggleScan('${secUid}', ${!autoScan})">${autoScan ? '暂停扫描' : '开启扫描'}</button>
                        <button class="btn btn-secondary btn-sm" onclick="DySubscriptionsPage.openHomepage('${secUid}')">查看主页</button>
                        <button class="btn btn-secondary btn-sm" onclick="DySubscriptionsPage.clearDownloaded('${secUid}', '${nickname.replace(/'/g, "\\'")}', ${downloadedCount})">清空记录</button>
                        <button class="btn btn-error btn-sm" onclick="DySubscriptionsPage.remove('${secUid}', '${nickname.replace(/'/g, "\\'")}')">移除订阅</button>
                    </div>
                </div>
            </div>
        `;
    },

    getStatusBadge(status) {
        const map = {
            'idle': '<span style="background: rgba(158, 158, 158, 0.2); color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">空闲</span>',
            'downloading': '<span style="background: rgba(33, 150, 243, 0.15); color: #1565c0; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">下载中</span>',
            'completed': '<span style="background: rgba(76, 175, 80, 0.15); color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">已完成</span>',
            'failed': '<span style="background: rgba(244, 67, 54, 0.15); color: #c62828; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">失败</span>',
        };
        return map[status] || map['idle'];
    },

    async addSingle() {
        const input = document.getElementById('dy-sub-url-input');
        const url = input.value.trim();
        if (!url) {
            Toast.show('请输入主页链接', 'warning');
            return;
        }

        const btn = document.getElementById('dy-sub-add-btn');
        btn.disabled = true;
        btn.textContent = '添加中...';

        try {
            const data = await API.douyinSubscription.add(url);
            Toast.show(data.message, 'success');
            input.value = '';
            await this.loadList();
        } catch (err) {
            // 错误已由 API 层处理
        } finally {
            btn.disabled = false;
            btn.textContent = '添加订阅';
        }
    },

    async addBatch() {
        const textarea = document.getElementById('dy-sub-batch-input');
        const text = textarea.value.trim();
        if (!text) {
            Toast.show('请输入至少一行链接', 'warning');
            return;
        }

        const btn = document.getElementById('dy-sub-batch-btn');
        btn.disabled = true;
        btn.textContent = '导入中...';

        try {
            const data = await API.douyinSubscription.addBatch(text);
            Toast.show(data.message, 'success');
            textarea.value = '';
            await this.loadList();
        } catch (err) {
            // 错误已处理
        } finally {
            btn.disabled = false;
            btn.textContent = '批量导入';
        }
    },

    loadFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const textarea = document.getElementById('dy-sub-batch-input');
            if (textarea) {
                textarea.value = e.target.result;
                Toast.show(`已加载 ${file.name}`, 'info');
            }
        };
        reader.readAsText(file);
        // 清空 input 允许重复选择同一文件
        event.target.value = '';
    },

    async remove(secUid, nickname) {
        if (!confirm(`确定要移除订阅「${nickname}」吗？\n已下载的文件不会被删除。`)) return;
        try {
            const data = await API.douyinSubscription.remove(secUid);
            Toast.show(data.message, 'success');
            await this.loadList();
        } catch (err) { }
    },

    async clearDownloaded(secUid, nickname, count) {
        if (!confirm(`确定要清空「${nickname}」的已下载记录吗？（共 ${count} 项）\n\n清空后可重新下载已删除的作品。\n本操作不会删除本地已下载的文件。`)) return;
        try {
            const data = await API.douyinSubscription.clearDownloaded(secUid);
            Toast.show(data.message, 'success');
            await this.loadList();
        } catch (err) { }
    },

    async toggleScan(secUid, enabled) {
        try {
            const data = await API.douyinSubscription.toggleScan(secUid, enabled);
            Toast.show(data.message, 'success');
            await this.loadList();
        } catch (err) { }
    },

    async refreshUserInfo() {
        const btn = document.getElementById('dy-sub-refresh-info-btn');
        if (btn) { btn.disabled = true; btn.textContent = '刷新中...'; }
        try {
            const data = await API.douyinSubscription.refresh();
            Toast.show(data.message, 'success');
            await this.loadList();
        } catch (err) { } finally {
            if (btn) { btn.disabled = false; btn.textContent = '更新用户信息'; }
        }
    },

    async downloadOne(secUid) {
        try {
            const data = await API.douyinSubscription.download(secUid);
            if (data.queued) {
                Toast.show(data.message, 'info');
            } else {
                Toast.show(data.message, 'success');
            }
            this.startProgressPolling();
        } catch (err) { }
    },

    async scanAll() {
        const btn = document.getElementById('dy-sub-scan-all-btn');
        if (btn) { btn.disabled = true; btn.textContent = '扫描中...'; }
        try {
            const data = await API.douyinSubscription.scanAll();
            Toast.show(data.message, 'success');
            this.startProgressPolling();
        } catch (err) { } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px; margin-right: 6px;"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/></svg>增量扫描全部`; }
        }
    },

    async cancelDownload() {
        try {
            const data = await API.douyinSubscription.cancel();
            Toast.show(data.message, 'info');
        } catch (err) { }
    },

    async togglePause() {
        const btn = document.getElementById('dy-sub-pause-btn');
        if (btn) { btn.disabled = true; }
        try {
            const state = this._lastProgress || {};
            if (state.status === 'paused') {
                const data = await API.douyinSubscription.resume();
                Toast.show(data.message, 'success');
            } else {
                const data = await API.douyinSubscription.pause();
                Toast.show(data.message, 'info');
            }
        } catch (err) { }
        if (btn) { btn.disabled = false; }
    },

    async removeFromQueue(sec_uid) {
        try {
            const data = await API.douyinSubscription.removeFromQueue(sec_uid);
            Toast.show(data.message, 'info');
        } catch (err) { }
    },

    async clearQueue() {
        try {
            const data = await API.douyinSubscription.clearQueue();
            Toast.show(data.message, 'info');
        } catch (err) { }
    },

    openHomepage(secUid) {
        // 跳转到项目内的用户主页（而不是打开外部链接）
        Router.navigate('dy_user', { sec_uid: secUid });
    },

    startProgressPolling() {
        if (this.progressTimer) return;
        this.progressTimer = setInterval(() => this.pollProgress(), 1500);
        this.pollProgress();
    },

    stopProgressPolling() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    },

    async pollProgress() {
        try {
            const p = await API.douyinSubscription.progress();
            this._lastProgress = p;
            this.renderProgress(p);

            // 任务结束（非暂停）停止轮询
            if (p.status && p.status !== 'running' && p.status !== 'idle' && p.status !== 'paused') {
                // 多轮询一次确保最终状态显示
                setTimeout(() => {
                    if (this.progressTimer) {
                        this.stopProgressPolling();
                        this.loadList();
                    }
                }, 2000);
            }
        } catch (err) {
            // 静默失败
        }
    },

    renderProgress(p) {
        const card = document.getElementById('dy-sub-progress-card');
        if (!card) return;

        // 空闲状态隐藏进度卡片
        if (p.status === 'idle' || (!p.total && !p.logs?.length)) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';

        const modeEl = document.getElementById('dy-sub-progress-mode');
        const userEl = document.getElementById('dy-sub-progress-user');
        const barEl = document.getElementById('dy-sub-progress-bar');
        const textEl = document.getElementById('dy-sub-progress-text');
        const successEl = document.getElementById('dy-sub-progress-success');
        const failedEl = document.getElementById('dy-sub-progress-failed');
        const skippedEl = document.getElementById('dy-sub-progress-skipped');
        const currentEl = document.getElementById('dy-sub-progress-current');
        const logsEl = document.getElementById('dy-sub-progress-logs');
        const pauseBtn = document.getElementById('dy-sub-pause-btn');
        const pausedTag = document.getElementById('dy-sub-progress-paused-tag');

        // 暂停状态 UI
        const isPaused = p.status === 'paused';
        if (pausedTag) pausedTag.style.display = isPaused ? 'inline' : 'none';
        if (pauseBtn) {
            if (isPaused) {
                pauseBtn.textContent = '恢复';
                pauseBtn.className = 'btn btn-primary btn-sm';
            } else {
                pauseBtn.textContent = '暂停';
                pauseBtn.className = 'btn btn-secondary btn-sm';
            }
        }

        if (modeEl) modeEl.textContent = p.mode === 'incremental' ? '增量扫描中' : '全量下载中';
        if (userEl) userEl.textContent = p.current_user || '';

        // 渲染下载队列
        const queueSection = document.getElementById('dy-sub-queue-section');
        const queueCountEl = document.getElementById('dy-sub-queue-count');
        const queueListEl = document.getElementById('dy-sub-queue-list');
        if (queueSection && queueCountEl && queueListEl) {
            const queue = p.queue || [];
            queueCountEl.textContent = queue.length;
            if (queue.length > 0) {
                queueSection.style.display = 'block';
                queueListEl.innerHTML = queue.map((item, i) =>
                    `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                        <span>${i + 1}. ${item.nickname || item.sec_uid.slice(-8)}</span>
                        <a href="javascript:void(0)" onclick="DySubscriptionsPage.removeFromQueue('${item.sec_uid}')" style="color: var(--error); font-size: 0.8rem;">移除</a>
                    </div>`
                ).join('');
            } else {
                queueSection.style.display = 'none';
            }
        }

        const total = p.total || 0;
        const current = p.current_index || 0;
        const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;

        if (barEl) barEl.style.width = `${percent}%`;
        if (textEl) textEl.textContent = `${current} / ${total}`;
        if (successEl) successEl.textContent = p.downloaded_count || 0;
        if (failedEl) failedEl.textContent = p.failed_count || 0;
        if (skippedEl) skippedEl.textContent = p.skipped_count || 0;
        if (currentEl) currentEl.textContent = p.current_title ? `当前: ${p.current_title}` : '';

        if (logsEl && p.logs) {
            // 只显示最新 50 条
            const logs = p.logs.slice(-50);
            logsEl.innerHTML = logs.map(l => `<div>${this.escapeHtml(l)}</div>`).join('');
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    },

    async loadSchedulerStatus() {
        try {
            const data = await API.douyinSubscription.schedulerStatus();
            this.schedulerRunning = data.running;
            this.scanInterval = data.interval_minutes || 60;
            this.updateSchedulerUI();
        } catch (err) { }
    },

    async toggleScheduler() {
        const newEnabled = !this.schedulerRunning;
        const intervalInput = document.getElementById('dy-sub-interval-input');
        const interval = parseInt(intervalInput?.value || '60', 10);

        try {
            const data = await API.douyinSubscription.schedulerToggle(newEnabled, interval);
            Toast.show(data.message, 'success');
            this.schedulerRunning = newEnabled;
            this.scanInterval = Math.max(5, interval);
            this.updateSchedulerUI();
        } catch (err) { }
    },

    updateSchedulerUI() {
        const btn = document.getElementById('dy-sub-scheduler-btn');
        const input = document.getElementById('dy-sub-interval-input');
        if (input) input.value = this.scanInterval;
        if (btn) {
            if (this.schedulerRunning) {
                btn.textContent = '停止调度器';
                btn.className = 'btn btn-error';
            } else {
                btn.textContent = '启动调度器';
                btn.className = 'btn btn-primary';
            }
        }
    },

    async loadConcurrency() {
        try {
            const data = await API.douyinSubscription.getConcurrency();
            const input = document.getElementById('dy-sub-concurrency-input');
            if (input) input.value = data.concurrency || 3;
        } catch (err) { }
    },

    async saveConcurrency() {
        const input = document.getElementById('dy-sub-concurrency-input');
        const btn = document.getElementById('dy-sub-concurrency-btn');
        let n = parseInt(input?.value || '3', 10);
        if (isNaN(n) || n < 1) n = 1;
        if (n > 10) n = 10;
        if (input) input.value = n;

        if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
        try {
            const data = await API.douyinSubscription.setConcurrency(n);
            Toast.show(data.message || `下载并发数已设置为 ${n}`, 'success');
        } catch (err) { }
        if (btn) { btn.disabled = false; btn.textContent = '保存'; }
    },

    formatNumber(num) {
        if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return String(num);
    },

    escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    onShow() {
        // 重新进入页面时刷新
        this.loadList();
        this.startProgressPolling();
    },

    destroy() {
        this.stopProgressPolling();
    }
};
