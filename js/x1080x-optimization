// ==UserScript==
// @name               x1080x-optimization
// @namespace          https://github.com/jasmineamber/tampermonkey
// @version            1.0.6
// @description        合并影片预览、附件地址提取和 115 离线下载的新版 x1080x 优化脚本
// @author             jasmine
// @license            MIT
// @icon               https://www.google.com/s2/favicons?domain=x999x.me
// @match              *://x999x.me/*
// @match              *://*.x999x.me/*
// @match              *://1080xin.vip/*
// @match              *://*.1080xin.vip/*
// @match              *://1080xin.com/*
// @match              *://*.1080xin.com/*
// @match              https://115.com/*
// @require            https://cdn.jsdelivr.net/npm/hotkeys-js@3.8.7/dist/hotkeys.min.js
// @require            https://cdn.jsdelivr.net/gh/jasmineamber/tampermonkey@2e393ffe5198a5aa0d3f9fd901e3bc14866f725d/js/unrar.min.js
// @require            https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js
// @require            https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js
// @resource           x1080x_fancybox_css https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.css
// @require            https://cdn.jsdelivr.net/npm/video.js@5.20.5/dist/video.min.js
// @require            https://cdn.jsdelivr.net/npm/videojs-hotkeys@0.2.27/videojs.hotkeys.min.js
// @require            https://cdn.jsdelivr.net/npm/videojs-resolution-switcher@0.4.2/lib/videojs-resolution-switcher.min.js
// @resource           x1080x_videojs_css https://cdn.jsdelivr.net/npm/video.js@5.20.5/dist/video-js.min.css
// @resource           x1080x_videojs_resolution_css https://cdn.jsdelivr.net/npm/videojs-resolution-switcher@0.4.2/lib/videojs-resolution-switcher.min.css
// @grant              GM_xmlhttpRequest
// @grant              GM_notification
// @grant              GM_download
// @grant              GM_addStyle
// @grant              GM_getValue
// @grant              GM_setValue
// @grant              GM_deleteValue
// @grant              GM_registerMenuCommand
// @grant              GM_unregisterMenuCommand
// @grant              GM_getResourceText
// @grant              GM_openInTab
// @grant              GM_log
// @grant              GM_info
// @grant              unsafeWindow
// @connect            115.com
// @connect            unrar.d2cool.com
// @connect            x999x.me
// @connect            x567x.me
// @connect            1080xin.vip
// @connect            *.1080xin.vip
// @connect            1080xin.com
// @connect            *.1080xin.com
// @connect            javdb.com
// @connect            javbus.com
// @connect            ec.sod.co.jp
// @connect            cloudfront.net
// @connect            r18.com
// @connect            www.dmm.co.jp
// @connect            www.dmm.com
// @connect            video.dmm.co.jp
// @connect            accounts.dmm.co.jp
// @connect            dahlia-av.jp
// @connect            cdn.faleno.net
// @connect            faleno.jp
// @connect            www.mgstage.com
// @connect            www.afesta.tv
// @connect            www.bing.com
// @run-at             document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const SETTING_DEFAULTS = {
        menu_showGallery: true,
        menu_quality: true,
        menu_jumpSOD: true,
        menu_offcial: true,
        menu_multi: false,
        menu_JavDB: false,
        menu_JavBus: false,
        menu_download: false,
        menu_qr: true,
        offline_enabled: true,
        offline_custom_folder: false,
        offline_auto_after_extract: false,
        offline_folder_cid: '',
    };

    function ensureSettingDefaults() {
        for (const [name, defaultValue] of Object.entries(SETTING_DEFAULTS)) {
            const value = GM_getValue(name, null);
            if (value == null) {
                GM_setValue(name, defaultValue);
            }
        }
    }

    function getSetting(name) {
        return GM_getValue(name, SETTING_DEFAULTS[name]);
    }

    const OFFLINE_SUPPORTED_RE = /^(?:magnet|thunder|ed2k|ftp):/i;
    const OFFLINE_SIGN_URL = 'https://115.com/?ct=offline&ac=space';
    const OFFLINE_ADD_URL = 'https://115.com/web/lixian/?ct=lixian&ac=add_task_url';
    const OFFLINE_ADD_URLS = 'https://115.com/web/lixian/?ct=lixian&ac=add_task_urls';
    let offlineToast = null;
    let offlineToastTimer = null;

    class OfflineError extends Error {
        constructor(code, message) {
            super(message);
            this.name = 'OfflineError';
            this.code = code;
        }
    }

    function sync115UserId() {
        let attempts = 0;
        let pollTimer = null;
        let stopTimer = null;

        const stop = function () {
            clearInterval(pollTimer);
            clearTimeout(stopTimer);
        };
        const sync = function () {
            attempts += 1;
            const rawUserId = unsafeWindow.USER_ID;
            const userId = rawUserId == null ? '' : String(rawUserId).trim();
            if (/^\d+$/.test(userId)) {
                if (GM_getValue('115ID', '') !== userId) {
                    GM_setValue('115ID', userId);
                }
                stop();
            } else if (attempts >= 40) {
                stop();
            }
        };

        sync();
        if (!pollTimer && attempts < 40) {
            pollTimer = setInterval(sync, 500);
            stopTimer = setTimeout(stop, 21_000);
        }
    }

    function getOfflineLinks(links) {
        const unique = new Set();
        for (const rawLink of links) {
            const link = String(rawLink || '').trim();
            if (OFFLINE_SUPPORTED_RE.test(link)) {
                unique.add(link);
            }
        }
        return [...unique];
    }

    function parseOfflineResponse(result) {
        const body = result.response ?? result.responseText;
        if (body && typeof body === 'object') {
            return body;
        }
        const text = String(body || '').trim();
        if (/<html[\s>]|<!doctype\s+html/i.test(text)) {
            throw new OfflineError('login_required', '请先登录 115 网盘账号。');
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new OfflineError('invalid_response', '115 返回了无法识别的数据，请稍后重试。');
        }
    }

    function getOfflineSignData(payload) {
        const nested = payload?.response;
        return nested && typeof nested === 'object' ? nested : payload;
    }

    function offlineRequest(details) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: details.method,
                url: details.url,
                headers: details.headers,
                data: details.data,
                responseType: 'json',
                timeout: 20_000,
                onload: function (result) {
                    if (result.status < 200 || result.status >= 400) {
                        reject(
                            new OfflineError(
                                'http_error',
                                `115 请求失败（HTTP ${result.status || '未知'}），请稍后重试。`,
                            ),
                        );
                        return;
                    }
                    try {
                        resolve(parseOfflineResponse(result));
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: function () {
                    reject(new OfflineError('network_error', '无法连接 115，请检查网络后重试。'));
                },
                ontimeout: function () {
                    reject(new OfflineError('timeout', '115 请求超时，请稍后重试。'));
                },
            });
        });
    }

    async function createOfflineTask(links) {
        const supportedLinks = getOfflineLinks(links);
        if (!supportedLinks.length) {
            throw new OfflineError(
                'unsupported',
                '当前链接组没有 115 支持的 magnet、thunder、ed2k 或 ftp 地址。',
            );
        }
        if (!getSetting('offline_enabled')) {
            throw new OfflineError('disabled', '请先在设置中开启“启用一键离线下载”。');
        }

        const userId = String(GM_getValue('115ID', '') || '').trim();
        if (!userId) {
            const hint = '请先登录 115.com，再刷新一次 115 页面以同步账号。';
            GM_notification({
                title: '115 离线下载',
                text: hint,
                timeout: 6000,
                onclick: function () {
                    GM_openInTab('https://115.com/', {active: true});
                },
            });
            throw new OfflineError('uid_missing', hint);
        }

        const requestHeaders = {
            'User-Agent': navigator.userAgent,
            Origin: 'https://115.com',
        };
        const signPayload = await offlineRequest({
            method: 'GET',
            url: OFFLINE_SIGN_URL,
            headers: requestHeaders,
        });
        const signData = getOfflineSignData(signPayload);
        if (!signPayload?.state || !signData?.sign || signData?.time == null) {
            throw new OfflineError(
                'login_required',
                signPayload?.error_msg || '115 登录状态无效，请重新登录后再试。',
            );
        }

        const folderId = getSetting('offline_custom_folder')
            ? String(getSetting('offline_folder_cid') || '').trim()
            : '';
        const data = new URLSearchParams();
        data.set('uid', userId);
        data.set('sign', String(signData.sign || ''));
        data.set('time', String(signData.time || ''));
        data.set('wp_path_id', folderId);
        data.set('savepath', '');
        supportedLinks.forEach((link, index) => {
            if (supportedLinks.length === 1) {
                data.set('url', link);
            } else {
                data.set(`url[${index}]`, link);
            }
        });

        const response = await offlineRequest({
            method: 'POST',
            url: supportedLinks.length === 1 ? OFFLINE_ADD_URL : OFFLINE_ADD_URLS,
            headers: {
                ...requestHeaders,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            },
            data: data.toString(),
        });

        const resultItems = Array.isArray(response?.result) ? response.result : [];
        const items = resultItems.length
            ? resultItems
            : [
                  {
                      state: Boolean(response?.state),
                      errcode: response?.errcode || response?.error_code,
                      error_msg: response?.error_msg,
                  },
              ];
        const summary = {
            success: items.filter((item) => item.state).length,
            duplicate: items.filter((item) => Number(item.errcode) === 10008).length,
            failures: items.filter((item) => !item.state && Number(item.errcode) !== 10008),
        };
        if (!summary.success && !summary.duplicate) {
            const errorCode = Number(response?.errcode || response?.error_code || 0);
            if (errorCode === 911) {
                GM_openInTab('https://captchaapi.115.com/?ac=security_code&type=web', {active: true});
                throw new OfflineError('account_verification', '115 账号需要安全验证，请在打开的页面完成验证。');
            }
            throw new OfflineError(
                'submit_failed',
                response?.error_msg || summary.failures[0]?.error_msg || '115 离线任务创建失败。',
            );
        }
        return summary;
    }

    function installOfflineToastStyles() {
        if (document.querySelector('#x1080x-offline-toast-styles')) {
            return;
        }
        const style = GM_addStyle(`
            .x1080x-offline-toast {
                position: fixed;
                left: 50%;
                bottom: calc(20px + env(safe-area-inset-bottom, 0px));
                z-index: 2147482000;
                box-sizing: border-box;
                width: min(460px, calc(100vw - 28px));
                padding: 12px 14px;
                color: var(--color-ink, #1f2937);
                background: var(--color-card, #fff);
                border: 1px solid var(--color-line, #e4e7ec);
                border-radius: var(--radius-card, 12px);
                box-shadow: 0 12px 36px rgba(15, 23, 42, .2);
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 10px);
            }

            html[data-theme="dark"] .x1080x-offline-toast {
                color: var(--color-ink, #f3f5f8);
                background: var(--color-card, #111a23);
                border-color: var(--color-line, #26313c);
            }

            .x1080x-offline-toast.is-visible {
                animation: x1080x-offline-toast-life 4.2s ease-out both;
            }

            .x1080x-offline-toast-title {
                display: block;
                color: var(--color-ok, #1d7a55);
                font-size: 12.5px;
            }

            .x1080x-offline-toast[data-kind="warning"] .x1080x-offline-toast-title {
                color: var(--color-warn, #a46b0a);
            }

            .x1080x-offline-toast[data-kind="error"] .x1080x-offline-toast-title {
                color: var(--color-accent-text, #c94242);
            }

            .x1080x-offline-toast-message {
                display: block;
                margin-top: 4px;
                color: var(--color-muted, #667085);
                font-size: 11.5px;
                line-height: 1.55;
            }

            @keyframes x1080x-offline-toast-life {
                0% { opacity: 0; transform: translate(-50%, 10px); }
                8%, 88% { opacity: 1; transform: translate(-50%, 0); }
                100% { opacity: 0; transform: translate(-50%, 6px); }
            }

            @media (prefers-reduced-motion: reduce) {
                .x1080x-offline-toast.is-visible {
                    animation: none;
                    opacity: 1;
                    transform: translateX(-50%);
                }
            }
        `);
        if (style) {
            style.id = 'x1080x-offline-toast-styles';
        }
    }

    function hideOfflineToast() {
        clearTimeout(offlineToastTimer);
        offlineToastTimer = null;
        offlineToast?.remove();
        offlineToast = null;
    }

    function showOfflineToast(title, message, kind = 'success') {
        installOfflineToastStyles();
        if (!offlineToast || !offlineToast.isConnected) {
            offlineToast = document.createElement('div');
            offlineToast.className = 'x1080x-offline-toast';
            offlineToast.setAttribute('role', 'status');
            offlineToast.setAttribute('aria-live', 'polite');
            offlineToast.innerHTML =
                '<strong class="x1080x-offline-toast-title"></strong>' +
                '<span class="x1080x-offline-toast-message"></span>';
            document.body.appendChild(offlineToast);
        }
        offlineToast.dataset.kind = kind;
        offlineToast.style.bottom = document.querySelector('.x1080x-copy-toast.is-visible')
            ? 'calc(92px + env(safe-area-inset-bottom, 0px))'
            : '';
        offlineToast.querySelector('.x1080x-offline-toast-title').textContent = title;
        offlineToast.querySelector('.x1080x-offline-toast-message').textContent = message;
        offlineToast.classList.remove('is-visible');
        void offlineToast.offsetWidth;
        offlineToast.classList.add('is-visible');
        clearTimeout(offlineToastTimer);
        offlineToastTimer = setTimeout(hideOfflineToast, 4200);
    }

    async function submitOfflineFromButton(button, links) {
        if (button.dataset.busy === 'true') {
            return false;
        }
        const supportedLinks = getOfflineLinks(links);
        if (!supportedLinks.length) {
            showOfflineToast(
                '115 离线下载失败',
                '本组没有 115 支持的 magnet、thunder、ed2k 或 ftp 地址。',
                'error',
            );
            return false;
        }
        button.dataset.busy = 'true';
        button.disabled = true;
        button.classList.add('is-busy');
        const label = button.querySelector('.x1080x-offline-label');
        if (label) {
            label.textContent = '提交中';
        }
        try {
            const result = await createOfflineTask(supportedLinks);
            const detail = [
                result.success ? `${result.success} 个任务已提交` : '',
                result.duplicate ? `${result.duplicate} 个任务已存在` : '',
                result.failures.length ? `${result.failures.length} 个任务失败` : '',
            ]
                .filter(Boolean)
                .join('，');
            showOfflineToast('115 离线下载', detail || '任务已提交。', result.failures.length ? 'warning' : 'success');
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showOfflineToast('115 离线下载失败', message, 'error');
            return false;
        } finally {
            button.dataset.busy = 'false';
            button.disabled = false;
            const unavailable = button.dataset.available !== 'true';
            button.classList.toggle('is-unavailable', unavailable);
            button.setAttribute('aria-disabled', String(unavailable));
            button.classList.remove('is-busy');
            if (label) {
                label.textContent = '115 离线';
            }
        }
    }

    function escapeSettingAttribute(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    function isSettingsOpen() {
        return Boolean(document.querySelector('.x1080x-settings-overlay'));
    }

    function settingToggleMarkup(name, label, tooltip) {
        return `
            <div class="x1080x-settings-row" data-setting-row="${name}">
                <div class="x1080x-settings-label">
                    <span>${label}</span>
                    <button class="x1080x-settings-help" type="button"
                        aria-label="${escapeSettingAttribute(`${label}说明`)}"
                        data-tooltip="${escapeSettingAttribute(tooltip)}">?</button>
                </div>
                <label class="x1080x-switch">
                    <input type="checkbox" data-setting="${name}" aria-label="${escapeSettingAttribute(label)}">
                    <span class="x1080x-switch-track"></span>
                </label>
            </div>
        `;
    }

    function installSettingsStyles() {
        if (document.querySelector('#x1080x-settings-styles')) {
            return;
        }
        const style = GM_addStyle(`
            .x1080x-settings-overlay {
                --xo-page: var(--color-page, #eef1f5);
                --xo-surface: var(--color-card, #fff);
                --xo-raised: var(--color-card, #fff);
                --xo-soft: var(--color-soft, #f5f7fa);
                --xo-soft-strong: var(--color-hover, #edf1f6);
                --xo-line: var(--color-line, #e3e7ed);
                --xo-line-strong: var(--color-edge, #d5dbe4);
                --xo-text: var(--color-ink, #202631);
                --xo-muted: var(--color-muted, #667085);
                --xo-faint: color-mix(in srgb, var(--xo-muted) 72%, transparent);
                --xo-link: var(--color-link, #4158d9);
                --xo-link-soft: color-mix(in srgb, var(--xo-link) 10%, var(--xo-surface));
                --xo-link-edge: color-mix(in srgb, var(--xo-link) 28%, var(--xo-line));
                --xo-success: var(--color-ok, #1d7a55);
                --xo-success-soft: color-mix(in srgb, var(--xo-success) 11%, var(--xo-surface));
                --xo-danger: var(--color-accent-text, #c94242);
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                display: grid;
                place-items: center;
                box-sizing: border-box;
                padding: 34px;
                color: var(--xo-text);
                background: rgba(5, 9, 14, .55);
                backdrop-filter: blur(8px);
                font-family: var(--font-sans, "PingFang SC", "Microsoft YaHei UI", sans-serif);
                font-size: 13px;
            }

            html[data-theme="dark"] .x1080x-settings-overlay {
                --xo-page: #070b10;
                --xo-surface: var(--color-card, #0d141b);
                --xo-raised: var(--color-card, #111a23);
                --xo-soft: var(--color-soft, #121b24);
                --xo-soft-strong: var(--color-hover, #17222d);
                --xo-line: var(--color-line, #26313c);
                --xo-line-strong: var(--color-edge, #344251);
                --xo-text: var(--color-ink, #f3f5f8);
                --xo-muted: var(--color-muted, #9fa9b6);
                --xo-link: var(--color-link, #9daaff);
                --xo-success: var(--color-ok, #77d5ae);
                --xo-danger: var(--color-accent-text, #ff9a9a);
                background: rgba(0, 0, 0, .7);
            }

            .x1080x-settings-overlay *,
            .x1080x-settings-overlay *::before,
            .x1080x-settings-overlay *::after {
                box-sizing: border-box;
            }

            .x1080x-settings-dialog {
                width: min(940px, 100%);
                height: min(650px, calc(100vh - 68px));
                min-height: 560px;
                display: grid;
                grid-template-rows: auto minmax(0, 1fr) auto;
                overflow: hidden;
                color: var(--xo-text);
                background: var(--xo-surface);
                border: 1px solid var(--xo-line);
                border-radius: 18px;
                box-shadow: 0 30px 80px rgba(0, 0, 0, .28);
            }

            .x1080x-settings-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 24px;
                padding: 22px 26px 20px;
                border-bottom: 1px solid var(--xo-line);
            }

            .x1080x-settings-brand {
                display: flex;
                align-items: center;
                gap: 13px;
            }

            .x1080x-settings-mark {
                width: 38px;
                height: 38px;
                display: grid;
                place-items: center;
                flex: none;
                color: var(--xo-link);
                background: var(--xo-link-soft);
                border: 1px solid var(--xo-link-edge);
                border-radius: 11px;
                font-family: var(--font-mono, Consolas, monospace);
                font-size: 12px;
                font-weight: 700;
                letter-spacing: -.04em;
            }

            .x1080x-settings-title {
                margin: 0 0 4px;
                font-size: 18px;
                line-height: 1.3;
                letter-spacing: -.02em;
            }

            .x1080x-settings-subtitle {
                margin: 0;
                color: var(--xo-muted);
                font-size: 12px;
                line-height: 1.55;
            }

            .x1080x-settings-version {
                flex: none;
                padding: 5px 8px;
                color: var(--xo-muted);
                background: var(--xo-soft);
                border: 1px solid var(--xo-line);
                border-radius: 7px;
                font-family: var(--font-mono, Consolas, monospace);
                font-size: 10px;
            }

            .x1080x-settings-body {
                min-height: 0;
                display: grid;
                grid-template-columns: 190px minmax(0, 1fr);
            }

            .x1080x-settings-tabs {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 18px 14px;
                background: linear-gradient(180deg, var(--xo-soft), transparent 55%), var(--xo-surface);
                border-right: 1px solid var(--xo-line);
            }

            .x1080x-settings-tab {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                color: var(--xo-muted);
                background: transparent;
                border: 1px solid transparent;
                border-radius: 10px;
                cursor: pointer;
                text-align: left;
                font: inherit;
            }

            .x1080x-settings-tab:hover {
                color: var(--xo-text);
                background: var(--xo-soft);
            }

            .x1080x-settings-tab[aria-selected="true"] {
                color: var(--xo-link);
                background: var(--xo-link-soft);
                border-color: var(--xo-link-edge);
            }

            .x1080x-settings-tab svg {
                width: 18px;
                height: 18px;
                flex: none;
            }

            .x1080x-settings-tab-copy strong,
            .x1080x-settings-tab-copy small {
                display: block;
            }

            .x1080x-settings-tab-copy strong {
                font-size: 13px;
                font-weight: 600;
            }

            .x1080x-settings-tab-copy small {
                margin-top: 2px;
                color: var(--xo-faint);
                font-size: 10px;
                white-space: nowrap;
            }

            .x1080x-settings-rail-note {
                margin-top: auto;
                padding: 11px 12px;
                color: var(--xo-muted);
                background: var(--xo-soft);
                border: 1px solid var(--xo-line);
                border-radius: 10px;
                font-size: 10.5px;
                line-height: 1.65;
            }

            .x1080x-settings-rail-note strong {
                display: block;
                margin-bottom: 2px;
                color: var(--xo-text);
                font-size: 11px;
            }

            .x1080x-settings-panel-wrap {
                min-width: 0;
                overflow: auto;
                scrollbar-color: var(--xo-line-strong) transparent;
            }

            .x1080x-settings-panel {
                display: none;
                padding: 22px 26px 30px;
            }

            .x1080x-settings-panel.is-active {
                display: block;
            }

            .x1080x-settings-panel-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 18px;
                margin-bottom: 18px;
            }

            .x1080x-settings-eyebrow {
                margin: 0 0 4px;
                color: var(--xo-link);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: .12em;
            }

            .x1080x-settings-panel-head h2 {
                margin: 0;
                font-size: 19px;
                letter-spacing: -.02em;
            }

            .x1080x-settings-panel-head p {
                max-width: 480px;
                margin: 6px 0 0;
                color: var(--xo-muted);
                font-size: 11.5px;
                line-height: 1.65;
            }

            .x1080x-settings-reset {
                flex: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 7px 10px;
                color: var(--xo-muted);
                background: var(--xo-surface);
                border: 1px solid var(--xo-line);
                border-radius: 8px;
                cursor: pointer;
                font: inherit;
                font-size: 11px;
            }

            .x1080x-settings-reset:hover {
                color: var(--xo-text);
                background: var(--xo-soft);
                border-color: var(--xo-line-strong);
            }

            .x1080x-settings-group + .x1080x-settings-group {
                margin-top: 17px;
            }

            .x1080x-settings-group-title {
                margin: 0 0 8px 2px;
                color: var(--xo-muted);
                font-size: 10px;
                font-weight: 650;
                letter-spacing: .07em;
            }

            .x1080x-settings-card {
                overflow: visible;
                background: var(--xo-raised);
                border: 1px solid var(--xo-line);
                border-radius: 13px;
            }

            .x1080x-settings-row {
                min-height: 58px;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 16px;
                padding: 11px 14px 11px 16px;
            }

            .x1080x-settings-row + .x1080x-settings-row {
                border-top: 1px solid var(--xo-line);
            }

            .x1080x-settings-row.is-disabled {
                opacity: .52;
            }

            .x1080x-settings-label {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 7px;
                font-size: 12.5px;
                font-weight: 550;
            }

            .x1080x-settings-help {
                width: 17px;
                height: 17px;
                display: inline-grid;
                place-items: center;
                flex: none;
                padding: 0;
                color: var(--xo-faint);
                background: transparent;
                border: 1px solid var(--xo-line-strong);
                border-radius: 50%;
                cursor: help;
                font-family: Georgia, serif;
                font-size: 11px;
                font-weight: 700;
                line-height: 1;
            }

            .x1080x-settings-help:hover,
            .x1080x-settings-help:focus-visible {
                color: var(--xo-link);
                background: var(--xo-link-soft);
                border-color: var(--xo-link-edge);
                outline: none;
            }

            .x1080x-switch {
                position: relative;
                width: 38px;
                height: 22px;
                flex: none;
                cursor: pointer;
            }

            .x1080x-switch input {
                position: absolute;
                width: 1px;
                height: 1px;
                opacity: 0;
            }

            .x1080x-switch-track {
                position: absolute;
                inset: 0;
                background: var(--xo-soft-strong);
                border: 1px solid var(--xo-line-strong);
                border-radius: 999px;
                transition: background-color .16s ease, border-color .16s ease;
            }

            .x1080x-switch-track::after {
                content: "";
                position: absolute;
                top: 3px;
                left: 3px;
                width: 14px;
                height: 14px;
                background: var(--xo-faint);
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0, 0, 0, .16);
                transition: transform .16s ease, background-color .16s ease;
            }

            .x1080x-switch input:checked + .x1080x-switch-track {
                background: var(--xo-link);
                border-color: var(--xo-link);
            }

            .x1080x-switch input:checked + .x1080x-switch-track::after {
                transform: translateX(16px);
                background: #fff;
            }

            .x1080x-switch input:focus-visible + .x1080x-switch-track {
                outline: 2px solid var(--xo-link-edge);
                outline-offset: 2px;
            }

            .x1080x-settings-input {
                width: 210px;
                height: 34px;
                padding: 0 10px;
                color: var(--xo-text);
                background: var(--xo-soft);
                border: 1px solid var(--xo-line-strong);
                border-radius: 9px;
                font-family: var(--font-mono, Consolas, monospace);
                font-size: 11px;
                outline: none;
            }

            .x1080x-settings-input:focus {
                border-color: var(--xo-link);
                box-shadow: 0 0 0 3px var(--xo-link-soft);
            }

            .x1080x-settings-input:disabled {
                cursor: not-allowed;
            }

            .x1080x-settings-input.is-invalid {
                border-color: var(--xo-danger);
            }

            .x1080x-settings-status {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 8px;
                color: var(--xo-success);
                background: var(--xo-success-soft);
                border: 1px solid color-mix(in srgb, var(--xo-success) 30%, var(--xo-line));
                border-radius: 999px;
                font-size: 10px;
                font-weight: 600;
                white-space: nowrap;
            }

            .x1080x-settings-status::before {
                content: "";
                width: 6px;
                height: 6px;
                background: currentColor;
                border-radius: 50%;
            }

            .x1080x-settings-status.is-missing {
                color: var(--xo-muted);
            }

            .x1080x-shortcut-card {
                margin-top: 18px;
                overflow: hidden;
                background: var(--xo-raised);
                border: 1px solid var(--xo-line);
                border-radius: 13px;
            }

            .x1080x-shortcut-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 11px 14px;
                background: var(--xo-soft);
                border-bottom: 1px solid var(--xo-line);
                font-size: 11.5px;
            }

            .x1080x-shortcut-head span {
                color: var(--xo-muted);
                font-size: 10px;
            }

            .x1080x-shortcut-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .x1080x-shortcut-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 9px 14px;
                color: var(--xo-muted);
                font-size: 11px;
            }

            .x1080x-shortcut-item:nth-child(even) {
                border-left: 1px solid var(--xo-line);
            }

            .x1080x-shortcut-item:nth-child(n+3) {
                border-top: 1px solid var(--xo-line);
            }

            .x1080x-shortcut-item kbd {
                min-width: 44px;
                padding: 4px 7px;
                color: var(--xo-text);
                background: var(--xo-surface);
                border: 1px solid var(--xo-line-strong);
                border-bottom-width: 2px;
                border-radius: 6px;
                font-family: var(--font-mono, Consolas, monospace);
                font-size: 9.5px;
                text-align: center;
            }

            .x1080x-settings-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 13px 18px 13px 22px;
                background: var(--xo-soft);
                border-top: 1px solid var(--xo-line);
            }

            .x1080x-settings-hint {
                display: flex;
                align-items: center;
                gap: 7px;
                color: var(--xo-muted);
                font-size: 10.5px;
            }

            .x1080x-settings-hint-dot {
                width: 6px;
                height: 6px;
                background: var(--xo-link);
                border-radius: 50%;
                opacity: 0;
            }

            .x1080x-settings-hint.is-dirty .x1080x-settings-hint-dot {
                opacity: 1;
            }

            .x1080x-settings-actions {
                display: flex;
                gap: 8px;
            }

            .x1080x-settings-btn {
                min-height: 36px;
                padding: 0 15px;
                color: var(--xo-text);
                background: var(--xo-surface);
                border: 1px solid var(--xo-line-strong);
                border-radius: 9px;
                cursor: pointer;
                font: inherit;
                font-size: 11.5px;
                font-weight: 600;
            }

            .x1080x-settings-btn:hover {
                background: var(--xo-soft);
            }

            .x1080x-settings-btn.is-primary {
                color: #fff;
                background: var(--xo-link);
                border-color: var(--xo-link);
            }

            html[data-theme="dark"] .x1080x-settings-btn.is-primary {
                color: #101626;
            }

            .x1080x-settings-tooltip {
                position: fixed;
                z-index: 2147483002;
                width: max-content;
                max-width: min(260px, calc(100vw - 24px));
                padding: 8px 10px;
                color: var(--color-ink, #202631);
                background: var(--color-card, #fff);
                border: 1px solid var(--color-edge, #d5dbe4);
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, .2);
                font-family: var(--font-sans, "PingFang SC", sans-serif);
                font-size: 11px;
                line-height: 1.55;
                pointer-events: none;
            }

            html[data-theme="dark"] .x1080x-settings-tooltip {
                color: var(--color-ink, #f3f5f8);
                background: var(--color-card, #111a23);
                border-color: var(--color-edge, #344251);
            }

            @media (max-width: 720px) {
                .x1080x-settings-overlay {
                    display: block;
                    padding: 10px;
                }

                .x1080x-settings-dialog {
                    width: 100%;
                    height: calc(100vh - 20px);
                    min-height: 560px;
                }

                .x1080x-settings-header {
                    padding: 16px 15px 14px;
                }

                .x1080x-settings-mark {
                    width: 34px;
                    height: 34px;
                }

                .x1080x-settings-subtitle,
                .x1080x-settings-version {
                    display: none;
                }

                .x1080x-settings-body {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto minmax(0, 1fr);
                }

                .x1080x-settings-tabs {
                    flex-direction: row;
                    gap: 5px;
                    overflow-x: auto;
                    padding: 8px 9px;
                    border-right: 0;
                    border-bottom: 1px solid var(--xo-line);
                }

                .x1080x-settings-tab {
                    width: auto;
                    flex: 1 0 auto;
                    justify-content: center;
                    padding: 8px 9px;
                }

                .x1080x-settings-tab-copy small,
                .x1080x-settings-rail-note {
                    display: none;
                }

                .x1080x-settings-panel {
                    padding: 17px 12px 24px;
                }

                .x1080x-settings-panel-head {
                    gap: 9px;
                }

                .x1080x-settings-panel-head p {
                    max-width: 250px;
                }

                .x1080x-settings-reset {
                    width: 34px;
                    height: 34px;
                    justify-content: center;
                    overflow: hidden;
                    padding: 0;
                    color: transparent;
                    font-size: 0;
                }

                .x1080x-settings-reset::before {
                    content: "↺";
                    color: var(--xo-muted);
                    font-size: 17px;
                }

                .x1080x-settings-row {
                    gap: 9px;
                    padding-right: 11px;
                }

                .x1080x-settings-input {
                    width: min(145px, 42vw);
                }

                .x1080x-shortcut-grid {
                    grid-template-columns: 1fr;
                }

                .x1080x-shortcut-item:nth-child(even) {
                    border-left: 0;
                }

                .x1080x-shortcut-item:nth-child(n+2) {
                    border-top: 1px solid var(--xo-line);
                }

                .x1080x-settings-footer {
                    padding: 10px 12px;
                }

                .x1080x-settings-hint {
                    display: none;
                }

                .x1080x-settings-actions {
                    width: 100%;
                }

                .x1080x-settings-btn {
                    flex: 1;
                }
            }

            @media (max-width: 430px) {
                .x1080x-settings-tab svg {
                    display: none;
                }

                .x1080x-settings-tab-copy strong {
                    font-size: 11.5px;
                }

                .x1080x-settings-input {
                    width: min(125px, 40vw);
                }
            }

        `);
        if (style) {
            style.id = 'x1080x-settings-styles';
        }
    }

    function openSettings() {
        if (isSettingsOpen()) {
            return;
        }
        installSettingsStyles();

        const tabMeta = [
            ['preview', '影片预览', '画面与搜索来源'],
            ['extract', '地址提取', '附件与快捷键'],
            ['offline', '离线下载', '115 与自动任务'],
        ];
        const tabIcons = [
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg>',
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 12.5 11 15l4.5-5.5M12 3.5v9m-5.5 6h11a2 2 0 0 0 2-2v-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 18.5h10a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.05 10.7 4 4 0 0 0 7 18.5Z" stroke="currentColor" stroke-width="1.6"/><path d="m9.5 14 2.5 2.5 2.5-2.5M12 10v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        ];
        const draft = {};
        for (const [name, defaultValue] of Object.entries(SETTING_DEFAULTS)) {
            const value = GM_getValue(name, defaultValue);
            draft[name] = typeof defaultValue === 'boolean' ? Boolean(value) : String(value ?? '');
        }
        const firstDraft = { ...draft };
        let activeTab = 'preview';
        let restoreFocus = document.activeElement;
        let tooltipPinned = false;
        let tooltipOwner = null;
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'x1080x-settings-overlay';
        overlay.innerHTML = `
            <div class="x1080x-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="x1080x-settings-title">
                <header class="x1080x-settings-header">
                    <div class="x1080x-settings-brand">
                        <div class="x1080x-settings-mark" aria-hidden="true">x8x</div>
                        <div>
                            <h1 class="x1080x-settings-title" id="x1080x-settings-title">x1080x 优化设置</h1>
                            <p class="x1080x-settings-subtitle">预览、链接提取与 115 离线下载，在一个面板里完成配置。</p>
                        </div>
                    </div>
                    <span class="x1080x-settings-version">v${escapeSettingAttribute(GM_info.script.version)}</span>
                </header>
                <div class="x1080x-settings-body">
                    <nav class="x1080x-settings-tabs" role="tablist" aria-label="设置分类">
                        ${tabMeta
                            .map(
                                ([name, title, subtitle], index) => `
                                    <button class="x1080x-settings-tab" type="button" role="tab"
                                        id="x1080x-settings-tab-${name}"
                                        aria-controls="x1080x-settings-panel-${name}"
                                        aria-selected="${index === 0 ? 'true' : 'false'}"
                                        data-tab="${name}">
                                        ${tabIcons[index]}
                                        <span class="x1080x-settings-tab-copy">
                                            <strong>${title}</strong><small>${subtitle}</small>
                                        </span>
                                    </button>
                                `,
                            )
                            .join('')}
                        <div class="x1080x-settings-rail-note">
                            <strong>设置独立保存</strong>
                            每个标签页都可单独恢复默认值，点击“保存设置”后才会写入脚本并刷新页面。
                        </div>
                    </nav>
                    <div class="x1080x-settings-panel-wrap">
                        <section class="x1080x-settings-panel is-active" id="x1080x-settings-panel-preview"
                            role="tabpanel" aria-labelledby="x1080x-settings-tab-preview">
                            <div class="x1080x-settings-panel-head">
                                <div>
                                    <p class="x1080x-settings-eyebrow">PREVIEW</p>
                                    <h2>影片预览</h2>
                                    <p>控制资源页预览图、画质选择及第三方影片信息源。默认值与旧版预览脚本一致。</p>
                                </div>
                                <button class="x1080x-settings-reset" type="button" data-reset="preview" title="恢复本页默认值">↺ 恢复默认</button>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">显示与播放</p>
                                <div class="x1080x-settings-card">
                                    ${settingToggleMarkup('menu_showGallery', '显示预览图', '在资源页展示封面、剧照及可用的预览视频入口。')}
                                    ${settingToggleMarkup('menu_quality', '画面优先', '默认请求更高分辨率；关闭后优先加载较低画质，减少等待和流量。')}
                                    ${settingToggleMarkup('menu_jumpSOD', '视频跳转 SOD', '遇到 SOD 来源时直接打开官方视频页面，而不是使用站内播放器。')}
                                </div>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">搜索来源</p>
                                <div class="x1080x-settings-card">
                                    ${settingToggleMarkup('menu_offcial', '搜索官网', '从 DMM、SOD、FALENO 等官方站点匹配预览资源。与 JavDB、JavBus 互斥。')}
                                    ${settingToggleMarkup('menu_multi', '并发搜索', '同时查询多个可用来源，速度更快，但会发送更多跨站请求。')}
                                    ${settingToggleMarkup('menu_JavDB', '搜索 JavDB', '启用 JavDB 作为预览来源；开启后将停用官网搜索，避免重复结果。')}
                                    ${settingToggleMarkup('menu_JavBus', '搜索 JavBus', '启用 JavBus 作为预览来源；开启后将停用官网搜索，避免重复结果。')}
                                </div>
                            </div>
                        </section>
                        <section class="x1080x-settings-panel" id="x1080x-settings-panel-extract"
                            role="tabpanel" aria-labelledby="x1080x-settings-tab-extract" hidden>
                            <div class="x1080x-settings-panel-head">
                                <div>
                                    <p class="x1080x-settings-eyebrow">EXTRACT</p>
                                    <h2>地址提取</h2>
                                    <p>配置附件提取时的附加行为。链接解析、缓存、复制动画和二维码识别逻辑保持不变。</p>
                                </div>
                                <button class="x1080x-settings-reset" type="button" data-reset="extract" title="恢复本页默认值">↺ 恢复默认</button>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">附件处理</p>
                                <div class="x1080x-settings-card">
                                    ${settingToggleMarkup('menu_download', '下载附件', '提取成功后，同时通过浏览器保存原始 TXT、ZIP 或 RAR 附件。')}
                                    ${settingToggleMarkup('menu_qr', '识别百度二维码', '解析附件中的二维码图片，并把文件名里的四位提取码合并为 ?pwd= 参数。')}
                                </div>
                            </div>
                            <div class="x1080x-shortcut-card">
                                <div class="x1080x-shortcut-head">
                                    <strong>复制快捷键</strong><span>复制成功提示会显示 3 秒</span>
                                </div>
                                <div class="x1080x-shortcut-grid">
                                    <div class="x1080x-shortcut-item"><kbd>Alt + 1</kbd><span>复制第 1 组链接</span></div>
                                    <div class="x1080x-shortcut-item"><kbd>Alt + 2</kbd><span>复制第 2 组链接</span></div>
                                    <div class="x1080x-shortcut-item"><kbd>Alt + 3</kbd><span>复制第 3 组链接</span></div>
                                    <div class="x1080x-shortcut-item"><kbd>Alt + 4</kbd><span>复制第 4 组链接</span></div>
                                </div>
                            </div>
                        </section>
                        <section class="x1080x-settings-panel" id="x1080x-settings-panel-offline"
                            role="tabpanel" aria-labelledby="x1080x-settings-tab-offline" hidden>
                            <div class="x1080x-settings-panel-head">
                                <div>
                                    <p class="x1080x-settings-eyebrow">115 OFFLINE</p>
                                    <h2>离线下载</h2>
                                    <p>把可用的 thunder、magnet、ed2k、ftp 地址提交到 115 云下载。不会提交网盘分享页。</p>
                                </div>
                                <button class="x1080x-settings-reset" type="button" data-reset="offline" title="恢复本页默认值">↺ 恢复默认</button>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">下载方式</p>
                                <div class="x1080x-settings-card">
                                    ${settingToggleMarkup('offline_enabled', '启用一键离线下载', '在每组提取结果右侧显示“115 离线”按钮。关闭后按钮和自动提交都不可用。')}
                                    ${settingToggleMarkup('offline_auto_after_extract', '地址提取后离线下载', '开启后，Alt+1 至 Alt+4 不再把链接写入剪贴板，而是直接提交对应分组内受支持的链接到 115 离线下载；页面上的“复制”按钮不受影响。')}
                                </div>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">保存位置</p>
                                <div class="x1080x-settings-card">
                                    ${settingToggleMarkup('offline_custom_folder', '自定义离线下载文件夹', '关闭时保存到 115 默认的“云下载”；开启后使用下方 CID。CID 为 0 或 17 至 19 位数字。')}
                                    <div class="x1080x-settings-row" id="x1080x-settings-cid-row">
                                        <div class="x1080x-settings-label">
                                            <span>文件夹 CID</span>
                                            <button class="x1080x-settings-help" type="button" aria-label="文件夹 CID 说明"
                                                data-tooltip="打开目标文件夹后，从 115 地址栏 cid= 后复制数字；留空表示使用默认“云下载”文件夹。">?</button>
                                        </div>
                                        <input class="x1080x-settings-input" type="text" inputmode="numeric"
                                            data-setting="offline_folder_cid" aria-label="115 离线下载文件夹 CID"
                                            placeholder="默认：云下载">
                                    </div>
                                </div>
                            </div>
                            <div class="x1080x-settings-group">
                                <p class="x1080x-settings-group-title">账号状态</p>
                                <div class="x1080x-settings-card">
                                    <div class="x1080x-settings-row">
                                        <div class="x1080x-settings-label">
                                            <span>115 账号</span>
                                            <button class="x1080x-settings-help" type="button" aria-label="115 账号说明"
                                                data-tooltip="脚本仅在 115.com 静默同步登录账号的 UID，不读取或保存密码。首次使用前请确认浏览器已登录 115。">?</button>
                                        </div>
                                        <span class="x1080x-settings-status" id="x1080x-settings-uid"></span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
                <footer class="x1080x-settings-footer">
                    <div class="x1080x-settings-hint" id="x1080x-settings-hint">
                        <span class="x1080x-settings-hint-dot"></span>
                        <span>所有更改仅在保存后生效</span>
                    </div>
                    <div class="x1080x-settings-actions">
                        <button class="x1080x-settings-btn" type="button" data-action="cancel">取消</button>
                        <button class="x1080x-settings-btn is-primary" type="button" data-action="save">保存设置</button>
                    </div>
                </footer>
            </div>
        `;
        document.body.appendChild(overlay);

        const tooltip = document.createElement('div');
        tooltip.className = 'x1080x-settings-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.hidden = true;
        document.body.appendChild(tooltip);

        const hint = overlay.querySelector('#x1080x-settings-hint');
        const cidInput = overlay.querySelector('[data-setting="offline_folder_cid"]');
        const cidRow = overlay.querySelector('#x1080x-settings-cid-row');
        const uidNode = overlay.querySelector('#x1080x-settings-uid');

        const updateUidStatus = function () {
            const synced = Boolean(String(GM_getValue('115ID', '') || '').trim());
            uidNode.textContent = synced ? 'UID 已同步' : '等待 115 同步';
            uidNode.classList.toggle('is-missing', !synced);
        };
        const markDirty = function () {
            const dirty = Object.keys(draft).some((key) => draft[key] !== firstDraft[key]);
            hint.classList.toggle('is-dirty', dirty);
            hint.lastElementChild.textContent = dirty ? '设置有未保存的更改' : '所有更改仅在保存后生效';
        };
        const setTab = function (name) {
            activeTab = name;
            overlay.querySelectorAll('[data-tab]').forEach((button) => {
                button.setAttribute('aria-selected', String(button.dataset.tab === name));
            });
            overlay.querySelectorAll('.x1080x-settings-panel').forEach((panel) => {
                const active = panel.id === `x1080x-settings-panel-${name}`;
                panel.classList.toggle('is-active', active);
                panel.hidden = !active;
            });
            hideTooltip();
        };
        const syncOfflineState = function () {
            const enabled = draft.offline_enabled;
            for (const key of ['offline_auto_after_extract', 'offline_custom_folder']) {
                const input = overlay.querySelector(`[data-setting="${key}"]`);
                input.disabled = !enabled;
                input.closest('.x1080x-settings-row').classList.toggle('is-disabled', !enabled);
            }
            cidInput.disabled = !enabled || !draft.offline_custom_folder;
            cidRow.classList.toggle('is-disabled', !enabled || !draft.offline_custom_folder);
            cidInput.classList.remove('is-invalid');
        };
        const renderDraft = function () {
            overlay.querySelectorAll('input[data-setting]').forEach((input) => {
                const value = draft[input.dataset.setting];
                if (input.type === 'checkbox') {
                    input.checked = Boolean(value);
                } else {
                    input.value = value;
                }
            });
            syncOfflineState();
            updateUidStatus();
            markDirty();
        };
        const hideTooltip = function () {
            tooltip.hidden = true;
            tooltipPinned = false;
            tooltipOwner = null;
        };
        const showTooltip = function (button, pinned = false) {
            const text = button?.dataset.tooltip;
            if (!text) {
                return;
            }
            tooltipOwner = button;
            tooltipPinned = pinned;
            tooltip.textContent = text;
            tooltip.hidden = false;
            const rect = button.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const left = Math.max(
                tooltipRect.width / 2 + 10,
                Math.min(innerWidth - tooltipRect.width / 2 - 10, rect.left + rect.width / 2),
            );
            const top = rect.top - tooltipRect.height - 9 < 8
                ? rect.bottom + 9
                : rect.top - tooltipRect.height - 9;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.transform = 'translateX(-50%)';
        };
        const close = function () {
            hideTooltip();
            overlay.remove();
            tooltip.remove();
            document.documentElement.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeydown, true);
            if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected) {
                restoreFocus.focus({preventScroll: true});
            }
        };
        const onKeydown = function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
        };
        const normalizePreviewSources = function (changedName) {
            if ((changedName === 'menu_JavDB' || changedName === 'menu_JavBus') && draft[changedName]) {
                draft.menu_offcial = false;
            } else if (changedName === 'menu_offcial' && draft.menu_offcial) {
                draft.menu_JavDB = false;
                draft.menu_JavBus = false;
            }
        };

        overlay.addEventListener('click', function (event) {
            const tab = event.target.closest('[data-tab]');
            if (tab) {
                setTab(tab.dataset.tab);
                return;
            }
            const reset = event.target.closest('[data-reset]');
            if (reset) {
                const keys = reset.dataset.reset === 'preview'
                    ? ['menu_showGallery', 'menu_quality', 'menu_jumpSOD', 'menu_offcial', 'menu_multi', 'menu_JavDB', 'menu_JavBus']
                    : reset.dataset.reset === 'extract'
                      ? ['menu_download', 'menu_qr']
                      : ['offline_enabled', 'offline_custom_folder', 'offline_auto_after_extract', 'offline_folder_cid'];
                for (const key of keys) {
                    draft[key] = SETTING_DEFAULTS[key];
                }
                normalizePreviewSources();
                renderDraft();
                return;
            }
            const help = event.target.closest('.x1080x-settings-help');
            if (help) {
                if (tooltipPinned && tooltipOwner === help) {
                    hideTooltip();
                } else {
                    showTooltip(help, true);
                }
                return;
            }
            if (tooltipPinned) {
                hideTooltip();
            }
            if (!event.target.closest('.x1080x-settings-dialog')) {
                close();
                return;
            }
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action === 'cancel') {
                close();
            } else if (action === 'save') {
                const cid = String(draft.offline_folder_cid || '').trim();
                const needsFolder = draft.offline_enabled && draft.offline_custom_folder && cid;
                if (needsFolder && !/^(?:0|\d{17,19})$/.test(cid)) {
                    cidInput.classList.add('is-invalid');
                    showOfflineToast('无法保存设置', 'CID 必须为 0、17 至 19 位数字，或留空使用默认文件夹。', 'error');
                    cidInput.focus();
                    return;
                }
                normalizePreviewSources();
                for (const [name, defaultValue] of Object.entries(SETTING_DEFAULTS)) {
                    const value = typeof defaultValue === 'boolean' ? Boolean(draft[name]) : String(draft[name] || '');
                    GM_setValue(name, value);
                }
                GM_notification({
                    title: 'x1080x 优化设置',
                    text: '设置已保存，页面即将刷新。',
                    timeout: 2200,
                });
                close();
                setTimeout(() => location.reload(), 250);
            }
        });

        overlay.addEventListener('change', function (event) {
            const input = event.target.closest('input[data-setting]');
            if (!input) {
                return;
            }
            const name = input.dataset.setting;
            draft[name] = input.type === 'checkbox' ? input.checked : input.value;
            normalizePreviewSources(name);
            renderDraft();
        });
        overlay.addEventListener('input', function (event) {
            const input = event.target.closest('input[data-setting]');
            if (!input || input.type === 'checkbox') {
                return;
            }
            draft[input.dataset.setting] = input.value;
            input.classList.remove('is-invalid');
            markDirty();
        });
        overlay.addEventListener('pointerover', function (event) {
            const help = event.target.closest('.x1080x-settings-help');
            if (help && !tooltipPinned) {
                showTooltip(help);
            }
        });
        overlay.addEventListener('pointerout', function (event) {
            const help = event.target.closest('.x1080x-settings-help');
            if (help && !tooltipPinned) {
                hideTooltip();
            }
        });
        overlay.addEventListener('focusin', function (event) {
            const help = event.target.closest('.x1080x-settings-help');
            if (help) {
                showTooltip(help);
            }
        });
        overlay.addEventListener('focusout', function (event) {
            if (!tooltipPinned && event.target.closest('.x1080x-settings-help')) {
                hideTooltip();
            }
        });
        overlay.querySelector('.x1080x-settings-panel-wrap').addEventListener('scroll', hideTooltip, {passive: true});
        document.addEventListener('keydown', onKeydown, true);
        renderDraft();
        overlay.querySelector('[data-tab="preview"]').focus({preventScroll: true});
    }

    ensureSettingDefaults();

    if (location.hostname === '115.com') {
        sync115UserId();
        return;
    }

    GM_registerMenuCommand('设置', openSettings);

    (function initPreviewModule() {
// 日志记录
    function record_log(msg) {
        let log = GM_getValue("log");
        if (log !== "") {
            log = log + "\n"
        }
        GM_setValue("log", log + msg);
        GM_log(msg);
    }

    // 通用请求
    function gmFetch(obj) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: obj.method || 'GET',
                // timeout in ms
                timeout: obj.timeout,
                url: obj.url,
                headers: obj.headers,
                cookie: obj.cookie,
                data: obj.data,
                revalidate: obj.revalidate ? true: false,
                nocache: obj.nocache ? true: false,
                onload: res => {
                    if (res.status >= 200 && res.status < 400 || res.finalUrl === "http://ec.sod.co.jp/prime/") {
                        resolve(res);
                    } else {
                        reject(res);
                    }
                },
                onerror: reject,
                ontimeout: reject,
            });
        });
    }

    // 请求
    function fetch(url, headers={"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"}){
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: url,
                method: "GET",
                headers: headers,
                //timeout: 5000,
                onload: function(r){
                    if (r.status === 200) {
                        resolve(r.responseText)
                    } else {
                        reject("status error: " + r.status)
                    }
                },
                onerror: function(e) {
                    reject('fetch error')
                },
                ontimeout: function(e) {
                    reject('fetch timeout')
                }
            });
        })
    }

    // 检查连接
    function checkURL(url, headers={"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"}){
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: url,
                method: "HEAD",
                headers: headers,
                //timeout: 5000,
                onload: function(r){
                    if (r.status === 200) {
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                },
                onerror: function(e) {
                    resolve(false)
                },
                ontimeout: function(e) {
                    resolve(false)
                }
            });
        })
    }

    async function asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }
    // 格式化页面
    function parseResponse(html) {
        const parser = new DOMParser()
        const tree = parser.parseFromString(html, "text/html")
        return tree
    }

    // DMM获取大图
    function preview_src(src)
    {
        if (src.match(/(p[a-z]\.)jpg/)) {
            return src.replace(RegExp.$1, 'pl.');
        } else if (src.match(/consumer_game/)) {
            return src.replace('js-','-');
        } else if (src.match(/js\-([0-9]+)\.jpg$/)) {
            return src.replace('js-','jp-');
        } else if (src.match(/ts\-([0-9]+)\.jpg$/)) {
            return src.replace('ts-','tl-');
        } else if (src.match(/(\-[0-9]+\.)jpg$/)) {
            return src.replace(RegExp.$1, 'jp' + RegExp.$1);
        } else {
            return src.replace('-','jp-');
        }
    }

    function getBase64FromImage(url, onSuccess, onError) {
        var xhr = new XMLHttpRequest();

        xhr.responseType = "arraybuffer";
        xhr.open("GET", url);

        xhr.onload = function () {
            var base64, binary, bytes, mediaType;

            bytes = new Uint8Array(xhr.response);
            //NOTE String.fromCharCode.apply(String, ...
            //may cause "Maximum call stack size exceeded"
            binary = [].map.call(bytes, function (byte) {
                return String.fromCharCode(byte);
            }).join('');
            mediaType = xhr.getResponseHeader('content-type');
            base64 = [
                'data:',
                mediaType ? mediaType + ';':'',
                'base64,',
                btoa(binary)
            ].join('');
            onSuccess(base64);
        };
        xhr.onerror = onError;
        xhr.send();
    }

    // 插入预览图
    function insertImages(item, gallery_div, video_type, source) {
        let src;
        if (video_type === "sod" && ["sod", "javbus"].includes(source)) {
            src = URL.createObjectURL(item)
            imageObjectUrls.push(src);
        } else {
            src = item
        }
        const a = document.createElement("a");
        const img = document.createElement("img");
        a.href = src;
        a.setAttribute("data-fancybox", "gallery");
        a.setAttribute("class", "x1080x-ga-box");
        img.setAttribute("class", "x1080x-auto-img");
        img.src = src;
        a.appendChild(img);
        gallery_div.appendChild(a);
    }

    //下载预览图
    //    async function downloadSODImages(gallery, headers) {
    //        for (let index = 0; index < gallery.length; index++) {
    //            try {
    //                await download(gallery[index], gallery[index], headers);
    //            }
    //            catch(e){
    //                record_log(e)
    //            }
    //        }
    //    }

    //访问预览图
    async function accessSODImages(gallery, headers) {
        for (let index = 0; index < gallery.length; index++) {
            try {
                await fetch(gallery[index], headers);
            }
            catch(e){
                record_log(e)
            }
        }
    }

    // 浏览器版本
    navigator.sayswho= (function(){
        let ua= navigator.userAgent;
        let tem;
        let M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if(/trident/i.test(M[1])){
            tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE '+(tem[1] || '');
        }
        if(M[1]=== 'Chrome'){
            tem= ua.match(/\b(OPR|Edge)\/(\d+)/);
            if(tem!= null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
        }
        M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
        if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
        return M.join(' ');
    })();
    // 入口
    //const res = await fetch("https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=ssis279/mtype=AhRVShI_/service=litevideo/mode=/width=560/height=360/", {"accept-language": "ja-JP,ja;q=0.9"})
    //log(res);
    //const re = /const args = ({.+});$/gm;
    //const hits = [];
    //// Iterate hits
    //let match = null;
    //do {
    //    match = re.exec(res);
    //    if(match) {
    //        hits.push(match[1]);
    //    }
    //} while (match);
    //const obj = JSON.parse(hits[0])
    //record_log(obj["bitrates"]); // Prints [ '#with', '#hashtags' ]
    //return false
    let activeResourcePath = "";
    let activeResourceKey = "";
    let activeRunId = 0;
    let activePlayer = null;
    let activeGallery = null;
    let previewStylesLoaded = false;
    let imageObjectUrls = [];

    function disposeActivePreview() {
        if (activePlayer) {
            try {
                activePlayer.dispose();
            } catch (error) {
                console.warn("x1080x-preview: failed to dispose player", error);
            }
            activePlayer = null;
        }
        document.querySelectorAll(".x1080x-gallery[data-x1080x-preview]").forEach(element => element.remove());
        activeGallery = null;
        imageObjectUrls.forEach(url => URL.revokeObjectURL(url));
        imageObjectUrls = [];
    }

    function getResourcePageData() {
        const firstPost = document.querySelector("#first-post");
        const attachment = firstPost?.querySelector(".attachments-section");
        const subject = (firstPost?.querySelector("h1") || document.querySelector("#main-content h1"))?.textContent?.trim();
        if (!firstPost || !attachment || !subject) {
            return null;
        }

        const images = [...firstPost.querySelectorAll(".post-text img")];
        const coverImage = images.find(image => {
            try {
                const hostname = new URL(image.currentSrc || image.src).hostname;
                return hostname.endsWith("dmm.co.jp") || hostname === "www.hxmmdd.com";
            } catch (error) {
                return false;
            }
        });
        const numberMatch = subject.match(/\b[A-Z0-9]+-\d{2,}\b/i);
        if (!coverImage || !numberMatch) {
            return null;
        }

        const cover = coverImage.currentSrc || coverImage.src;
        const filename = new URL(cover).pathname.split("/").pop();
        const pid = filename.replace(/(?:\.[^.]+)+$/, "").replace(/(?:pl(?:zm)?|zm)$/i, "") || numberMatch[0];
        return {attachment, cover, subject, vid: numberMatch[0], pid};
    }

    function runResourcePreview(data, resourceKey, runId) {
        const {attachment, cover, subject} = data;
        if (!getSetting("menu_showGallery")) {
            return;
        }

        let video_type;
        if (subject.match(/\(SOD\)|\(SODVR\)/) && getSetting("menu_offcial")) {
            video_type = "sod";
        } else if ([subject.match(/\(Prestige\)|\(MAXING\)/), document.body.innerHTML.indexOf("Prestige") !== -1].some(Boolean) && getSetting("menu_offcial")) {
            video_type = "mgs";
        } else if (subject.match(/\(AfestaVR\)/) && getSetting("menu_offcial")) {
            video_type = "afesta";
        } else {
            video_type = "sod";
        }
        let is_vr = subject.includes("【VR】") || subject.includes("【8K VR】");
        let {pid, vid} = data;
        if (pid !== vid && video_type === "sod") {
            video_type = "dmm";
        }
        if (getSetting("menu_offcial") && !pid.startsWith("1")) {
            if (subject.match(/\(DAHLIA\)/)) {
                video_type = "dahlia";
                pid = pid.replace("-", "");
            }
            if (subject.match(/\(FALENO\)/) && document.body.innerHTML.indexOf("Prestige") === -1) {
                video_type = "faleno";
                pid = pid.replace("-", "");
            }
        }
        if (is_vr && video_type === "sod" && !vid.startsWith("3")) {
            vid = `3${vid}`;
        }
        if (/\d{3}[A-Z]+-\d{3}/i.test(pid)) {
            video_type = "mgs";
        }
        const mxgsMatch = vid.match(/^MXGS-(\d{3,4})$/i);
        if (mxgsMatch) {
            vid = `mxgs${mxgsMatch[1].padStart(5, "0")}`;
            video_type = "dmm";
        }

        let multi_search = getSetting("menu_multi");
        GM_setValue("log", "");
        record_log(`浏览器: ${navigator.sayswho}`);
        record_log(`插件版本: ${GM_info.script.version}`);
        record_log(`标题: ${subject}`);
        record_log(`地址: ${window.location.href}`);
        record_log(`番号: ${pid}`);
        record_log(`视频ID: ${vid}`);

    // 预览容器
    const gallery_div = document.createElement("div")
    gallery_div.setAttribute("class", "x1080x-gallery");
    gallery_div.dataset.x1080xPreview = "true";
    gallery_div.dataset.resourceKey = resourceKey;
    activeGallery = gallery_div;
    const ga_inner = document.createElement('span');
    gallery_div.appendChild(ga_inner)
    attachment.parentNode.insertBefore(gallery_div, attachment)
    // 播放容器
    const play_box = document.createElement("a");
    play_box.setAttribute("class", "x1080x-ga-box x1080x-play-box");
    play_box.setAttribute("data-fancybox", "");
    gallery_div.insertBefore(play_box, gallery_div.firstChild);
    // 视频封面
    const poster = document.createElement("img");
    poster.setAttribute("class", "x1080x-auto-img");
    poster.src = cover
    const span = document.createElement("span");
    span.setAttribute("class", "x1080x-preview");
    span.innerHTML = '預告片'
    const outer_span = document.createElement("span");
    outer_span.setAttribute("class", "x1080x-outer");
    outer_span.innerHTML = '外链'
    play_box.appendChild(span);
    play_box.appendChild(outer_span);
    play_box.appendChild(poster);
    // 播放器
    const video_player = document.createElement("video");
    video_player.setAttribute("id", "x1080x-player");
    video_player.setAttribute("class", "video-js  vjs-default-skin");
    play_box.append(video_player)
    const options = {
        controls: true,
        responsive: true,
        plugins: {
            videoJsResolutionSwitcher: {
                default: getSetting('menu_quality') ? `high`: `low`, // Default resolution [{Number}, 'low', 'high'],
                dynamicLabel: true
            }
        },
    };
    let player = videojs("x1080x-player", options, function(){});
    activePlayer = player;
    player.ready(function() {
        this.hotkeys({
            volumeStep: 0.1,
            seekStep: 5,
            enableModifiersForNumbers: false
        });
    });
    // 加载fancybox样式
    if (!previewStylesLoaded) {
    // 加载播放器和画廊样式
    GM_addStyle(GM_getResourceText("x1080x_fancybox_css"));
    GM_addStyle(GM_getResourceText("x1080x_videojs_css"));
    GM_addStyle(".video-js .vjs-progress-holder, .video-js .vjs-progress-holder .vjs-play-progress,.video-js .vjs-progress-holder .vjs-load-progress,.video-js .vjs-progress-holder .vjs-tooltip-progress-bar,.video-js .vjs-progress-holder .vjs-load-progress div{height:1.0em}");
    GM_addStyle(GM_getResourceText("x1080x_videojs_resolution_css"));
    // 自定义样式
    let btn_img = `PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iNTEycHgiIGhlaWdodD0iNTEycHgiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogICAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA1Mi4xICg2NzA0OCkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgICA8dGl0bGU+YnRuLXBsYXk8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iUGFnZS0xIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iYnRuLXBsYXkiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yNTYsMCBDMTE0Ljg0MzU0OSwwIDAsMTE0Ljg0MzU0OSAwLDI1NiBDMCwzOTcuMTU2NDUxIDExNC44NDM1NDksNTEyIDI1Niw1MTIgQzM5Ny4xNTY0NTEsNTEyIDUxMiwzOTcuMTU2NDUxIDUxMiwyNTYgQzUxMiwxMTQuODQzNTQ5IDM5Ny4xNTY0NTEsMCAyNTYsMCBaIiBpZD0iU2hhcGUiIGZpbGw9IiMwQTVFRTAiPjwvcGF0aD4KICAgICAgICAgICAgPHBvbHlnb24gaWQ9IlBhdGgiIGZpbGw9IiNGRkZGRkYiIHBvaW50cz0iMTkyIDM4My45OTcyODUgMTkyIDEyNy45OTkwOTUgMzg0IDI1NS45OTcyODUiPjwvcG9seWdvbj4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==`
    GM_addStyle(`
        .x1080x-gallery {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            margin-top: 10px;
            max-width: 95%;
        }
        .x1080x-ga-box {
            display: inline-block;
            width: 250px;
            height: auto;
            text-align: center;
            vertical-align: middle;
            overflow-x: hidden;
            text-overflow: ellipsis;
            font-size: .9rem;
            background-color: black;
            margin: 5px 5px 0px 0px;
            cursor: pointer;
        }
        .x1080x-ga-box .x1080x-auto-img {
            position: relative;
            height: 120px;
        }
        .x1080x-play-box {
            display: none;
            position: relative;
        }
        .x1080x-play-box span.x1080x-preview {
            font-size: .8rem;
            color: #fff;
            background-color: #fc8300;
            position: absolute;
            top: 4px;
            left: 4px;
            text-align: center;
            padding: 1px 2px;
            border-radius: 3px;
            z-index: 999;
        }
        .x1080x-play-box span.x1080x-outer {
            font-size: .8rem;
            color: #fff;
            background-color: #fc8300;
            position: absolute;
            top: 4px;
            right: 4px;
            text-align: center;
            padding: 1px 2px;
            border-radius: 3px;
            z-index: 999;
            display: none;
        }
        .x1080x-play-box:after {
            background: url("data:image/svg+xml;base64,${btn_img}") 50% no-repeat;
            background-color: rgba(0,0,0,.2);
            background-size: 40px 40px;
            bottom: 0;
            content: "";
            display: block;
            left: 0;
            position: absolute;
            right: 0;
            top: 0;
            height: 100%;
        }
        .x1080x-play-box:hover::after {
            background-color: rgba(33,156,239,0);;
        }
        #x1080x-player {
            display:none;
            position: absolute;
            width: 50%;
            height: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            overflow: hidden;
        }
    `);
    previewStylesLoaded = true;
    }

    let source;
    let dmm = async() => {
        if (!multi_search && (video_type !== "dmm" && !(video_type == "sod" && pid.includes("-"))) || !getSetting("menu_offcial")) {
            record_log(`DMM Search: 跳过`)
            throw new Error('DMM Search: 跳过');
        }
        let search_id = pid
        if (pid.includes("-")) {
            search_id = pid.split("-").join("00").toLowerCase()
        }
        record_log(`DMM Search: ${search_id}`)
        let dmm_headers = {"accept-language": "ja-JP,ja;q=0.9"}
        let dmm_cookie = "age_check_done=1"
        //let dmm_cookie = GM_getValue("FANZA_Cookies") ? GM_getValue("FANZA_Cookies"): "age_check_done=1";
        //let search_request = {url: `https://www.dmm.co.jp/search/=/searchstr=${search_id}`, headers: dmm_headers, cookie: dmm_cookie}
        //let search_res = await gmFetch(search_request).catch(err => {record_log(err); return;})
        // let search_html = parseResponse(search_res.responseText)
        // let ele_detail = search_html.querySelector(`.tmb a[href*="${search_id}"][href^="https://www.dmm.co.jp"]`)
        //const pattern = `https:\/\/www\.dmm\.co\.jp\/[\\w\/\\-\\=]*cid=${search_id}`;
        //const regex = new RegExp(pattern, "g");
        //let ele_detail = regex.exec(search_res.responseText)
       //if (!ele_detail) {
       //    record_log(`DMM Search: 未找到`);
       //    throw new Error('DMM Search: 未找到');
       //}
        // let detail_url = ele_detail.getAttribute("href").split("?")[0]
        //let detail_url = ele_detail[0]
        //record_log(`DMM Search: 详情页 ${detail_url}`)
        // let cid_pattern = /cid=(.*?\w)\//
        // let cid = cid_pattern.exec(detail_url)[1]
        //let detail_request = {url: detail_url, headers: dmm_headers, cookie: dmm_cookie}
        //let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        //let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        // let imgs = [...detail_html.querySelectorAll("#sample-image-block img")].map( item => item.getAttribute("src")).map( item => preview_src(item))
        // let imgs = [...detail_html.querySelectorAll(`div[class*="pt-0.5"] a`)].map( item => item.getAttribute("href")).map( item => preview_src(item))
        let dmm_api_request = {method: "POST", data: JSON.stringify({
            "query": "query ContentPageData($id: ID!, $isAv: Boolean!) {ppvContent(id: $id) {...ContentData}}\n fragment ContentData on PPVContent {id\n title\n packageImage {largeUrl}\n sampleImages {imageUrl largeImageUrl}\n ...AvAdditionalContentData @include(if: $isAv)}\n fragment AvAdditionalContentData on PPVContent {actresses {name}}",
            "operationName": "ContentPageData",
            "variables": {
                "id": search_id,
                "isAmateur": false,
                "isAnime": false,
                "isAv": true,
                "isCinema": false,
                "isLoggedIn": false,
                "isSP": false
            }
        }), url: `https://api.video.dmm.co.jp/graphql`, headers: {'Content-Type': "application/json"}, cookie: dmm_cookie}
        let dmm_api_res = await gmFetch(dmm_api_request).catch(err => {
            record_log(`DMM request failed: ${err?.statusText || err?.status || err}`);
            throw new Error(`DMM API request failed: ${err?.statusText || err?.status || err}`)
        })
        let dmm_api_json = JSON.parse(dmm_api_res.responseText);
        let imgs = dmm_api_json.data.ppvContent.sampleImages.map(item => {
            if (item.largeImageUrl) {
                return item.largeImageUrl
            } else {
                return item.imageUrl
            }
        })
        imgs = imgs.filter(item => item !== null)
        // 预览视频
        let video = []
        if (is_vr) {
            let video_request = {url: `https://www.dmm.co.jp/digital/-/vr-sample-player/=/cid=${search_id}/`, headers: dmm_headers, cookie: dmm_cookie}
            let video_res = await gmFetch(video_request).catch(err => {record_log(err); return;});
            let video_pattern = /var sampleUrl = "(.*)";/g;
            let video_url = video_pattern.exec(video_res.responseText)[1]
            if (video_url !== '') {
                video.push({
                    src: video_url,
                    type: 'video/mp4',
                    label: `VR`,
                    res: `100`
                })
            }
        } else {
            // let video_request = {url: `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${cid}/mtype=AhRVShI_/service=litevideo/mode=/width=560/height=360/`, headers: dmm_headers, cookie: dmm_cookie};
            let video_request = {url: `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${search_id}`, headers: dmm_headers, cookie: dmm_cookie};
            const video_label = {300: "流畅", 1000: "清晰", 1500: "高清", 2000: "高清", 3000: "HD", "4K (2160p)": "4K", "4K (2160p60)": "4K", "FullHD (1080p)": "1080p", "FullHD (1080p60)": "1080p", "HD (720p)": "720p", "HD (720p60)": "720p","高画質 (576p)": "576p", "中画質 (432p)": "432p", "中画質 (288p)": "288p", "低画質 (144p)": "144p"}
            let video_res = await gmFetch(video_request).catch(err => {record_log(err); return;});
            let video_pattern = /(const args = |const params = )({.+});$/gm;
            if (video_res.responseText) {
                let bitrates = JSON.parse(video_pattern.exec(video_res.responseText)[2]).bitrates
                video = bitrates.map( function(item) {
                    return {
                        src: item.src,
                        type: 'video/mp4',
                        label: video_label[item.bitrate],
                        res: item.bitrate
                    }
                })
            }
        }
        return {imgs: imgs, video: video, source: "dmm"}
    }

    let dahlia = async() => {
        if (!multi_search && video_type !== "dahlia" || !getSetting("menu_offcial")) {
            record_log(`DAHLIA Search: 跳过`)
            throw new Error('DAHLIA Search: 跳过');
        }
        let dahlia_cookie = "max-age=0"
        let detail_url = `https://dahlia-av.jp/works/${pid}/`
        record_log(`DAHLIA Search: 详情页 ${detail_url}`)
        let detail_request = {url: detail_url, cookie: dahlia_cookie}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll(".box_works01_ga a")].map( item => item.getAttribute("href"))
        // 预览视频
        let video = []
        let video_url = detail_html.querySelector(".overoll_box .pop_sample").getAttribute("href");
        if (video_url !== '') {
            video.push({
                src: video_url,
                type: 'video/mp4',
                label: `DAHLIA`,
                res: `100`
            })
        }
        return {imgs: imgs, video: video, source: "dmm"}
    }

    let faleno = async() => {
        if (!multi_search && video_type !== "faleno" || !getSetting("menu_offcial")) {
            record_log(`FALENO Search: 跳过`)
            throw new Error('FALENO Search: 跳过');
        }
        let faleno_cookie = "modal=off"
        let detail_url = `https://faleno.jp/top/works/${pid}/`
        record_log(`FALENO Search: 详情页 ${detail_url}`)
        let detail_request = {url: detail_url, cookie: faleno_cookie}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll(".box_works01_ga a")].map( item => item.getAttribute("href"))
        // 预览视频
        let video = []
        let video_url = detail_html.querySelector(".pop_sample").getAttribute("href");
        if (video_url !== '') {
            video.push({
                src: video_url,
                type: 'video/mp4',
                label: `FALENO`,
                res: `100`
            })
        }
        return {imgs: imgs, video: video, source: "dmm"}
    }

    let mgstage = async() => {
        if (!multi_search && video_type !== "mgs" || !getSetting("menu_offcial")) {
            record_log(`MGSTAGE Search: 跳过`)
            throw new Error('MGSTAGE Search: 跳过');
        }
        record_log(`MGSTAGE Search: ${pid}`)
        let cookie = `adc=1`;
        let detail_request = {url: `https://www.mgstage.com/product/product_detail/${pid}/`, cookie: cookie}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll(".sample_image")].map( item => item.getAttribute("href"))
        // 预览视频
        let video = []
        let ele = detail_html.querySelector('div.detail_photo p.sample_movie_btn a:not([disabled])');
        if (ele) {
            let href = ele.getAttribute('href');
            let pid = href.split('/').pop();
            record_log(`MGSTAGE Search: 视频ID ${pid}`);
            let video_request = {url: `https://www.mgstage.com/sampleplayer/sampleRespons.php?pid=${pid}`, cookie: cookie}
            let video_res = await gmFetch(video_request).catch(err => {record_log(err); return;})
            let re = /https.*?ism/
            let json_obj = JSON.parse(video_res.responseText);
            let video_url = json_obj.url;
            video_url = re.exec(video_url)[0].replace('ism', 'mp4');
            video.push({
                src: video_url,
                type: 'video/mp4',
                label: `MGS`,
                res: `100`
            })
        }
        return {imgs: imgs, video: video, source: "mgs"}
    }
    let sod = async() => {
        if (!multi_search && video_type !== "sod" || !getSetting("menu_offcial")) {
            record_log(`SOD Search: 跳过`)
            throw new Error('SOD Search: 跳过');
        }
        record_log(`SOD Search: ${vid}`)
        let detail_request = {url: `https://ec.sod.co.jp/prime/videos/?id=${vid}`}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        let age_check = detail_html.querySelector(".pkg_age")
        if (age_check) {
            await gmFetch({url: `https://ec.sod.co.jp/prime/_ontime.php`}).catch(err => {record_log(err); return;})
            detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
            detail_html = parseResponse(detail_res.responseText)
        }
        // 预览图
        let imgs = [...detail_html.querySelectorAll(".img-gallery a")].map( item => item.getAttribute("href"))
        let imgs_blob = []
        await asyncForEach(imgs, async (img) => {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "get",
                    url: img,
                    headers: {"referer": `https://ec.sod.co.jp/prime/videos/?id=${vid}`},
                    responseType: "blob",
                    onload:  response => {resolve(response)},
                    onerror: response => {reject(response)},
                });
            });
            //console.log("response:", response);
            const {response: blob} = response;
            console.log(blob);
            imgs_blob.push(blob)
        })
        imgs = imgs_blob
        // 预览视频
        let video = []
        let ele_video = detail_html.querySelector(".videos_sampb a");
        if (ele_video) {
            let video_url = `https://ec.sod.co.jp/prime/videos/${ele_video.getAttribute('href')}`;
            video.push({
                src: video_url,
                type: 'video/mp4',
                label: `SOD`,
                res: `100`
            })
            let video_request = {url: video_url}
            let video_res = await gmFetch(video_request).catch(err => {record_log(err); return;})
            let video_html = parseResponse(video_res.responseText)
            let video_src = video_html.querySelector("#moviebox source").getAttribute("src")
            video.push({
                src: `${video_src}?from=script`,
                type: 'video/mp4',
                label: `SOD`,
                res: `100`
            })
        }
        return {imgs: imgs, video: video, source: "sod"}
    }

    let afesta = async() => {
        if (!multi_search && video_type !== "afesta" || !getSetting("menu_offcial")) {
            record_log(`Afesta Search: 跳过`)
            throw new Error('Afesta Search: 跳过');
        }
        record_log(`Afesta Search: ${pid}`)
        const params = new URLSearchParams();
        params.append("keyword", `${pid}`);
        params.append("header", "search");
        let search_request = {url: `https://www.afesta.tv/vr/search.php`, method: `POST`, data: `keyword=${pid}&header=search`, headers: {"Content-Type": "application/x-www-form-urlencoded"}}
        let search_res = await gmFetch(search_request).catch(err => {record_log(err); return;})
        let search_html = parseResponse(search_res.responseText)

        let ele_detail = Array.from(search_html.querySelectorAll('.faces-list a')).find(el => el.querySelector(`img`).getAttribute(`data-src`).indexOf(pid) != -1)
        if (!ele_detail) {
            record_log(`Afesta Search: 未找到`);
            throw new Error('Afesta Search: 未找到');
        }
        let detail_url = ele_detail.getAttribute("href")
        record_log(`Afesta Search: 详情页 ${detail_url}`)
        let detail_request = {url: detail_url}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll(`.thumbs-grid li a`)]
        .map( item => item.getAttribute("href"))
        .map( item => {
            if (!item.startsWith(`http`)) {
                return new URL(item, detail_url).href
            } else {
                return item
            }})
        // 预览视频
        let video = []
        return {imgs: imgs, video: video, source: "afesta"}
    }

    let javdb = async() => {
        if (!getSetting("menu_JavDB") || getSetting("menu_offcial")) {
            record_log(`JavDB Search: 跳过`)
            throw new Error('JavDB Search: 跳过');
        }
        record_log(`JavDB Search: ${vid}`)
        let cookie = `over18=1`;
        let search_request = {url: `https://javdb.com/search?q=${vid}&f=all`, cookie: cookie}
        let search_res = await gmFetch(search_request).catch(err => {record_log(err); return;})
        let search_html = parseResponse(search_res.responseText)
        let ele_detail = Array.from(search_html.querySelectorAll('.video-title strong')).find(el => el.textContent === vid)
        if (!ele_detail) {
            record_log(`JavDB Search: 未找到`);
            throw new Error('JavDB Search: 未找到');
        }
        let detail_url = `https://javdb.com${ele_detail.closest("a").getAttribute("href")}`
        let detail_request = {url: detail_url, cookie: cookie}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll(".preview-images a[class=tile-item]")].map( item => item.getAttribute("href"))
        // 预览视频
        let video = []
        let ele_video = detail_html.querySelector(".preview-video-container")
        if (ele_video) {
            let video_src = ele_video.nextElementSibling.querySelector("source").getAttribute("src")
            video.push({
                src: video_src,
                type: 'video/mp4',
                label: `JavDB`,
                res: `100`
            })
        }
        return {imgs: imgs, video: video, source: "javdb"}
    }

    let javbus = async() => {
        if (!getSetting("menu_JavBus") || getSetting("menu_offcial")) {
            record_log(`JavBus Search: 跳过`)
            throw new Error('JavBus Search: 跳过');
        }
        record_log(`JavBus Search: ${vid}`)
        let detail_request = {url: `https://www.javbus.com/${vid}`}
        let detail_res = await gmFetch(detail_request).catch(err => {record_log(err); return;})
        let detail_html = parseResponse(detail_res.responseText)
        // 预览图
        let imgs = [...detail_html.querySelectorAll("#sample-waterfall a")]
        .map( item => item.getAttribute("href"))
        .map(function(item) {
            if(item.startsWith("http")) {
                return item
            } else {
                video_type="sod"
                return `https://www.javbus.com${item}`
            }
        })
        if (video_type==="sod") {
            let imgs_blob = []
            await asyncForEach(imgs, async (img) => {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "get",
                        url: img,
                        headers: {"referer": `https://www.javbus.com/${vid}`},
                        responseType: "blob",
                        onload:  response => {resolve(response)},
                        onerror: response => {reject(response)},
                    });
                });
                //console.log("response:", response);
                const {response: blob} = response;
                imgs_blob.push(blob)
            })
            imgs = imgs_blob
        }
        // 预览视频
        let video = []
        return {imgs: imgs, video: video, source: "javbus"}
    }

    ga_inner.innerHTML = "正在搜索预览图..."
    Promise.allSettled([dmm(),dahlia(),faleno(),mgstage(),sod(),afesta(),javdb(),javbus()]).then(results=>{
        if (runId !== activeRunId || !gallery_div.isConnected || location.pathname !== activeResourcePath) {
            return;
        }
        ga_inner.innerHTML = ""
        results.forEach(r => {
            if (r.status === "rejected" && !String(r.reason?.stack || r.reason).includes("跳过")) {
                record_log(`Error Reason: ${r.reason?.stack || r.reason}`)
            }
        })
        let p = results.find(result => result.status==="fulfilled")
        if (p) {
            source = p.value.source
            let imgs = p.value.imgs
            let video = p.value.video
            if (imgs.length !== 0) {
                imgs.forEach(item => insertImages(item, gallery_div, video_type, source))
            }
            if (video.length !==0) {
                play_box.setAttribute("style", "display:inline-block");
                if (source === "sod") {
                    if (getSetting("menu_jumpSOD")) {
                        video = video.slice(0,1)
                        outer_span.setAttribute("style", "display:block");
                    } else {
                        video = video.slice(1)
                        player.updateSrc(video)
                    }
                } else {
                    player.updateSrc(video)
                }

                // 点击弹出播放器
                play_box.onclick = function (e) {
                    e.preventDefault();
                    if (source === "sod" && getSetting("menu_jumpSOD")) {
                        GM_openInTab(video[0].src, {active : true})
                    } else {
                        video_player.setAttribute("style", "display:block");
                        $.fancybox.open({
                            src  : '#x1080x-player',
                            type : 'inline',
                            opts : {
                                smallBtn: false,
                                touch: false,
                                afterShow : function( instance, current ) {
                                    player.play();
                                },
                                afterClose : function( instance, current ) {
                                    player.pause();
                                }
                            }
                        });
                    }
                }
            }
            if (imgs.length === 0 && video.length === 0 ){
                gallery_div.style.display = "none"
            }
        } else {
            gallery_div.style.display = "none";
        }
    }).catch(error => {
        if (runId === activeRunId) {
            record_log(`Preview error: ${error?.stack || error}`);
            ga_inner.textContent = "预览加载失败，请刷新页面重试";
        }
    });
    //$.fancybox.defaults.loop = "true";
    }

    function reconcileResourcePage() {
        const path = location.pathname;
        if (path !== "/" && !path.startsWith("/boards/") && !path.startsWith("/resources/")) {
            if (activeResourcePath) {
                activeResourcePath = "";
                activeResourceKey = "";
                activeRunId++;
                disposeActivePreview();
            }
            return;
        }

        if (path !== activeResourcePath) {
            activeResourcePath = path;
            activeResourceKey = "";
            activeRunId++;
            disposeActivePreview();
        }

        const data = getResourcePageData();
        if (!data) {
            return;
        }
        const resourceKey = `${path}|${data.subject}|${data.cover}`;
        if (activeResourceKey === resourceKey) {
            if (activeGallery && data.attachment.parentNode && (activeGallery.parentNode !== data.attachment.parentNode || activeGallery.nextElementSibling !== data.attachment)) {
                data.attachment.parentNode.insertBefore(activeGallery, data.attachment);
            }
            return;
        }

        const existingGallery = document.querySelector(".x1080x-gallery[data-x1080x-preview]");
        if (existingGallery?.dataset.resourceKey === resourceKey && existingGallery.parentNode === data.attachment.parentNode && existingGallery.nextElementSibling === data.attachment) {
            activeGallery = existingGallery;
            activeResourceKey = resourceKey;
            return;
        }

        disposeActivePreview();
        activeResourceKey = resourceKey;
        const runId = ++activeRunId;
        runResourcePreview(data, resourceKey, runId);
    }

    let reconcileTimer;
    let hydrationTimer;
    let initialHydrationReady = false;
    const INITIAL_HYDRATION_DELAY = 120;

    function scheduleInitialHydration() {
        if (initialHydrationReady || hydrationTimer) {
            return;
        }
        hydrationTimer = setTimeout(() => {
            hydrationTimer = null;
            if (document.readyState !== "complete") return;
            initialHydrationReady = true;
            reconcileResourcePage();
        }, INITIAL_HYDRATION_DELAY);
    }

    function scheduleResourceReconcile() {
        if (!initialHydrationReady) {
            if (document.readyState === "complete") {
                scheduleInitialHydration();
            }
            return;
        }
        clearTimeout(reconcileTimer);
        reconcileTimer = setTimeout(reconcileResourcePage, 80);
    }

    const resourceObserver = new MutationObserver(scheduleResourceReconcile);
    resourceObserver.observe(document.documentElement, {childList: true, subtree: true});
    window.addEventListener("popstate", scheduleResourceReconcile);
    window.addEventListener("pageshow", scheduleResourceReconcile);
    window.addEventListener("load", scheduleInitialHydration, {once: true});
    if (document.readyState === "complete") {
        scheduleInitialHydration();
    }
    })();

    (function initExtractModule() {

    'use strict';

    const API_ROOT = '/api/';
    const RESOURCE_PATH_RE = /^\/resources\/([^/?#]+)/;
    const ZIP_TEXT_RE = /\.(?:txt|url|m3u8?|html?)$/i;
    const ZIP_IMAGE_RE = /\.(?:png|jpe?g)$/i;
    const MAX_TEXT_BYTES = 5 * 1024 * 1024;
    const MAX_ZIP_FILES = 200;
    const QRCODE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@nuintun/qrcode@3.3.0/+esm';
    const QRCODE_LOAD_ERROR = '二维码组件加载失败，请检查网络后重试';

    const ERROR_MESSAGES = {
        attachment_reference_invalid: '附件引用已失效，请刷新页面后重试。',
        attachment_level_forbidden: '当前账号没有下载该附件的权限。',
        attachment_limit: '已达到附件下载限制。',
        board_admission_required: '当前账号没有进入该版区的权限。',
        browser_pass_required: '浏览器验证已过期，请刷新页面完成验证后重试。',
        browser_pass_invalid: '浏览器验证失败，请刷新页面后重试。',
        cloudflare_challenge: '网站验证尚未完成，请刷新页面后重试。',
        csrf_failed: '页面登录信息已变化，请刷新页面后重试。',
        delivery_busy: '当前下载较多，请稍后重试。',
        delivery_unavailable: '下载服务暂时不可用，请稍后重试。',
        download_expired: '下载凭证已过期，请重新提取。',
        download_reauthorization_required: '下载条件已变化，请重新提取。',
        download_token_expired: '下载凭证已过期，请重新提取。',
        download_token_invalid: '下载凭证无效，请重新提取。',
        file_not_ready: '附件尚未准备好，请稍后再试。',
        file_verification_busy: '附件正在检查，请稍后重试。',
        file_withdrawn: '附件已撤回，无法下载。',
        insufficient_points: '点数不足，无法领取该附件。',
        login_required: '请先登录后再提取链接。',
        quota_exhausted: '今日或本月下载额度已用完。',
        rate_limited: '操作过于频繁，请稍后重试。',
        request_failed: '请求失败，请稍后重试。',
        request_timeout: '请求超时，请检查网络后重试。',
        service_unavailable: '服务暂时不可用，请稍后重试。',
        session_invalid: '登录状态已失效，请重新登录。',
        slot_level_required: '当前会员等级不能下载该附件。',
        topic_downloads_locked: '该主题的附件下载已暂停。',
    };

    class RequestError extends Error {
        constructor(code, message, status = 0) {
            super(message || ERROR_MESSAGES[code] || '操作未完成，请稍后重试。');
            this.name = 'RequestError';
            this.code = code || 'request_failed';
            this.status = status;
        }
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function randomId() {
        if (typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
            value.toString(16).padStart(2, '0'),
        ).join('');
    }

    function add_element(type, attributes) {
        const element = document.createElement(type);
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                element.setAttribute(key, value);
            }
        }
        return element;
    }

    function formatPoints(value) {
        const points = Number(value);
        if (!Number.isFinite(points)) {
            return String(value);
        }
        return Number.isInteger(points) ? String(points) : points.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    function errorMessage(code, fallback) {
        return ERROR_MESSAGES[code] || fallback || code || '操作未完成，请稍后重试。';
    }

    function withTimeout(promise, timeoutMs, message, code = 'request_timeout') {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new RequestError(code, message)), timeoutMs);
            Promise.resolve(promise).then(
                (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        });
    }

    function fetchWithTimeout(url, options, timeoutMs, message) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, {...options, signal: controller.signal})
            .catch((error) => {
                if (controller.signal.aborted) {
                    throw new RequestError('request_timeout', message);
                }
                throw error;
            })
            .finally(() => clearTimeout(timer));
    }

    function readCsrfCookie() {
        const metaName = document.querySelector('meta[name="x1080x-csrf-cookie"]')?.content;
        if (!metaName) {
            return '';
        }
        const cookie = document.cookie
            .split('; ')
            .find((item) => item.startsWith(`${metaName}=`));
        if (!cookie) {
            return '';
        }
        try {
            return decodeURIComponent(cookie.slice(metaName.length + 1));
        } catch (error) {
            return cookie.slice(metaName.length + 1);
        }
    }

    let csrfTokenPromise = null;

    async function getCsrfToken(force = false) {
        if (!force) {
            const token = readCsrfCookie();
            if (token) {
                return token;
            }
        }
        if (force) {
            csrfTokenPromise = null;
        }
        if (!csrfTokenPromise) {
            csrfTokenPromise = (async function () {
                const response = await fetchWithTimeout(
                    `${API_ROOT}auth/csrf`,
                    {
                        cache: 'no-store',
                        credentials: 'same-origin',
                    },
                    20_000,
                    '获取页面验证信息超时，请刷新页面后重试。',
                );
                if (!response.ok) {
                    const text = await response.text();
                    throw new RequestError('request_failed', text || '无法获取页面验证信息。', response.status);
                }
                const data = await withTimeout(
                    response.json(),
                    10_000,
                    '页面验证信息读取超时，请刷新页面后重试。',
                );
                if (!data.csrf_token) {
                    throw new RequestError('request_failed', '页面验证信息无效。', response.status);
                }
                return data.csrf_token;
            })().catch((error) => {
                csrfTokenPromise = null;
                throw error;
            });
        }
        return csrfTokenPromise;
    }

    async function responseError(response) {
        let data = {};
        try {
            data = JSON.parse(await withTimeout(
                response.clone().text(),
                10_000,
                '服务器错误信息读取超时。',
            ));
        } catch (error) {
            data = {};
        }
        return new RequestError(
            data.error || (response.status === 429 ? 'rate_limited' : 'request_failed'),
            data.message || errorMessage(data.error),
            response.status,
        );
    }

    async function requestJson(path, options = {}, retryCsrf = true, csrfTokenOverride = '') {
        const headers = new Headers(options.headers || {});
        const method = (options.method || 'GET').toUpperCase();
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        if (method !== 'GET' && method !== 'HEAD') {
            headers.set('X-CSRFToken', csrfTokenOverride || await getCsrfToken());
        }

        let response;
        try {
            response = await fetchWithTimeout(`${API_ROOT}${path}`, {
                ...options,
                method,
                headers,
                cache: 'no-store',
                credentials: 'same-origin',
            }, 25_000, '服务器响应超时，请稍后重试。');
        } catch (error) {
            if (error instanceof RequestError) {
                throw error;
            }
            throw new RequestError('request_failed', '网络请求失败，请检查网络后重试。');
        }

        if (response.headers.get('cf-mitigated') === 'challenge') {
            throw new RequestError('cloudflare_challenge');
        }

        if (!response.ok) {
            const failure = await responseError(response);
            if (
                retryCsrf
                && response.status === 403
                && (failure.code === 'csrf_failed' || !response.headers.get('content-type')?.includes('json'))
            ) {
                const csrfToken = await getCsrfToken(true);
                return requestJson(path, options, false, csrfToken);
            }
            throw failure;
        }

        try {
            return await withTimeout(response.json(), 10_000, '服务器返回数据超时，请稍后重试。');
        } catch (error) {
            if (error instanceof RequestError) {
                throw error;
            }
            throw new RequestError('request_failed', '服务器返回了无效数据。', response.status);
        }
    }

    async function getQuote(slotId) {
        const quote = await requestJson(`slots/${encodeURIComponent(slotId)}/preview`);
        if (!quote || !quote.slot_id) {
            throw new RequestError('request_failed', '无法读取附件下载信息。');
        }
        return quote;
    }

    function quoteProblem(quote) {
        if (!quote.viewer_id) {
            return ERROR_MESSAGES.login_required;
        }
        if (quote.status === 'denied') {
            return errorMessage(quote.reason, '当前账号不能下载该附件。');
        }
        if (!quote.file_ready) {
            return errorMessage(quote.reason || 'file_not_ready');
        }
        if (!quote.version_id) {
            return '附件版本信息无效，请刷新页面后重试。';
        }
        return '';
    }

    async function claimDownload(quote) {
        const problem = quoteProblem(quote);
        if (problem) {
            throw new RequestError(quote.reason || 'request_failed', problem);
        }

        const payload = {
            expected_user_id: quote.viewer_id,
            slot_id: quote.slot_id,
            expected_version: quote.version_id,
            expected_price: quote.price_points,
            expected_payable: quote.payable_points,
            idempotency_key: randomId(),
        };
        const result = await requestJson('downloads/claim', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (result.requires_new_claim) {
            throw new RequestError('download_expired');
        }
        if (!result.receipt_id) {
            throw new RequestError('request_failed', '服务器没有返回下载凭证。');
        }
        return result.receipt_id;
    }

    async function validateReceiptBlob(blob, status, contentType = '') {
        if (contentType.includes('application/json') || contentType.includes('text/html')) {
            const text = await blob.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch (error) {
                data = {};
            }
            if (data.error) {
                throw new RequestError(data.error, data.message || errorMessage(data.error), status);
            }
            throw new RequestError('request_failed', '服务器返回了错误页面，请刷新后重试。', status);
        }
        if (!blob.size) {
            throw new RequestError('request_failed', '下载到的附件为空。', status);
        }
        const sample = await blob.slice(0, 256).text();
        if (/^\s*(?:<!doctype|<html)/i.test(sample)) {
            throw new RequestError('request_failed', '服务器返回了错误页面，请刷新后重试。', status);
        }
        return blob;
    }

    async function fetchReceiptBlobWithPage(receiptId) {
        const response = await fetchWithTimeout(
            `${API_ROOT}downloads/file/${encodeURIComponent(receiptId)}`,
            {
                cache: 'no-store',
                credentials: 'same-origin',
            },
            25_000,
            '附件下载响应超时，请稍后重试。',
        );

        if (response.headers.get('cf-mitigated') === 'challenge') {
            throw new RequestError('cloudflare_challenge');
        }
        if (!response.ok) {
            throw await responseError(response);
        }
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const blob = await withTimeout(
            response.blob(),
            30_000,
            '附件内容读取超时，请稍后重试。',
        );
        return validateReceiptBlob(blob, response.status, contentType);
    }

    function parseHeaderText(headerText) {
        const headers = {};
        for (const line of String(headerText || '').split(/\r?\n/)) {
            const separator = line.indexOf(':');
            if (separator > 0) {
                headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
            }
        }
        return headers;
    }

    function toUint8Array(value) {
        if (!value) {
            throw new Error('服务器没有返回附件内容');
        }
        const tag = Object.prototype.toString.call(value);
        if (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') {
            return new Uint8Array(value);
        }
        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        }
        throw new Error('服务器返回了无法识别的附件内容');
    }

    function bytesToText(bytes) {
        return new TextDecoder('utf-8').decode(bytes);
    }

    function fetchReceiptBlobWithGM(receiptId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: new URL(`${API_ROOT}downloads/file/${encodeURIComponent(receiptId)}`, location.href).href,
                responseType: 'arraybuffer',
                timeout: 35_000,
                cookie: document.cookie,
                onload: async (response) => {
                    try {
                        const headers = parseHeaderText(response.responseHeaders);
                        if (response.response == null) {
                            throw new RequestError('delivery_unavailable', '下载服务没有返回附件内容。');
                        }
                        const contentType = headers['content-type'] || '';
                        const bytes = toUint8Array(response.response);
                        const blob = new Blob([bytes], {
                            type: contentType || 'application/octet-stream',
                        });
                        if (response.status < 200 || response.status >= 300) {
                            if (contentType.includes('application/json') || contentType.includes('text/html')) {
                                reject(await validateReceiptBlob(blob, response.status, contentType));
                                return;
                            }
                            throw new RequestError(
                                'request_failed',
                                errorMessage('delivery_unavailable'),
                                response.status,
                            );
                        }
                        resolve(await validateReceiptBlob(blob, response.status, contentType));
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: () => reject(new RequestError('delivery_unavailable', '下载服务连接失败，请稍后重试。')),
                ontimeout: () => reject(new RequestError('request_timeout', '附件下载超时，请稍后重试。')),
            });
        });
    }

    async function fetchReceiptBlob(receiptId) {
        try {
            return await fetchReceiptBlobWithGM(receiptId);
        } catch (error) {
            const noFallbackCodes = new Set([
                'download_expired',
                'download_reauthorization_required',
                'download_token_expired',
                'download_token_invalid',
                'file_not_ready',
                'file_withdrawn',
            ]);
            if (error instanceof RequestError && noFallbackCodes.has(error.code)) {
                throw error;
            }
            try {
                return await fetchReceiptBlobWithPage(receiptId);
            } catch (pageError) {
                throw pageError instanceof RequestError ? pageError : error;
            }
        }
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('附件缓存失败'));
            reader.readAsDataURL(blob);
        });
    }

    function blobToArrayBuffer(blob) {
        if (typeof blob.arrayBuffer === 'function') {
            return blob.arrayBuffer();
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('附件读取失败'));
            reader.readAsArrayBuffer(blob);
        });
    }

    async function dataUrlToBlob(dataUrl) {
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error('附件缓存无效');
        }
        return response.blob();
    }

    function download_attach(blobData, file_name = null) {
        const anchor = document.createElement('a');
        const url = URL.createObjectURL(blobData);
        anchor.href = url;
        if (file_name) {
            anchor.download = file_name;
        }
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(function () {
            anchor.remove();
            URL.revokeObjectURL(url);
        }, 0);
    }

    function BlobToImageData(blob) {
        const blobUrl = URL.createObjectURL(blob);
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = (error) => reject(error);
            image.src = blobUrl;
        }).then((image) => {
            URL.revokeObjectURL(blobUrl);
            const [width, height] = [image.width, image.height];
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, width, height);
        });
    }

    let qrCodeModulePromise = null;

    function loadQrCodeModule() {
        if (!qrCodeModulePromise) {
            qrCodeModulePromise = import(QRCODE_MODULE_URL).catch((error) => {
                qrCodeModulePromise = null;
                throw new Error(QRCODE_LOAD_ERROR, {cause: error});
            });
        }
        return qrCodeModulePromise;
    }

    async function decodeQrLink(blob) {
        const {Decoder} = await loadQrCodeModule();
        const imageData = await BlobToImageData(blob);
        const result = new Decoder()
            .setOptions({canOverwriteImage: false})
            .decode(imageData.data, imageData.width, imageData.height);
        const link = result?.data?.trim();
        if (!link) {
            throw new Error('二维码中没有链接');
        }
        return link;
    }

    async function get_valid_link() {
        const urls = ['https://unrar.d2cool.com:8443'];
        for (const url of urls) {
            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url,
                        responseType: 'blob',
                        timeout: 5000,
                        onload: resolve,
                        onerror: reject,
                    });
                });
                const text = await response.response.text();
                if (text === 'Hello World!') {
                    return url;
                }
            } catch (error) {
                // 尝试下一个解压服务
            }
        }
        return null;
    }

    async function getRarPassword(blobData) {
        const serviceUrl = await get_valid_link();
        if (!serviceUrl) {
            throw new Error('二维码解压服务不可用');
        }
        const formData = new FormData();
        formData.append('file', new File([blobData], 'temp.rar'));
        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${serviceUrl}/unrar`,
                data: formData,
                responseType: 'blob',
                onload: resolve,
                onerror: reject,
            });
        });
        return (await response.response.text()).trim();
    }

    function cleanText(text) {
        return text.replace(/^\uFEFF/gm, '').replace(/^\u00BB\u00BF/gm, '');
    }

    function appendBaiduPassword(link, password) {
        if (!/^[A-Za-z0-9]{4}$/.test(password)) {
            return link;
        }
        try {
            const url = new URL(link);
            if (url.hostname.toLowerCase() !== 'pan.baidu.com' || !url.pathname.startsWith('/s/')) {
                return link;
            }
            url.searchParams.set('pwd', password);
            return url.href;
        } catch (error) {
            return link;
        }
    }

    function normalizeBaiduLink(match) {
        const linkMatch = match.match(/https?:\/\/pan\.baidu\.com\/s\/[\w-]+(?:\?[^\s]*)?/i);
        if (!linkMatch) {
            return match;
        }
        const passwordMatch = match.match(
            /[ \t]+(?:密码|密碼|提取码|提取碼)[：:]\s*([A-Za-z0-9]{4})/,
        );
        return appendBaiduPassword(linkMatch[0], passwordMatch?.[1]);
    }

    function extractArchivePassword(name) {
        const match = name.match(/提取[码碼][^:：\r\n]*[:：]\s*([A-Za-z0-9]{4})/);
        return match?.[1] || '';
    }

    function extractLinks(texts) {
        const patterns = [
            {pattern: /^(?!.*(?:8K))ed2k:\/\/.*mp4.*/gm},
            {pattern: /^ed2k:\/\/.*8K.*mp4.*/gm},
            {pattern: /^ed2k:\/\/.*\.rar.*/gm},
            {pattern: /^hhd800\.com@.*/gm},
            {pattern: /http:\/\/(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?).*/gm},
            {pattern: /thunder:\/\/[A-Za-z0-9+/=]+/g},
            {pattern: /https:\/\/1fichier\.com\/\?\w+/g},
            {
                pattern: /https?:\/\/pan\.baidu\.com\/s\/[\w-]+(?:\?[^\s]*)?(?:[ \t]+(?:密码|密碼|提取码|提取碼)[：:]\s*[A-Za-z0-9]{4})?/gi,
                normalize: normalizeBaiduLink,
            },
        ];
        const groups = patterns.map(() => new Set());

        for (const originalText of texts) {
            const text = cleanText(originalText);
            patterns.forEach(({pattern, normalize}, index) => {
                const matches = text.match(pattern);
                if (matches) {
                    for (const match of matches) {
                        groups[index].add(normalize ? normalize(match) : match);
                    }
                }
            });
        }

        return groups
            .map((group) => [...group])
            .filter((group) => group.length)
            .map((group) => group.sort((left, right) => Number(right.includes('_8K')) - Number(left.includes('_8K'))));
    }

    function appendQrGroups(groups, qrLinks) {
        if (qrLinks.length) {
            groups.push(qrLinks.map((item) => item.trim()).filter(Boolean));
        }
        return groups.filter((group) => group.length);
    }

    class ZipArchive {
        constructor(buffer) {
            this.bytes = toUint8Array(buffer);
            this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
            this.entries = this.readCentralDirectory();
        }

        u16(offset) {
            this.assertRange(offset, 2);
            return this.view.getUint16(offset, true);
        }

        u32(offset) {
            this.assertRange(offset, 4);
            return this.view.getUint32(offset, true);
        }

        u64(offset) {
            this.assertRange(offset, 8);
            const value = this.u32(offset) + this.u32(offset + 4) * 0x1_0000_0000;
            if (!Number.isSafeInteger(value)) {
                throw new Error('ZIP 文件过大或格式不受支持');
            }
            return value;
        }

        assertRange(offset, length) {
            if (offset < 0 || length < 0 || offset + length > this.bytes.byteLength) {
                throw new Error('ZIP 文件结构损坏');
            }
        }

        findEndOfCentralDirectory() {
            const minimumOffset = Math.max(0, this.bytes.byteLength - 22 - 0xffff);
            for (let offset = this.bytes.byteLength - 22; offset >= minimumOffset; offset--) {
                if (this.u32(offset) !== 0x06054b50) {
                    continue;
                }
                const commentLength = this.u16(offset + 20);
                if (offset + 22 + commentLength <= this.bytes.byteLength) {
                    return offset;
                }
            }
            throw new Error('附件不是有效的 ZIP 文件');
        }

        readZip64Directory(endOffset) {
            const locatorOffset = endOffset - 20;
            this.assertRange(locatorOffset, 20);
            if (this.u32(locatorOffset) !== 0x07064b50) {
                throw new Error('ZIP64 目录定位信息缺失');
            }
            const directoryOffset = this.u64(locatorOffset + 8);
            this.assertRange(directoryOffset, 56);
            if (this.u32(directoryOffset) !== 0x06064b50) {
                throw new Error('ZIP64 目录结构损坏');
            }
            return {
                entryCount: this.u64(directoryOffset + 32),
                directorySize: this.u64(directoryOffset + 40),
                directoryOffset: this.u64(directoryOffset + 48),
            };
        }

        readZip64Extra(extraOffset, extraLength, values) {
            const endOffset = extraOffset + extraLength;
            let offset = extraOffset;
            while (offset + 4 <= endOffset) {
                const id = this.u16(offset);
                const size = this.u16(offset + 2);
                const dataOffset = offset + 4;
                const dataEnd = dataOffset + size;
                if (dataEnd > endOffset) {
                    break;
                }
                if (id === 0x0001) {
                    let cursor = dataOffset;
                    if (values.uncompressedSize === 0xffffffff && cursor + 8 <= dataEnd) {
                        values.uncompressedSize = this.u64(cursor);
                        cursor += 8;
                    }
                    if (values.compressedSize === 0xffffffff && cursor + 8 <= dataEnd) {
                        values.compressedSize = this.u64(cursor);
                        cursor += 8;
                    }
                    if (values.localHeaderOffset === 0xffffffff && cursor + 8 <= dataEnd) {
                        values.localHeaderOffset = this.u64(cursor);
                    }
                    return;
                }
                offset = dataEnd;
            }
        }

        getDataOffset(localHeaderOffset, compressedSize) {
            this.assertRange(localHeaderOffset, 30);
            if (this.u32(localHeaderOffset) !== 0x04034b50) {
                throw new Error('ZIP 文件头损坏');
            }
            const nameLength = this.u16(localHeaderOffset + 26);
            const extraLength = this.u16(localHeaderOffset + 28);
            const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;
            this.assertRange(dataOffset, compressedSize);
            return dataOffset;
        }

        readCentralDirectory() {
            const endOffset = this.findEndOfCentralDirectory();
            let entryCount = this.u16(endOffset + 10);
            let directorySize = this.u32(endOffset + 12);
            let directoryOffset = this.u32(endOffset + 16);
            if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
                ({entryCount, directorySize, directoryOffset} = this.readZip64Directory(endOffset));
            }
            if (entryCount > MAX_ZIP_FILES) {
                throw new Error('压缩包内文件数量过多');
            }
            this.assertRange(directoryOffset, directorySize);

            const entries = [];
            let offset = directoryOffset;
            const directoryEnd = directoryOffset + directorySize;
            for (let index = 0; index < entryCount; index++) {
                this.assertRange(offset, 46);
                if (offset + 46 > directoryEnd || this.u32(offset) !== 0x02014b50) {
                    throw new Error('ZIP 中央目录损坏');
                }

                const flags = this.u16(offset + 8);
                const compressionMethod = this.u16(offset + 10);
                const nameLength = this.u16(offset + 28);
                const extraLength = this.u16(offset + 30);
                const commentLength = this.u16(offset + 32);
                const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
                this.assertRange(offset + 46, nameLength + extraLength + commentLength);
                if (entryEnd > directoryEnd) {
                    throw new Error('ZIP 中央目录损坏');
                }

                const nameBytes = this.bytes.subarray(offset + 46, offset + 46 + nameLength);
                const values = {
                    compressedSize: this.u32(offset + 20),
                    uncompressedSize: this.u32(offset + 24),
                    localHeaderOffset: this.u32(offset + 42),
                };
                this.readZip64Extra(
                    offset + 46 + nameLength,
                    extraLength,
                    values,
                );

                const name = bytesToText(nameBytes).replace(/^\uFEFF/, '');
                entries.push({
                    name,
                    flags,
                    compressionMethod,
                    compressedSize: values.compressedSize,
                    uncompressedSize: values.uncompressedSize,
                    dataOffset: this.getDataOffset(values.localHeaderOffset, values.compressedSize),
                    isDirectory: name.endsWith('/'),
                });
                offset = entryEnd;
            }
            return entries;
        }

        async readEntry(entry) {
            if (entry.flags & 0x0001) {
                throw new Error('ZIP 附件已加密，无法解析');
            }
            const data = this.bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
            if (entry.compressionMethod === 0) {
                return data;
            }
            if (entry.compressionMethod !== 8) {
                throw new Error(`ZIP 使用了不支持的压缩方式（${entry.compressionMethod}）`);
            }
            if (typeof DecompressionStream !== 'function') {
                throw new Error('当前浏览器不支持 ZIP 解压，请升级浏览器后重试');
            }
            try {
                const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                return new Uint8Array(await new Response(stream).arrayBuffer());
            } catch (error) {
                throw new Error('ZIP 附件解压失败');
            }
        }
    }

    async function parseZipAttachment(blobData) {
        const zip = new ZipArchive(await blobToArrayBuffer(blobData));

        const texts = [];
        const qrLinks = [];
        let qrModuleError = null;
        for (const entry of zip.entries) {
            if (entry.isDirectory) {
                continue;
            }
            if (ZIP_TEXT_RE.test(entry.name)) {
                if (entry.uncompressedSize > MAX_TEXT_BYTES) {
                    continue;
                }
                const data = await zip.readEntry(entry);
                if (data.byteLength > MAX_TEXT_BYTES) {
                    continue;
                }
                texts.push(bytesToText(data));
            }
            if (getSetting('menu_qr') && !qrModuleError && ZIP_IMAGE_RE.test(entry.name)) {
                try {
                    const data = await zip.readEntry(entry);
                    const type = /\.png$/i.test(entry.name) ? 'image/png' : 'image/jpeg';
                    const qrLink = await decodeQrLink(new Blob([data], {type}));
                    qrLinks.push(appendBaiduPassword(qrLink, extractArchivePassword(entry.name)));
                } catch (error) {
                    // 普通图片不是二维码时忽略
                    if (error instanceof Error && error.message === QRCODE_LOAD_ERROR) {
                        qrModuleError = error;
                    }
                }
            }
        }
        const groups = appendQrGroups(extractLinks(texts), qrLinks);
        if (!groups.length && qrModuleError) {
            throw qrModuleError;
        }
        return groups;
    }

    async function parseRarAttachment(blobData) {
        if (typeof Unrar === 'undefined') {
            throw new Error('RAR 解析组件未加载');
        }
        const unrar = new Unrar(await blobToArrayBuffer(blobData));
        const files = unrar.getEntries();
        const texts = [];
        const qrLinks = [];
        let qrModuleError = null;

        for (const file of files) {
            if (file.unpackSize > MAX_TEXT_BYTES) {
                continue;
            }
            if (file.name.toLowerCase().endsWith('.txt')) {
                const data = unrar.decompress(file.name);
                texts.push(await new Blob([data]).text());
            }
            if (getSetting('menu_qr') && !qrModuleError && file.name.toLowerCase().endsWith('.png')) {
                try {
                    const imageBlob = new Blob([unrar.decompress(file.name)]);
                    let qrLink = await decodeQrLink(imageBlob);
                    const fileNamePassword = extractArchivePassword(file.name);
                    if (fileNamePassword) {
                        qrLink = appendBaiduPassword(qrLink, fileNamePassword);
                    } else {
                        try {
                            const password = await getRarPassword(blobData);
                            qrLink = appendBaiduPassword(qrLink, password);
                        } catch (error) {
                            // 解压服务不可用时仍保留二维码中的原始链接
                        }
                    }
                    qrLinks.push(qrLink);
                } catch (error) {
                    // 普通图片不是二维码时忽略
                    if (error instanceof Error && error.message === QRCODE_LOAD_ERROR) {
                        qrModuleError = error;
                    }
                }
            }
        }
        const groups = appendQrGroups(extractLinks(texts), qrLinks);
        if (!groups.length && qrModuleError) {
            throw qrModuleError;
        }
        return groups;
    }

    async function parseAttachment(blobData, fileName) {
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.zip')) {
            return parseZipAttachment(blobData);
        }
        if (lowerName.endsWith('.rar')) {
            return parseRarAttachment(blobData);
        }
        if (lowerName.endsWith('.txt')) {
            return extractLinks([await blobData.text()]);
        }
        throw new Error('不支持的附件格式');
    }

    async function getAttachmentBlob(state, onStage) {
        onStage('quote', '正在读取附件报价…');
        const quote = await getQuote(state.slotId);
        if (state.key !== activeState?.key) {
            return null;
        }
        state.quote = quote;
        const problem = quoteProblem(quote);
        if (problem) {
            throw new RequestError(quote.reason || 'request_failed', problem);
        }

        const cachedResource = GM_getValue('tid', null);
        const cachedVersion = GM_getValue('attach_version', null);
        const cachedData = GM_getValue('attach_data', null);
        if (cachedResource === state.resourceId && cachedVersion === quote.version_id && cachedData) {
            try {
                onStage('cache-read', '正在读取附件缓存…');
                const cachedBlob = await withTimeout(
                    dataUrlToBlob(cachedData),
                    10_000,
                    '附件缓存读取超时，将重新下载。',
                );
                if (cachedBlob.size) {
                    return {blobData: cachedBlob, quote, fromCache: true};
                }
            } catch (error) {
                GM_deleteValue('attach_data');
            }
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                onStage('claim', '正在领取下载凭证…');
                const receiptId = await claimDownload(quote);
                onStage('download', '正在下载附件…');
                const blobData = await fetchReceiptBlob(receiptId);
                if (state.key !== activeState?.key) {
                    return null;
                }
                return {blobData, quote, fromCache: false};
            } catch (error) {
                if (error instanceof RequestError && error.code === 'download_expired' && attempt === 0) {
                    onStage('claim-retry', '下载凭证已更新，正在重新领取…');
                    state.quote = await getQuote(state.slotId);
                    continue;
                }
                throw error;
            }
        }
        throw new RequestError('request_failed', '无法取得附件下载凭证。');
    }

    async function cacheAttachment(state, result) {
        try {
            const blobData = result.blobData;
            await withTimeout((async function () {
                GM_setValue('tid', state.resourceId);
                GM_setValue('attach_version', result.quote.version_id);
                GM_setValue("attach_data", await blobToBase64(blobData));
            })(), 15_000, '附件缓存保存超时。');
            console.info('[x1080x-extract] attachment cache saved');
        } catch (error) {
            console.warn('[x1080x-extract] attachment cache skipped', error);
        }
    }

    const ICON_EXTRACT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true"><path d="M75.23 33.4 320 63.1l244.8-29.7c6.7-.84 13.2 2.66 16.3 8.72l41.7 83.38c8.9 17.9-.6 39.6-19.9 45.1l-163.3 46.7c-13.9 3.9-28.8-1.9-36.2-15.2L320 63.1l-83.4 138.9c-7.4 13.3-22.3 19.1-36.2 15.2L37.07 170.6C17.81 165.1 8.28 143.4 17.24 125.5l41.7-83.38c3.03-6.06 9.56-9.56 16.29-8.72ZM321.1 128l54.8 91.4c14.9 24.8 44.6 35.7 72.5 28.6L576 211.6v166.9c0 22-15 41.2-36.4 46.6l-204.1 51c-10.2 2.6-20.8 2.6-31 0l-204.1-51C78.99 419.7 64 400.5 64 378.5V211.6l127.6 36.4c27.9 7.1 57.7-3.8 72.6-28.6L318.9 128h2.2Z"/></svg>`;
    const ICON_COPY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path d="M384 96V0H272c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h192c26.51 0 48-21.49 48-48V128h-95.1C398.4 128 384 113.6 384 96ZM416 0v96h96L416 0ZM192 352V128H48c-26.51 0-48 21.49-48 48v288c0 26.51 21.49 48 48 48h192c26.51 0 48-21.49 48-48v-80h-32c-35.3 0-64-28.7-64-64Z"/></svg>`;
    const ICON_115 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.05 10.7 4 4 0 0 0 7 18.5Zm5-10.5v7m-2.5-2.5L12 15l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    function readPageContext() {
        const pathMatch = RESOURCE_PATH_RE.exec(location.pathname);
        if (!pathMatch) {
            return null;
        }
        const firstPost = document.querySelector('#first-post');
        const attachments = firstPost?.querySelector('.attachments-section');
        const attachment = attachments?.querySelector('.attachment[data-slot-id]');
        const slotId = attachment?.dataset.slotId;
        if (!attachments || !attachment || !slotId) {
            return null;
        }
        const fileName = attachment.querySelector('.file-name')?.getAttribute('title')
            || attachment.querySelector('.file-name')?.textContent?.trim()
            || 'attachment';
        return {
            resourceId: pathMatch[1],
            slotId,
            fileName,
            attachment,
            attachments,
            key: `${pathMatch[1]}:${slotId}`,
        };
    }

    function updateButtonLabel(state, quote = state.quote, fromCache = false) {
        if (!state.label) {
            return;
        }
        if (fromCache) {
            state.label.textContent = '提取链接';
            return;
        }
        const points = Number(quote?.payable_points || 0);
        state.label.textContent = points > 0 ? `提取链接（${formatPoints(points)} 点）` : '提取链接';
    }

    function setBusy(state, busy, text = '') {
        state.button.disabled = busy;
        state.wrapper.classList.toggle('is-busy', busy);
        if (busy) {
            state.label.textContent = text || '正在提取…';
        } else {
            updateButtonLabel(state, state.quote, state.fromCache);
        }
    }

    function showOutputMessage(state, message, isError = false) {
        state.output.replaceChildren();
        const note = add_element('p', {
            class: `x1080x-extract-message${isError ? ' is-error' : ''}`,
        });
        note.textContent = message;
        state.output.appendChild(note);
    }

    function publishDebug(state) {
        window.__x1080xExtractDebug = {
            key: state.key,
            stage: state.stage,
            message: state.stageMessage,
            busy: state.busy,
            fromCache: state.fromCache,
        };
    }

    function reportStage(state, stage, message) {
        state.stage = stage;
        state.stageMessage = message;
        publishDebug(state);
        console.info(`[x1080x-extract] ${stage}: ${message}`);
        if (state.key === activeState?.key) {
            showOutputMessage(state, message);
        }
    }

    function renderLinks(state, groups) {
        state.output.replaceChildren();

        groups.forEach((group, index) => {
            const row = add_element('div', {class: 'link_copy'});
            const text = add_element('span', {class: 'txt'});
            const actions = add_element('span', {class: 'link-actions'});
            const copyButton = add_element('button', {
                class: 'icon',
                type: 'button',
                title: `点击复制${index < 4 ? `（Alt+${index + 1}）` : ''}`,
                'aria-label': `复制链接组${index < 4 ? `（Alt+${index + 1}）` : ''}`,
            });
            const copyLabel = add_element('span', {class: 'copy-label'});
            text.textContent = `${group.join('\n')}\n`;
            copyButton.innerHTML = ICON_COPY;
            copyLabel.textContent = '复制';
            copyButton.appendChild(copyLabel);
            copyButton.addEventListener('click', function () {
                copyToClipboard(text, row);
            });
            actions.appendChild(copyButton);

            if (getSetting('offline_enabled')) {
                const offlineLinks = getOfflineLinks(group);
                const offlineAvailable = offlineLinks.length > 0;
                const offlineButton = add_element('button', {
                    class: `icon x1080x-offline-button${offlineAvailable ? '' : ' is-unavailable'}`,
                    type: 'button',
                    title: offlineLinks.length
                        ? '将本组受支持的链接提交到 115 离线下载'
                        : '本组没有 115 支持的离线链接',
                    'aria-label': '115 离线下载',
                    'aria-disabled': String(!offlineAvailable),
                    'data-available': String(offlineAvailable),
                });
                const offlineLabel = add_element('span', {class: 'x1080x-offline-label'});
                offlineButton.innerHTML = ICON_115;
                offlineLabel.textContent = '115 离线';
                offlineButton.appendChild(offlineLabel);
                offlineButton.addEventListener('click', function () {
                    submitOfflineFromButton(offlineButton, offlineLinks);
                });
                actions.appendChild(offlineButton);
            }

            row.appendChild(text);
            row.appendChild(actions);
            state.output.appendChild(row);
        });
    }

    let copyToast = null;
    let copyToastTimer = null;

    function hideCopyToast() {
        clearTimeout(copyToastTimer);
        copyToastTimer = null;
        copyToast?.remove();
        copyToast = null;
    }

    function showCopyToast(text) {
        if (!copyToast || !copyToast.isConnected) {
            copyToast = add_element('div', {
                class: 'x1080x-copy-toast',
                role: 'status',
                'aria-live': 'polite',
                'aria-atomic': 'true',
            });
            const title = add_element('strong', {class: 'x1080x-copy-toast-title'});
            const link = add_element('span', {class: 'x1080x-copy-toast-link'});
            title.textContent = '复制成功';
            copyToast.append(title, link);
            document.body.appendChild(copyToast);
        }

        copyToast.querySelector('.x1080x-copy-toast-link').textContent = text;
        copyToast.classList.remove('is-visible');
        void copyToast.offsetWidth;
        copyToast.classList.add('is-visible');
        clearTimeout(copyToastTimer);
        copyToastTimer = setTimeout(hideCopyToast, 3000);
    }

    async function copyToClipboard(textElement, rowElement, {showToast = false} = {}) {
        const text = textElement.textContent.replace(/\n$/, '');
        let copied = false;
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
        } catch (error) {
            const textarea = add_element('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                copied = document.execCommand('copy');
            } catch (fallbackError) {
                copied = false;
            } finally {
                textarea.remove();
            }
        }
        rowElement.classList.add('flashBG');
        setTimeout(function () {
            rowElement.classList.remove('flashBG');
        }, 1000);
        if (showToast) {
            if (copied) {
                showCopyToast(text);
            } else {
                hideCopyToast();
            }
        }
        return copied;
    }

    async function runExtraction(state) {
        if (state.busy) {
            return state.groups;
        }
        state.busy = true;
        setBusy(state, true);
        reportStage(state, 'start', '正在准备提取附件…');
        try {
            if (state.cachePromise) {
                await state.cachePromise;
            }
            const result = await getAttachmentBlob(state, (stage, message) => {
                reportStage(state, stage, message);
            });
            if (!result || state.key !== activeState?.key) {
                return [];
            }
            state.fromCache = result.fromCache;
            if (!result.fromCache && !state.cachePromise) {
                state.cachePromise = cacheAttachment(state, result).finally(() => {
                    state.cachePromise = null;
                });
            }
            if (getSetting('menu_download')) {
                download_attach(result.blobData, state.fileName);
            }
            reportStage(state, 'parse', '正在解析附件内容…');
            const groups = await withTimeout(
                parseAttachment(result.blobData, state.fileName),
                60_000,
                '附件解析超时，请重试。',
            );
            if (!groups.length) {
                throw new Error('提取不到链接');
            }
            if (state.key !== activeState?.key) {
                return [];
            }
            state.groups = groups;
            renderLinks(state, groups);
            state.stage = 'complete';
            state.stageMessage = '';
            publishDebug(state);
            return groups;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            state.stage = 'error';
            state.stageMessage = message;
            console.error('[x1080x-extract] extraction failed', error);
            showOutputMessage(state, message, true);
            alert(message);
            return [];
        } finally {
            state.busy = false;
            setBusy(state, false);
            publishDebug(state);
        }
    }

    function refreshQuote(state) {
        getQuote(state.slotId)
            .then((quote) => {
                if (state.key !== activeState?.key) {
                    return;
                }
                state.quote = quote;
                const problem = quoteProblem(quote);
                if (problem) {
                    state.label.textContent = quote.viewer_id ? '暂不可下载' : '需登录';
                    state.button.title = problem;
                } else {
                    updateButtonLabel(state);
                }
            })
            .catch(() => {
                // 点击提取时会再次请求并显示具体错误
            });
    }

    function createUi(context) {
        const fileGet = context.attachment.querySelector('.file-get');
        const attachmentList = context.attachment.closest('.attachment-list') || context.attachment.parentElement;
        if (!fileGet || !attachmentList) {
            return null;
        }

        const wrapper = add_element('div', {class: 'x1080x-extract'});
        const button = add_element('button', {
            class: 'button secondary tool x1080x-extract-button',
            type: 'button',
        });
        const icon = add_element('span', {class: 'x1080x-extract-icon'});
        const label = add_element('span', {class: 'x1080x-extract-label'});
        icon.innerHTML = ICON_EXTRACT;
        label.textContent = '提取链接';
        button.append(icon, label);
        wrapper.appendChild(button);
        fileGet.prepend(wrapper);

        const output = add_element('div', {class: 'x1080x-extract-output'});
        attachmentList.insertAdjacentElement('afterend', output);

        const state = {
            ...context,
            wrapper,
            button,
            icon,
            label,
            output,
            quote: null,
            groups: [],
            busy: false,
            fromCache: false,
            cachePromise: null,
        };
        button.addEventListener('click', function () {
            runExtraction(state);
        });
        refreshQuote(state);
        return state;
    }

    let activeState = null;
    let reconcileTimer = null;
    let pageLoadReady = document.readyState === 'complete';

    function cleanupState() {
        if (!activeState) {
            return;
        }
        activeState.wrapper.remove();
        activeState.output.remove();
        activeState = null;
    }

    function reconcilePage() {
        if (!pageLoadReady) {
            return;
        }
        const context = readPageContext();
        if (
            activeState
            && context
            && activeState.key === context.key
            && activeState.wrapper.isConnected
            && activeState.output.isConnected
        ) {
            return;
        }

        cleanupState();
        if (!context) {
            return;
        }
        activeState = createUi(context);
        if (!activeState) {
            return;
        }
    }

    function scheduleReconcile(delay = 80) {
        clearTimeout(reconcileTimer);
        reconcileTimer = setTimeout(reconcilePage, delay);
    }

    GM_addStyle(`
        .x1080x-extract {
            display: flex;
            align-items: center;
            margin-right: 8px;
        }

        .x1080x-extract-button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }

        .x1080x-extract-button:disabled {
            cursor: wait;
            opacity: .72;
        }

        .x1080x-extract-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
        }

        .x1080x-extract-icon svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        .x1080x-extract.is-busy .x1080x-extract-icon {
            animation: x1080x-extract-spin 1s linear infinite;
        }

        .x1080x-extract.is-busy .x1080x-extract-icon svg {
            display: none;
        }

        .x1080x-extract.is-busy .x1080x-extract-icon::before {
            content: "";
            display: block;
            box-sizing: border-box;
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            opacity: .8;
        }

        .x1080x-extract-output {
            grid-column: 1 / -1;
            display: grid;
            gap: 8px;
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            margin-top: 12px;
            padding: 12px 16px 16px;
            border-top: 1px solid var(--color-line, #e4e7ec);
        }

        .x1080x-extract-message {
            margin: 0;
            padding: 10px 12px;
            color: var(--color-muted, #667085);
            background: var(--color-soft, #f7f8fa);
            border: 1px solid var(--color-line, #e4e7ec);
            border-radius: var(--radius-control, 10px);
            font-size: var(--text-meta, 13px);
            line-height: var(--leading-meta, 18px);
        }

        .x1080x-extract-message.is-error {
            color: var(--color-accent-text, #c62828);
            background: var(--color-accent-soft, #fff4f3);
            border-color: var(--color-accent-edge, #f3bbb7);
        }

        .link_copy {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 12px;
            width: 100%;
            min-width: 0;
            padding: var(--pad-row, 12px);
            background: var(--color-soft, #f7f8fa);
            border: 1px solid var(--color-line, #e4e7ec);
            border-radius: var(--radius-card, 12px);
            color: var(--color-ink, #1f2937);
            font-size: var(--text-small, 12px);
            line-height: 1.6;
            transition: background-color .2s ease, border-color .2s ease;
        }

        .link_copy:hover {
            background: var(--color-hover, #f1f3f6);
            border-color: var(--color-edge, #cfd4dc);
        }

        .link_copy .txt {
            display: block;
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: break-word;
            white-space: pre-line;
            font-family: var(--font-mono, ui-monospace, Consolas, monospace);
            font-size: var(--text-small, 12px);
            line-height: 1.6;
        }

        .link_copy .link-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
        }

        .link_copy .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            min-width: 76px;
            height: 36px;
            padding: 0 12px;
            color: var(--color-link, #315efb);
            background: var(--color-card, #fff);
            border: 1px solid var(--color-edge, #dfe3e8);
            border-radius: var(--radius-control, 10px);
            cursor: pointer;
            font: inherit;
            font-size: var(--text-meta, 13px);
            font-weight: var(--font-weight-medium, 500);
            line-height: 1;
            transition:
                background-color .16s ease,
                border-color .16s ease,
                transform .12s ease;
        }

        .link_copy .icon:hover {
            background: var(--color-hover, #f1f3f6);
            border-color: var(--color-link, #315efb);
        }

        .link_copy .icon:active {
            transform: translateY(1px);
        }

        .link_copy .icon:focus-visible {
            outline: 2px solid var(--color-link, #315efb);
            outline-offset: 2px;
        }

        .link_copy .icon:disabled,
        .link_copy .icon.is-unavailable {
            cursor: not-allowed;
            opacity: .5;
        }

        .link_copy .icon svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        .x1080x-offline-button {
            min-width: 94px;
        }

        .x1080x-offline-button svg {
            fill: none;
        }

        .x1080x-offline-button.is-busy {
            cursor: wait;
        }

        .x1080x-offline-button.is-busy svg {
            display: none;
        }

        .x1080x-offline-button.is-busy::before {
            content: "";
            display: block;
            box-sizing: border-box;
            width: 15px;
            height: 15px;
            flex: 0 0 15px;
            border: 2px solid color-mix(in srgb, currentColor 22%, transparent);
            border-top-color: currentColor;
            border-radius: 50%;
            animation: x1080x-extract-spin .8s linear infinite;
        }

        .link_copy.flashBG {
            animation: x1080x-extract-flash .85s ease-out;
        }

        .x1080x-copy-toast {
            position: fixed;
            left: 50%;
            bottom: calc(20px + env(safe-area-inset-bottom, 0px));
            z-index: 10000;
            box-sizing: border-box;
            width: min(560px, calc(100vw - 32px));
            padding: 12px 14px;
            color: var(--color-ink, #1f2937);
            background: var(--color-card, #fff);
            border: 1px solid var(--color-line, #e4e7ec);
            border-radius: var(--radius-card, 12px);
            box-shadow: 0 12px 36px rgba(15, 23, 42, .18);
            font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, 10px);
        }

        .x1080x-copy-toast.is-visible {
            animation: x1080x-copy-toast-life 3s ease-out both;
        }

        .x1080x-copy-toast-title {
            display: block;
            color: var(--color-ok, #198754);
            font-size: var(--text-meta, 13px);
            font-weight: var(--font-weight-semibold, 600);
            line-height: 1.5;
        }

        .x1080x-copy-toast-link {
            display: -webkit-box;
            margin-top: 4px;
            max-height: 4.8em;
            overflow: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
            white-space: pre-line;
            font-family: var(--font-mono, ui-monospace, Consolas, monospace);
            font-size: var(--text-small, 12px);
            line-height: 1.6;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
        }

        @keyframes x1080x-extract-spin {
            to {
                transform: rotate(360deg);
            }
        }

        @keyframes x1080x-extract-flash {
            0% {
                background: var(--color-ok-soft, #eaf8f0);
                border-color: var(--color-ok, #3dcb8a);
            }
            100% {
                background: var(--color-soft, #f7f8fa);
                border-color: var(--color-line, #e4e7ec);
            }
        }

        @keyframes x1080x-copy-toast-life {
            0% {
                opacity: 0;
                transform: translate(-50%, 10px);
            }
            12%,
            86% {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, 6px);
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .x1080x-copy-toast.is-visible {
                animation: none;
                opacity: 1;
                transform: translateX(-50%);
            }
        }

        @media (max-width: 480px) {
            .link_copy {
                grid-template-columns: minmax(0, 1fr);
                align-items: flex-start;
                gap: 8px;
                padding: 10px;
            }

            .link_copy .link-actions {
                justify-content: flex-start;
            }

            .link_copy .icon {
                min-width: 0;
                height: 34px;
                padding: 0 10px;
            }

            .x1080x-copy-toast {
                bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                width: calc(100vw - 24px);
            }
        }
    `);

    hotkeys('alt+1,alt+2,alt+3,alt+4', async function (event, handler) {
        event.preventDefault();
        if (isSettingsOpen()) {
            return;
        }
        const state = activeState;
        if (!state) {
            return;
        }
        let rows = state.output.querySelectorAll('.link_copy');
        if (!rows.length) {
            await runExtraction(state);
            rows = state.output.querySelectorAll('.link_copy');
        }
        if (!rows.length) {
            return;
        }
        const requestedIndex = Number(handler.key.replace('alt+', '')) - 1;
        const row = rows[Math.min(requestedIndex, rows.length - 1)];
        const text = row.querySelector('.txt');
        if (!text) {
            return;
        }
        const useOfflineShortcut =
            getSetting('offline_enabled')
            && getSetting('offline_auto_after_extract');
        if (useOfflineShortcut) {
            if (!row.isConnected) {
                return;
            }
            const offlineButton = row.querySelector('.x1080x-offline-button');
            if (offlineButton) {
                await submitOfflineFromButton(offlineButton, text.textContent.split('\n'));
            }
            return;
        }
        await copyToClipboard(text, row, {showToast: true});
    });

    const observer = new MutationObserver(scheduleReconcile);
    observer.observe(document.documentElement, {childList: true, subtree: true});
    window.addEventListener('popstate', scheduleReconcile);
    window.addEventListener('pageshow', function () {
        if (document.readyState === 'complete') {
            pageLoadReady = true;
        }
        scheduleReconcile(pageLoadReady ? 100 : 80);
    });
    window.addEventListener('load', function () {
        pageLoadReady = true;
        scheduleReconcile(100);
    }, {once: true});

    if (pageLoadReady) {
        scheduleReconcile(100);
    }
    })();

})();
