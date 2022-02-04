// ==UserScript==
// @license MIT
// @name               x1080x影片预览
// @namespace    https://sleazyfork.org/zh-CN/scripts/439204-x1080x%E5%BD%B1%E7%89%87%E9%A2%84%E8%A7%88
// @version            2.6
// @description    显示影片预览图和预览影片
// @author             jasmine
// @include           /^https:\/\/.*c996\.me\/forum.php?.*tid=\d+(?!.*page=[2-9]).*$/
// @icon                 https://www.google.com/s2/favicons?domain=www.c996.me
// =============================
// @connect          javdb.com
// @connect          javbus.com
// @connect          ec.sod.co.jp
// @connect          cloudfront.net
// @connect          r18.com
// @connect          www.dmm.co.jp
// @connect          www.bing.com
// =============================
// @require            https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js
// =============================
// @resource         fancybox_css https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.css
// @require            https://cdn.jsdelivr.net/npm/@fancyapps/fancybox@3.5.7/dist/jquery.fancybox.min.js
// =============================
// @resource         videojs_css https://cdn.jsdelivr.net/npm/video.js@5.20.5/dist/video-js.min.css
// @require            https://cdn.jsdelivr.net/npm/video.js@5.20.5/dist/video.min.js
// =============================
// @resource         videojs_resolution_switcher_css https://cdn.jsdelivr.net/npm/videojs-resolution-switcher@0.4.2/lib/videojs-resolution-switcher.min.css
// @require            https://cdn.jsdelivr.net/npm/videojs-resolution-switcher@0.4.2/lib/videojs-resolution-switcher.min.js
// =============================
// @grant               GM_xmlhttpRequest
// @grant               GM_download
// @grant               GM_notification
// @grant               GM_registerMenuCommand
// @grant               GM_getResourceText
// @grant               GM_addStyle
// @grant               GM_setValue
// @grant               GM_getValue
// @grant               GM_log
// ==/UserScript==

