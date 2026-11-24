# 调研任务：单句循环在 iOS / Android 上的可靠性

## 背景（只读，不要改代码）
本项目是日语歌词学习 Web 应用（Vite + React 19 + Capacitor 8），音频播放用原生
`<audio preload="metadata" src=...>` 元素（`src/App.jsx:1706`），单句循环靠
`onTimeUpdate` 回调里判断 `currentTime` 越过句末后回到句首（`src/App.jsx:1374`、`1430`）。
现在要判断：这套实现能不能在手机端（尤其 iOS Safari 与 Android WebView/Capacitor）达到
"精确、无卡顿、可后台"的单句循环。

## 你的任务
只做**事实收集**，不做技术选型、不写方案、不改任何源码。

## 必须查清的问题
1. `HTMLMediaElement.timeupdate` 事件在各平台的实际触发频率（规范说法 + 实测报告），
   以及基于它做循环边界判断会产生多大的时间误差。
2. `HTMLAudioElement.currentTime` 赋值 seek 的精度与延迟：iOS Safari、Android Chrome、
   Android WebView 分别表现如何？是否有 "seek 被舍到关键帧/整秒" 的已知问题。
3. iOS 上 `<audio>` 的限制：静音开关（mute switch）是否影响 Web Audio 与 HTMLAudio、
   自动播放策略、锁屏/切后台后的行为。
4. Android WebView（Capacitor 8）内的音频焦点、后台播放、切后台是否被暂停。
5. Capacitor 8 生态里做后台音频/锁屏控制的官方能力与社区插件现状（是否维护、是否支持 8）。
6. `MediaSession` API 在 iOS Safari 与 Android WebView 的支持情况。
7. Web Audio 路线（`decodeAudioData` + `AudioBufferSourceNode` 精确 `start/stop`）在
   上述平台的适用性，以及 `decodeAudioData` 对音频格式的要求。

## 输出
写入 `docs/research/audio-loop-platforms.md`，结构：

- 每条结论一行，格式：`结论 —— 来源 URL —— 抓取日期 —— 适用版本/平台`
- 分节对应上面 7 个问题
- 结尾一节「未验证 / 有冲突的说法」，把查不到或来源互相矛盾的列出来，不要猜
- 每条前面标 `[已核实]`（有可点开的来源支持）或 `[未验证]`

## 硬规则
- 不许凭训练记忆写 API 行为；没有来源就标 `[未验证]`
- 只允许写 `docs/research/` 目录，其他文件一律不动
- 不要给出建议或方案，只给事实
- 中文书写，专有名词保留英文原文
