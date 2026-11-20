# 网页歌词列表播放任务表

## 全局约束

- 本表归档已验收的功能与修复。后续实施须等用户确认。每项只能修改自己的白名单文件。
- 功能改动前基线为 53 项全绿。功能提交后基线为 63 项全绿，修复提交后为 64 项全绿，构建通过。
- 浏览器验收可在独立验证目录运行 `npm run lyrics:sync && npm run web -- --host 127.0.0.1`，用 15 秒测试音频和从 2、6、11 秒开始的三行 LRC。

## T1 · 网页歌词列表选择播放模式

**目标**　用户可在桌面和手机网页的歌词列表切换「单句」与「从开头播放到当前句」，用原有歌词播放入口按所选模式播放。

**可修改文件白名单**　`src/App.jsx`、`src/lib/playbackModes.js`、`src/styles.css`、`tests/playbackModes.test.mjs`。

**可执行验收命令**

- `node --test tests/playbackModes.test.mjs`，验证播放区间、同时间戳、末句、未知时长、循环和按钮状态。
- `node --test tests/*.test.mjs`，原有 53 项与新增测试全部通过。
- 在测试素材上播放第 2 句，新模式从 0 秒播到 11 秒。同一句暂停后从 0 秒重播，末句播到文件结束。返回单句模式后循环偏好恢复。

**依赖**　无，从 `fdfbdea` 基线开始。

## R1 · 元数据等待期间的开关即时生效

**目标**　单句等待音频元数据时切换循环开关，首个片段按最新选择播放。

**可修改文件白名单**　`src/App.jsx`。

**可执行验收命令**

- `node --test tests/*.test.mjs` 与 `npm run build`，原有 63 项全部通过，构建退出码为 0。
- 在 `ae292bf` 和修复版本加载测试素材，设为单句并等音频就绪。在浏览器控制台执行 `window.testAudio = document.querySelector('audio'); Object.defineProperty(testAudio, 'readyState', { configurable: true, value: 0 }); testAudio.load = () => {}`。点第二句后切换循环，再执行 `delete testAudio.readyState; delete testAudio.load; testAudio.dispatchEvent(new Event('loadedmetadata')); delete window.testAudio`。
- 分别验证「开→关」和「关→开」。旧版两个方向均使用旧值。修复版「开→关」到 11 秒停止并清除播放标记，「关→开」跳回约 5.5 秒且保留标记。

**依赖**　T1 交付的网页片段播放与待播请求。

## R2 · 极短音频终点受文件时长限制

**目标**　已知音频时长不足 0.12 秒时，新模式的播放终点截断到实际音频时长。

**可修改文件白名单**　`src/lib/playbackModes.js`、`tests/playbackModes.test.mjs`。

**可执行验收命令**

- `node --test tests/playbackModes.test.mjs`，覆盖 0、0.08、0.119、0.12、0.121 秒的末句，终点各等于时长。音频 0.08 秒且下一句在 0.05 秒时终点为 0.08 秒。普通音频继续使用 0.12 秒下限，未知时长的末句自然结束。
- `node --test tests/*.test.mjs` 与 `npm run build`，原有 63 项、新增用例及构建均通过。

**依赖**　T1 交付的新模式区间计算。

## R3 · 播放提示符合实际点击入口

**目标**　用户可从提示得知桌面通过行内按钮起播，手机网页也可点击整句。

**可修改文件白名单**　`src/App.jsx`。

**可执行验收命令**

- `node --test tests/*.test.mjs` 与 `npm run build`，原有 63 项及构建均通过。
- 启动网页后，在 651 px 视口点击第 2 句正文，只选中该句。点击行内按钮，从 0 秒起播。停止播放，再在 650 px 视口点正文，从 0 秒起播。两个视口的提示都明确整句点击适用于手机网页。

**依赖**　T1 交付的文案与列表入口。同一 worktree 中在 R1 验收后执行，两项共用 `src/App.jsx`。

## 记账

| 既有缺陷 | 触发条件 | 现象及影响 |
| --- | --- | --- |
| 单句同时间戳 | 两句都从 6 秒开始，选靠前一句并开启单句循环。 | 反复播放 5.5–6 秒的句前音频。 |
| 越界末句循环 | 音频长 15 秒，末句标为 16 秒，开启单句循环。 | 计算起点 15.5 秒、终点 15 秒，到音频末尾时尝试回到越界起点。 |
| 暂停时旧播放结果恢复标记 | A 正在播放，点 B 后其 `play()` 尚未返回，再点仍显示正在播放的 A。 | 暂停后，B 的迟到结果可能重新显示播放标记。 |