(async function () {
    'use strict';

    // 菜单列表
    var menu_ALL = [
        ['menu_showGallery', '显示预览图', '显示预览图', true],
        ['menu_quality', '画面优先', '画面优先', true],
        ['menu_JavDB', '搜索JavDB', '搜索JavDB', true],
        ['menu_JavBus', '搜索JavBus', '搜索JavBus', true],
    ], menu_ID = [];
    for (let i = 0; i < menu_ALL.length; i++) { // 如果读取到的值为 null 就写入默认值
        if (GM_getValue(menu_ALL[i][0]) == null) {
            GM_setValue(menu_ALL[i][0], menu_ALL[i][3])
        }
        ;
    }
    registerMenuCommand();

    // 注册脚本菜单
    function registerMenuCommand() {
        if (menu_ID.length > menu_ALL.length) { // 如果菜单ID数组多于菜单数组，说明不是首次添加菜单，需要卸载所有脚本菜单
            for (let i = 0; i < menu_ID.length; i++) {
                GM_unregisterMenuCommand(menu_ID[i]);
            }
        }
        for (let i = 0; i < menu_ALL.length; i++) { // 循环注册脚本菜单
            menu_ALL[i][3] = GM_getValue(menu_ALL[i][0]);
            menu_ID[i] = GM_registerMenuCommand(`${menu_ALL[i][3] ? '✅' : '❌'} ${menu_ALL[i][1]}`, function () {
                menu_switch(`${menu_ALL[i][3]}`, `${menu_ALL[i][0]}`, `${menu_ALL[i][2]}`)
            });
        }
    }

    // 菜单开关
    function menu_switch(menu_status, Name, Tips) {
        if (menu_status == 'true') {
            GM_setValue(`${Name}`, false);
            GM_notification({
                text: `已关闭 [${Tips}] 功能\n（点击刷新网页后生效）`, timeout: 3500, onclick: function () {
                    location.reload();
                }
            });
        } else {
            GM_setValue(`${Name}`, true);
            GM_notification({
                text: `已开启 [${Tips}] 功能\n（点击刷新网页后生效）`, timeout: 3500, onclick: function () {
                    location.reload();
                }
            });
        }
        registerMenuCommand(); // 重新注册脚本菜单
    };

    // 返回菜单值
    function menu_value(menuName) {
        for (let menu of menu_ALL) {
            if (menu[0] == menuName) {
                return menu[3]
            }
        }
    }

    // 输出日志
    function log(msg) {
        GM_log("[x1080x]影片预览 " + msg);
    }

    // 根据xpath查找 一个结果
    function _xO(path, obj) {
        return obj.evaluate(path, obj, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    // 根据xpath查找 多个结果
    function _xM(path, obj) {
        var xresult = obj.evaluate(path, obj, null, XPathResult.ANY_TYPE, null);
        var xnodes = [];
        var xres;
        while (xres = xresult.iterateNext()) {
            xnodes.push(xres.textContent);
        }
        return xnodes;
    }

    // 请求
    function fetch(url, headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: url,
                method: "GET",
                headers: headers,
                //timeout: 5000,
                onload: function (r) {
                    if (r.status === 200) {
                        resolve(r.responseText)
                    } else {
                        reject("status error: " + r.status)
                    }
                },
                onerror: function (e) {
                    reject('fetch error')
                },
                ontimeout: function (e) {
                    reject('fetch timeout')
                }
            });
        })
    }

    // 检查连接
    function checkURL(url, headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: url,
                method: "HEAD",
                headers: headers,
                //timeout: 5000,
                onload: function (r) {
                    if (r.status === 200) {
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                },
                onerror: function (e) {
                    resolve(false)
                },
                ontimeout: function (e) {
                    resolve(false)
                }
            });
        })
    }

    // 下载文件
    function download(url, filename, headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"}) {
        return new Promise((resolve, reject) => {
            GM_download({
                url: url,
                name: filename,
                saveAs: false,
                headers: headers,
                //timeout: 5000,
                onload: function (r) {
                    if (r.status === 200) {
                        resolve(r.responseText)
                    } else {
                        reject("download status error: " + r.status)
                    }
                },
                onerror: function (e) {
                    reject('download error')
                },
                ontimeout: function (e) {
                    reject('download timeout')
                }
            });
        })
    }

    // 格式化页面
    function parseResponse(html) {
        const parser = new DOMParser()
        const tree = parser.parseFromString(html, "text/html")
        return tree
    }

    // 从javdb查询预览图
    async function fetchJavDB() {
        log("JavDB: 开始搜索预览图")
        try {
            const content = await fetch("https://javdb.com/search?q=" + videoId + "&f=all")
            const tree = parseResponse(content)
            const secUrls = _xM("//*[@id='videos']/div/div/a/@href", tree);
            const ids = _xM("//*[@id='videos']/div/div/a/div[contains(@class, 'uid')]/text()", tree);
            const index = ids.indexOf(videoId);
            if (index === -1) {
                log("JavDB: 没有视频资料");
                return false
            }
            const secUrl = secUrls[index];
            const url = "https://javdb.com" + secUrl;
            const secContent = await fetch(url)
            const secTree = parseResponse(secContent)
            const gallery = _xM("//div[@class='tile-images preview-images']/a[@class='tile-item']/@href", secTree);
            if (gallery.length === 0) {
                log("JavDB: 可能没有预览图");
                return false
            }
            return gallery;
        } catch (e) {
            log("JavDB: 搜索失败" + e);
            return false
        }
    }

    // 从JavBus查询预览图
    async function fetchJavBus() {
        log("JavBus: 开始搜索预览图")
        try {
            const content = await fetch("https://www.javbus.com/" + videoId)
            const tree = parseResponse(content)
            var gallery = _xM("//a[@class='sample-box']/@href", tree);
            if (gallery.length === 0) {
                log("JavBus: 可能没有预览图");
                return false
            }
            return gallery;
        } catch (e) {
            log("JavBus: 搜索失败" + e);
            return false
        }
    }

    // 从SOD查询预览图
    async function fetchSOD() {
        log("SOD: 开始搜索预览图")
        try {
            const content = await fetch("https://ec.sod.co.jp/prime/videos/?id=" + videoId)
            const tree = parseResponse(content)
            const ageCheck = _xM("//div[@class='pkg_age']", tree);
            if (ageCheck.length != 0) {
                GM_notification({
                    text: "点击打开SOD官网获取预览图",
                    timeout: 3000,
                    onclick: function () {
                        window.open("https://ec.sod.co.jp/prime")
                    }
                });
                return false;
            }
            const gallery = _xM("//div[@class='img-gallery']//img/@src", tree);
            if (gallery.length === 0) {
                log("SOD: 可能没有预览图")
                return false;
            }
            return gallery
        } catch (e) {
            log("SOD: 搜索失败" + e)
            return false
        }
    }

    // 查询预览影片
    async function fetchVideo() {
        log("R18: 开始搜索预览影片")
        try {
            let word = videoId.replace('-', '+')
            const content = await fetch(`https://www.r18.com/common/search/searchword=${word}/`)
            const tree = parseResponse(content)
            let video_tag = tree.querySelector(`li[data-content_id$='${videoId.split('-')[1]}']`).querySelector('.js-view-sample');
            let video_quality = ['high', 'med', 'low']
            let video_label = ['高清', '清晰', '流畅']
            let video_res = ['1500', '1000', '300']
            let video_src = video_quality
                .map(i => video_tag.getAttribute('data-video-' + i))
                .map(function (item, index) {
                    return {
                        src: item,
                        type: 'video/mp4',
                        label: video_label[index],
                        res: video_res[index]
                    }
                })
                .filter(item => item.src !== null)
            let vr_src = video_tag.getAttribute(`data-vr-url`)
            if (vr_src !== null) {
                video_src.push({src: vr_src, type: 'video/mp4', label: `VR`, res: `3000`})
            }
            if (video_src.length !== 0) {
                const regex = /^(.*_)([a-z]+)(_w)/i;
                if (video_src[0].src.match(regex)) {
                    const highest = video_src[0].src.replace(regex, '$1mhb$3')
                    let res = await checkURL(highest)
                    if (res) {
                        video_src.push({src: highest, type: 'video/mp4', label: `HD`, res: `3000`})
                    }
                }
                return video_src
            }
            log("R18: 可能没有预览影片")
            return false;
        } catch (e) {
            log("R18: 搜索失败" + e)
            return false;
        }
    }

    async function fetchVideoDMM() {
        let includesEditionNumber = (str) => {
            return str != null
                // && str.includes(this.editionNumber.toLowerCase().split('-')[0])
                && str.includes(this.editionNumber.toLowerCase().split('-')[1]);
        }
        let content = await fetch(`https://www.bing.com/search?q=${videoId}+site%3awww.dmm.co.jp`)
        let pattern = /(cid=[\w]+|pid=[\w]+)/g;
        log(content.match(pattern))
        let dmmCid = '';
        for (let match of content.match(pattern)) {
            if (includesEditionNumber(match)) {
                dmmCid = match.replace(/(cid=|pid=)/, '');
                break;
            }
        }

        if (dmmCid == '') {
            return;
        }

        content = await fetch(`https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${dmmCid}/mtype=AhRVShI_/service=litevideo/mode=/width=560/height=360/`, {"accept-language": "ja-JP,ja;q=0.9"})
        tree = parseResponse(content)
        let dmm_pattern = /(const args = |const params = )(.*);/g;
        // Very hacky... Didn't find a way to parse the HTML with JS.
        for (let script of tree.getElementsByTagName('script')) {
            if (script.innerText != null && script.innerText.includes('.mp4')) {
                for (let line of script.innerText.split('\n')) {
                    let result = dmm_pattern.exec(line)
                    if (result) {
                        line = result[result.length - 1]
                        let videoSrc = JSON.parse(line).src;
                        if (!videoSrc.startsWith('http')) {
                            videoSrc = 'http:' + videoSrc;
                        }
                        return videoSrc;
                    }
                }
            }
        }
    }

    // 获取影片标题
    function getTitle() {
        const ori_title = _xO("//*[@id='pt']/div[2]", document).textContent;
        const title = ori_title.split(" ?").slice(-1)[0].trim();
        return title;
    }

    // 获取影片ID
    function getVideoId(title) {
        const regex = /[A-Z]+-\d+/g;
        const id = title.match(regex);
        return String(id);
    }

    // 插入预览图
    function insertImages(item) {
        const a = document.createElement("a");
        const img = document.createElement("img");
        a.href = item;
        a.setAttribute("data-fancybox", "gallery");
        a.setAttribute("class", "ga-box");
        img.setAttribute("class", "auto-img");
        img.src = item;
        a.appendChild(img);
        gallery_div.appendChild(a);
    }

    // 插入预览视频
    function insertVideo() {
        player.updateSrc(video)
    }

    //下载预览图
    async function downloadSODImages(gallery, headers) {
        for (let index = 0; index < gallery.length; index++) {
            try {
                await download(gallery[index], gallery[index], headers);
            } catch (e) {
                console.log(e)
            }
        }
    }

    //访问预览图
    async function accessSODImages(gallery, headers) {
        for (let index = 0; index < gallery.length; index++) {
            try {
                await fetch(gallery[index], headers);
            } catch (e) {
                console.log(e)
            }
        }
    }

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
    //console.log(obj["bitrates"]); // Prints [ '#with', '#hashtags' ]
    //return false
    // 基础div
    const node = _xO("//div[@class='t_fsz']/table/tbody", document);
    if (node == null || !menu_value("menu_showGallery")) {
        return false;
    }
    // 封面
    const cover = _xO("//div[@class='t_fsz']//img/@src", document).textContent;
    // 预览容器
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    const gallery_div = document.createElement("div")
    td.appendChild(gallery_div)
    tr.appendChild(td)
    gallery_div.setAttribute("class", "gallery");
    const ga_inner = document.createElement('span');
    gallery_div.appendChild(ga_inner)
    node.appendChild(tr)
    // 播放容器
    const play_box = document.createElement("a");
    play_box.setAttribute("class", "ga-box play-box");
    play_box.setAttribute("data-fancybox", "");
    gallery_div.insertBefore(play_box, gallery_div.firstChild);
    // 视频封面
    const poster = document.createElement("img");
    poster.setAttribute("class", "auto-img");
    poster.src = cover
    const span = document.createElement("span");
    span.innerHTML = '預告片'
    play_box.appendChild(span);
    play_box.appendChild(poster);
    // 播放器
    const video_player = document.createElement("video");
    video_player.setAttribute("id", "censor-player");
    video_player.setAttribute("class", "video-js  vjs-default-skin");
    play_box.append(video_player)
    const options = {
        controls: true,
        responsive: true,
        plugins: {
            videoJsResolutionSwitcher: {
                default: menu_value('menu_quality') ? `high` : `low`, // Default resolution [{Number}, 'low', 'high'],
                dynamicLabel: true
            }
        },
    };
    // 点击弹出播放器
    play_box.onclick = function (e) {
        e.preventDefault();
        video_player.setAttribute("style", "display:block");
        $.fancybox.open({
            src: '#censor-player',
            type: 'inline',
            opts: {
                smallBtn: false,
                touch: false,
                afterShow: function (instance, current) {
                    player.play();
                },
                afterClose: function (instance, current) {
                    player.pause();
                }
            }
        });
    }
    var player = videojs("censor-player", options, function () {
    });
    // 加载fancybox样式
    const fancybox_css = GM_getResourceText("fancybox_css");
    GM_addStyle(fancybox_css);
    // 加载video-js样式
    const videojs_css = GM_getResourceText("videojs_css");
    GM_addStyle(videojs_css);
    // 加载videojs-resolution-switcher样式
    const videojs_resolution_switcher_css = GM_getResourceText("videojs_resolution_switcher_css");
    GM_addStyle(videojs_resolution_switcher_css);
    // 自定义样式
    let btn_img = `PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iNTEycHgiIGhlaWdodD0iNTEycHgiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogICAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA1Mi4xICg2NzA0OCkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgICA8dGl0bGU+YnRuLXBsYXk8L3RpdGxlPgogICAgPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CiAgICA8ZyBpZD0iUGFnZS0xIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iYnRuLXBsYXkiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yNTYsMCBDMTE0Ljg0MzU0OSwwIDAsMTE0Ljg0MzU0OSAwLDI1NiBDMCwzOTcuMTU2NDUxIDExNC44NDM1NDksNTEyIDI1Niw1MTIgQzM5Ny4xNTY0NTEsNTEyIDUxMiwzOTcuMTU2NDUxIDUxMiwyNTYgQzUxMiwxMTQuODQzNTQ5IDM5Ny4xNTY0NTEsMCAyNTYsMCBaIiBpZD0iU2hhcGUiIGZpbGw9IiMwQTVFRTAiPjwvcGF0aD4KICAgICAgICAgICAgPHBvbHlnb24gaWQ9IlBhdGgiIGZpbGw9IiNGRkZGRkYiIHBvaW50cz0iMTkyIDM4My45OTcyODUgMTkyIDEyNy45OTkwOTUgMzg0IDI1NS45OTcyODUiPjwvcG9seWdvbj4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==`
    GM_addStyle(`
        .gallery {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            margin-top: 10px;
            max-width: 95%;
        }
        .ga-box {
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
        .ga-box .auto-img {
            position: relative;
            height: 120px;
        }
        .play-box {
            display: none;
            position: relative;
        }
        .play-box span {
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
        .play-box:after {
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
        .play-box:hover::after {
            background-color: rgba(33,156,239,0);;
        }
        #censor-player {
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

    // 缓存图片
    var cacheImage = false

    // 获取影片信息
    const title = getTitle();
    log('标题：' + title);
    const videoId = getVideoId(title);
    log("视频ID：" + videoId);
    if (videoId === 'null') {
        return false
    }
    var gallery = null
    if (menu_value("menu_JavDB")) {
        gallery = await fetchJavDB(videoId)
    } else if (menu_value("menu_JavBus")) {
        gallery = await fetchJavBus(videoId)
    }
    if (!gallery && title.indexOf('(SOD)') != -1) {
        gallery = await fetchSOD(videoId)
        cacheImage = true
    }

    if (gallery) {
        //log("gallery: " + gallery)
        ga_inner.innerHTML = "正在加载预览图..."
        if (cacheImage) {
            try {
                await accessSODImages(gallery, {"referer": "https://ec.sod.co.jp/prime/videos/?id=" + videoId})
            } catch (e) {
                return false
            }
        }
        ga_inner.innerHTML = ""
        gallery.forEach(insertImages)
    }

    const video = await fetchVideo()
    if (video) {
        play_box.setAttribute("style", "display:inline-block");
        insertVideo(video)
    }

    if (!gallery && !video) {
        gallery_div.style.display = "none"
    }
    //$.fancybox.defaults.loop = "true";
})();