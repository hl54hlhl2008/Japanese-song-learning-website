# 规划任务：单句循环的手机端可靠性

## 输入（先读完再动手）
1. `docs/research/audio-loop-platforms.md` —— 事实收集结果（luna 产出，标了 [已核实]/[未验证]）
2. `src/App.jsx:1706` 的 `<audio>` 元素、`1374` 与 `1430` 附近的 seek/循环逻辑
3. 项目约束：Capacitor 8 Android 壳、Web 端也要能用、用户是语言学习者（对节拍精度敏感）

## 要求你产出的判断
不要写代码。输出一份 `docs/plans/PLAN-audio-loop.md`，内容：

### 1. 现状评估
基于 research 文档，逐条说明当前 `<audio> + timeupdate + currentTime` 方案在目标平台上
能过、不能过哪些场景。引用具体条目（写清楚依据的是 research 里的哪一条结论）。

### 2. 方案对比（至少三个）
- A. 保留 HTMLAudio，只优化循环边界（如提前量 / requestAnimationFrame 校时）
- B. 换 Web Audio：`decodeAudioData` + `AudioBufferSourceNode` 精确 start/stop
- C. 原生/插件路线（Capacitor 后台音频 + MediaSession）
每个方案给出：改动范围（哪些文件）、风险、依赖的平台事实、放弃它的理由。

### 3. 决定与理由
选一个，写清为什么，以及**如果 research 里标 [未验证] 的那几条一旦为真，结论会不会翻转**。

### 4. 任务拆解（给 Pi 执行的 spec 草稿）
3–6 个可独立验收的任务，每个含：目标、允许改的文件、验收标准（可执行命令或可观察行为）。

## 硬规则
- 只写 `docs/plans/PLAN-audio-loop.md`，不改源码
- 凡是引用平台行为，必须能指回 research 文档的某一条；research 里没有的事实，标注"需补查"
- 写清"不做什么"——明确列出这次不碰的范围
