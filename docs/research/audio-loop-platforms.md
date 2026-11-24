# 单句循环在 iOS / Android 上的可靠性：事实收集

抓取日期统一为 2026-11-18。除明确注明外，以下是文档/报告结论，不代表本项目已在真机测量。

## 1. `timeupdate` 频率与循环边界误差

- [已核实] WHATWG 将 `timeupdate` 定义为媒体播放位置更新时触发的事件；用户代理按负载调整频率，非固定节拍。[HTML Standard](https://html.spec.whatwg.org/multipage/media.html#event-media-timeupdate) —— 2026-11-18 —— HTML 媒体标准
- [已核实] MDN 给出的典型范围约为 4–66 Hz，且事件处理器不超过 250 ms；频率受系统负载及处理成本影响。[MDN: timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) —— 2026-11-18 —— 主流浏览器通用描述，非 iOS/Android 逐版本实测
- [未验证] 本次资料检索未找到对当前 iOS Safari、Android Chrome、Android System WebView/Capacitor 8 的同一测试条件下 `timeupdate` 实测频率报告；标准和 MDN 的范围不能当作各平台保证值。 —— 2026-11-18 —— iOS Safari / Android Chrome / Android WebView
- [已核实] 若边界只在 `timeupdate` 中检测，检测时刻可晚于边界；按 MDN 4 Hz 下限估计，在连续、均匀触发且无额外排队时单次检测落后约可达 250 ms。实际总越界还包括事件调度、JS 执行和 seek 完成时间，这些未由该频率范围限定。[MDN: timeupdate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) —— 2026-11-18 —— 通用上界估算，不是平台实测
- [已核实] `currentTime` 的小数位数不等于其更新频率或与实际输出音频的匹配精度；浏览器播放管线更新频率依实现而异。[MDN: currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime) —— 2026-11-18 —— HTMLMediaElement 通用说明

## 2. `currentTime` seek 精度与延迟

- [已核实] 赋值 `currentTime` 发起 seek；最终位置可以调整到媒体支持的位置，读回值是播放位置的近似值。规范/API 文档没有给出跨设备固定 seek 延迟或精度。[MDN: currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime) —— 2026-11-18 —— HTMLMediaElement 通用说明
- [已核实] seek 开始和完成分别可通过 `seeking` 与 `seeked` 事件观察；事件存在不代表完成时间有固定上限。[MDN: HTMLMediaElement events](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) —— 2026-11-18 —— 主流浏览器
- [未验证] 未找到足以支持 iOS Safari 在音频文件 seek 时必然舍入到整秒或关键帧的权威材料；本次找到的关键帧讨论主要涉及视频帧定位，不能直接推广为音频结论。 —— 2026-11-18 —— iOS Safari
- [未验证] 未找到 Android Chrome 对 HTML audio seek 固定舍入到整秒/关键帧的可靠平台报告，也未找到可复现其固定 seek 延迟的官方数据。 —— 2026-11-18 —— Android Chrome
- [未验证] 未找到 Android System WebView 对 HTML audio seek 精度/延迟的 Capacitor 8 版本实测报告；Android WebView 的版本随系统组件更新，单写“Capacitor 8”不足以指定其内核版本。 —— 2026-11-18 —— Android WebView / Capacitor 8
- [已核实] 有 Android WebView 历史视频 scrubbing 故障的社区问题记录，但对象是视频且未构成当前版本音频 seek 的测量证据。[Stack Overflow 问题讨论入口（搜索结果）](https://www.reddit.com/r/AskProgramming/comments/yes9n4) —— 2026-11-18 —— 历史 Android WebView 视频案例

## 3. iOS `<audio>` 限制

- [已核实] WebKit 的公开问题记录指出，iOS 静音状态下 Web Audio 与媒体元素的行为可能不同；记录将 Web Audio 描述为遵循静音开关的 ambient 音频，而 HTML 媒体元素走 media channel。该页面是 bug/讨论记录，不是 Apple 对全部版本的兼容承诺。[WebKit bug 252746](https://bugs.webkit.org/show_bug.cgi?id=252746) —— 2026-11-18 —— Safari 16 相关报告及后续讨论
- [已核实] WebKit 另有 Web Audio 在 iOS ringer silent 时静音的缺陷报告。[WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322) —— 2026-11-18 —— iOS Safari/WebKit 历史报告
- [已核实] WebKit 的公开项目记录报告：iOS 15 Beta 中，锁屏或 Safari 进入后台时，HTMLAudioElement 播完首段后未能接续下一段；这是特定版本回归记录，不能证明当前版本同样如此。[WebKit bug 229688](https://bugs.webkit.org/show_bug.cgi?id=229688) —— 2026-11-18 —— iOS 15 Beta 历史问题
- [已核实] Apple 文档指出 Safari 对 `<audio>` 的 `preload="metadata"` 会加载足以确定时长等信息的数据；文档中无声/静音 autoplay 例子明确针对 `<video>`，不能据此推出带声音 `<audio>` 可自动播放。[Apple: Delivering Video Content for Safari](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari) —— 2026-11-18 —— Safari 文档
- [已核实] WebKit 的自动播放说明及平台实践要求用户激活以启动有声播放；第三方说明也明确 `click`/`touchstart` user activation 要求。[MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [unmute-ios-audio README](https://github.com/feross/unmute-ios-audio) —— 2026-11-18 —— 移动 Safari / Web Audio
- [未验证] iOS Safari 或 WKWebView 在所有版本、所有锁屏/切后台情形下持续播放同一 `<audio>` 元素的保证未在本次检索中找到；WebKit 记录显示过不同版本和应用容器中的后台差异。[WebKit bug 198277](https://bugs.webkit.org/show_bug.cgi?id=198277) —— 2026-11-18 —— iOS 历史 Web App 报告

## 4. Android WebView（Capacitor 8）：焦点、后台与暂停

- [已核实] Android 音频焦点指导要求应用在失去焦点时按情形暂停或降低音量；该指导针对原生音频应用/焦点持有方，并未说明普通 WebView `<audio>` 自动获得原生后台服务。[Android: Manage audio focus](https://developer.android.com/media/optimize/audio-focus) —— 2026-11-18 —— Android 原生音频焦点 API
- [已核实] Android WebView 生命周期研究材料记载 WebView 进入 Paused 状态时，音频/视频等 WebView 资源会暂停；这是 WebView 生命周期行为说明，未专指 Capacitor 8 当前配置。[ωDroid 研究论文](https://yepangliu.github.io/files/ASE18-wDroid.pdf) —— 2026-11-18 —— Android WebView 历史研究
- [未验证] 未找到 Capacitor 8 官方文档对未配置原生后台音频能力的 WebView `<audio>` 在锁屏、切后台、进程回收时是否继续的统一保证或逐机实测。 —— 2026-11-18 —— Capacitor 8 / Android WebView
- [已核实] Android 官方背景音频说明指出，Android 17 对后台音频交互增加限制，并提及无 foreground service 的播放可能被冻结或表现不连续；该变化描述原生后台音频行为，不是 WebView 单独的逐版本实测。[Android: Background audio hardening](https://developer.android.com/about/versions/17/changes/bg-audio) —— 2026-11-18 —— Android 17 行为变更

## 5. Capacitor 8 后台音频与锁屏生态

- [已核实] Capacitor 官方插件目录将官方插件与社区插件区分，官方插件由 Capacitor Team 维护，社区插件由社区维护；未列出 Capacitor 核心自带的通用后台音频播放器能力。[Capacitor Plugins](https://capacitorjs.com/docs/plugins) —— 2026-11-18 —— Capacitor 文档
- [已核实] `@capawesome-team/capacitor-audio-player` 文档声明支持 Android、iOS、Web、后台播放、焦点管理和系统媒体控制；其兼容表列出 8.x 对应 Capacitor >=8.x，状态为 Active support。文档标明该插件需 Capawesome Insiders。[Capawesome Audio Player](https://capawesome.io/docs/sdks/capacitor/audio-player/) —— 2026-11-18 —— 插件 8.x / Capacitor 8+
- [已核实] Capawesome 文档要求 iOS 开启 Background Modes 的 Audio、AirPlay、Picture in Picture；Android 媒体会话需要注册 Media3 `MediaSessionService` 和 foreground service 相关权限。[Capawesome Audio Player](https://capawesome.io/docs/sdks/capacitor/audio-player/) —— 2026-11-18 —— 插件配置要求
- [已核实] `@capgo/capacitor-native-audio` 的 GitHub `package.json` 显示版本为 8.4.19，仓库与包仍可访问；其项目说明提供 iOS/Android 原生播放及背景播放相关能力。[GitHub repository](https://github.com/Cap-go/capacitor-native-audio), [package.json](https://github.com/Cap-go/capacitor-native-audio/blob/main/package.json) —— 2026-11-18 —— 当前仓库页面所示版本；Capacitor 8
- [已核实] `@capacitor-community/native-audio` 是社区原生音频插件，项目定位包含原生播放/预加载；本次取得的资料未证明其对 Capacitor 8 的当前兼容状态。[capacitor-community-native-audio](https://github.com/byteworks-ch/capacitor-community-native-audio) —— 2026-11-18 —— 社区插件；Capacitor 8 兼容性未确认
- [未验证] 各插件对“句子中间任意起止点、精确循环、后台期间边界回调”的支持差异，不能从一般后台播放/锁屏控制功能描述推出；未找到上述插件的统一比较或相同音频测试报告。 —— 2026-11-18 —— Capacitor 8 插件生态

## 6. `MediaSession` API

- [已核实] Media Session API 允许网页提供媒体元数据及 action handlers，以连接浏览器可访问的 OS 媒体控制；MDN 将其标记为 Limited availability，而非 Baseline。[MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) —— 2026-11-18 —— Web API
- [已核实] Can I Use 的 `metadata` 支持表显示 Safari 15 起有支持记录，但 iOS Safari 一栏标为 unknown；该表不能证明 iOS WKWebView/Capacitor 中的锁屏控制完整可用。[Can I Use: MediaSession metadata](https://caniuse.com/mdn-api_mediasession_metadata) —— 2026-11-18 —— Safari / iOS Safari 数据表
- [未验证] 本次检索未找到 Apple 官方兼容表明确确认 iOS Safari 每个 `MediaSession` action、锁屏场景和 WKWebView 行为；Safari 与内嵌 WebView 的支持不能直接等同。 —— 2026-11-18 —— iOS Safari / WKWebView
- [未验证] Android System WebView 在 Capacitor 8 中的 MediaSession API 支持及具体最低 WebView 版本，本次未取得权威版本矩阵。 —— 2026-11-18 —— Android WebView / Capacitor 8

## 7. Web Audio：`decodeAudioData` 与 `AudioBufferSourceNode`

- [已核实] `AudioBufferSourceNode.start(when, offset, duration)` 使用 `AudioContext` 时间坐标进行调度，并可指定 buffer 内 offset 和播放时长；一个 source node 只能启动一次。[MDN: start()](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start), [MDN: AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) —— 2026-11-18 —— 支持 Web Audio 的浏览器
- [已核实] Web Audio `currentTime` 按 render quantum 推进；128 帧约为 2.9 ms（44.1 kHz）或 2.7 ms（48 kHz）。这是音频调度时钟粒度描述，不等于设备声学输出端到端延迟或无缝循环保证。[MDN: BaseAudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime) —— 2026-11-18 —— Web Audio API
- [已核实] W3C 兼容资料列出 `AudioBufferSourceNode.start()` 在 iOS Safari、Chrome for Android、Android WebView 中可用；API 可用性不证明后台持续运行或本项目目标机型性能。[Web Audio API specification](https://www.w3.org/TR/webaudio-1.0/) —— 2026-11-18 —— iOS Safari / Chrome Android / Android WebView
- [已核实] `decodeAudioData()` 接收完整音频文件数据的 `ArrayBuffer`，不适用于不完整的媒体片段；结果重采样到 `AudioContext` 的采样率。[MDN: decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) —— 2026-11-18 —— Web Audio API
- [未验证] 上述文档没有在该 API 页面给出跨浏览器统一的编解码格式清单；实际可解码格式依浏览器实现/平台能力而异。本次未取得覆盖目标 iOS 与 Android WebView 版本的格式矩阵。 —— 2026-11-18 —— iOS Safari / Android WebView
- [已核实] Apple 的 iOS 静音开关相关 WebKit 记录指出 Web Audio 可受静音开关影响；因此 Web Audio API 可用与静音环境下可听见、后台可持续是不同事实。[WebKit bug 252746](https://bugs.webkit.org/show_bug.cgi?id=252746) —— 2026-11-18 —— iOS Safari/WebKit 报告
- [未验证] 未找到可验证 Web Audio buffer 循环在 Capacitor 8 的 iOS/Android 后台稳定性、句子边界无缝程度和长音频内存占用的对照实测。 —— 2026-11-18 —— Capacitor 8

## 未验证 / 有冲突的说法

- [未验证] iOS Safari 和各 Android WebView 版本的 `timeupdate` 真机频率分布、最大事件间隔、繁忙负载表现：未找到足够的逐版本公开实测数据。 —— 2026-11-18 —— iOS Safari / Android
- [未验证] 三个平台上音频 `currentTime` seek 的实际输出定位误差与 seek latency：没有可比的真机测量；“整秒/关键帧舍入”目前没有证据可归因到这些音频实现。 —— 2026-11-18 —— iOS Safari / Android Chrome / Android WebView
- [未验证] “静音开关一定会静音 iOS `<audio>`”与“只静音 Web Audio”在社区资料中说法不一。WebKit issue 记录支持两种管线可能不同行为，但属于报告与讨论；Apple 未提供覆盖当前所有 iOS 版本的明确矩阵。 —— 2026-11-18 —— iOS
- [未验证] iOS 后台播放的社区案例有成功与失败报告，且涉及 Safari、主屏幕 Web App、WKWebView、iOS 版本和音频会话等不同条件，不能合并成单一平台结论。[WebKit bug 198277](https://bugs.webkit.org/show_bug.cgi?id=198277), [WebKit bug 229688](https://bugs.webkit.org/show_bug.cgi?id=229688) —— 2026-11-18 —— iOS 历史案例
- [未验证] Media Session 在 Safari/iOS 的基础 API、各 action handler 和锁屏 UI 支持存在资料覆盖不完整的问题；当前数据表对 iOS Safari 标为 unknown，且 WebView 支持未被单独确认。 —— 2026-11-18 —— iOS Safari / WKWebView
- [未验证] 浏览器的 `decodeAudioData()` 格式支持没有一个可据此保证目标音频文件在所有 iOS/Android 目标版本可解码的单一清单；需要具体容器/编码与目标版本证据。 —— 2026-11-18 —— iOS Safari / Android WebView
