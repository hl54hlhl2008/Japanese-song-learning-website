# UTA 网页端开发交接

更新日期：2026-11-22（Asia/Shanghai）
用途：接手者同步仓库后，了解当前网页端能力、代码入口和后续开发顺序。

## 1. 先读这里

本仓库**只维护网页端**：Vite + React 前端 + 本机 FastAPI 服务。安卓（Capacitor）与 Windows 一键安装已移除，仓库不再包含 `android/` 工程、`.cmd` 启动脚本，也不再依赖任何 `@capacitor/*` 包。

产品方向：界面简洁干净，歌曲、歌词、学习记录和个人资料保存在本机浏览器；没有账号登录和账号同步。

**重要现状：** 仓库里仍保留了一批原安卓端的界面组件（`Android*.jsx`、`ComputerImportDialog.jsx`）和 `IS_ANDROID_APP` 平台分支。这些分支通过 [src/lib/capacitorShim.js](src/lib/capacitorShim.js) 恒为 false，因此**在网页上永不渲染**。也就是说：跟唱页、问 AI 历史对话、个人资料、WebDAV 云备份、应用内更新这些能力，代码在仓库里但网页当前用不到。把它们接进网页是本仓库的主要待办，不是重新开发。

## 2. 项目结构与启动

| 入口 | 作用 |
| --- | --- |
| [README.md](README.md) | 安装、启动与使用说明 |
| [src/App.jsx](src/App.jsx) | 应用状态、音频播放、导入、学习、页面分支；大部分功能在这里串联 |
| [src/components](src/components) | 学习、歌曲库、资料、对话、设置等组件 |
| [src/lib](src/lib) | 注音、AI、歌词编辑、本地存储、备份等逻辑 |
| [src/lib/capacitorShim.js](src/lib/capacitorShim.js) | 原生平台判断与 HTTP 的浏览器实现；仅服务历史分支 |
| [server/app.py](server/app.py) | 网页 Python API：注音、词句解析、读音复核、封面检索等 |
| [vite.config.js](vite.config.js) | 网页构建 |

启动：

```bash
npm install
python3 -m venv server/.venv
server/.venv/bin/python -m pip install -r server/requirements.txt
npm run dev
```

网页 `http://localhost:5173`，注音 API `http://127.0.0.1:8000`，可通过 `VITE_ANNOTATION_API_URL` 配置。

Python 使用项目 `server/.venv`。验证脚本如不需要缓存，使用 `server/.venv/bin/python -B`，避免用其他 Python 环境生成缓存。

**平台判断提醒：** `IS_ANDROID_APP` / `Capacitor.isNativePlatform()` 在本仓库恒为 false，不要去修改这个布尔值来“打开”安卓界面。正确做法是把对应功能按网页布局重写入口，再删掉平台条件。

## 3. 当前功能状态

“可用”表示网页上实际能用到；“待接入”表示代码存在但被平台条件关闭。

| 功能 | 网页当前状态 |
| --- | --- |
| 主导航 | 可用：顶部发音学习、歌曲库、复习及设置 |
| 逐句学习 | 可用：播放、倍速、掌握状态、复习清单 |
| 跟唱 | 待接入：`AndroidSingAlong.jsx` 为参考实现，播放函数已在 App.jsx |
| 逐句播放手势 | 可用：点击播放、再点暂停、再点从句首重播（窄屏触控） |
| 歌曲封面与选歌 | 部分可用：网页原有选歌可用，新封面选歌弹层待接入 |
| 歌曲库 | 可用：搜索、导入、删除、封面操作；网格/列表切换待接入 |
| 歌曲详情编辑 | 可用表单组件，网页入口需确认 |
| 单句歌词与读音编辑 | 可用逐词读音校正；整句编辑入口待接入 |
| 学习文字展示 | 可用：原文、注音、遮住读音、罗马音切换 |
| 本地导入 | 可用：直接导入或后台生成 AI 解析 |
| 音频识别与歌词搜索 | 可用：MP3 ID3 优先，失败按文件名推断 |
| 音乐网站搜索 | 可用：LRCLIB 同步歌词可选，其他站点打开搜索页 |
| 多渠道封面 | 可用：Apple Music、网易云、QQ、酷狗，经本机后端请求 |
| 链接导入（网易云单曲） | 可用：`/api/library/import` 后台任务 |
| 问 AI | 部分可用：歌词选词/整句解析；历史对话入口待接入，且 `server/app.py` 尚无聊天路由 |
| AI 联网查询 | 待接入：`mobileWebSearch.js` 为原生协议参考，需后端适配 |
| 个人资料 | 待接入：`ProfilePanel.jsx` 与裁剪逻辑可复用 |
| 数据备份导出/恢复 | 可用：`设置 → 数据管理` 的本地备份 |
| WebDAV 云备份 | 待接入：原生插件已移除，需网页传输方案 |
| 应用内更新 | 不适用：网页部署不需要，`AppUpdates.jsx` 仅存历史代码 |

### 服务分工

- 注音由本机 Python SudachiPy 提供，人工校正优先。
- 网页 AI 通过 `annotationApi.js` 调用 Python API，支持服务端默认配置与用户自定义配置。
- 浏览器端日语分词（`@faanau/kuromoji`）仅用于历史离线分支，正常网页路径不走它。

## 4. 建议开发顺序与代码入口

### 阶段一：歌曲库与歌曲编辑

参考：[AndroidSongLibrary.jsx](src/components/AndroidSongLibrary.jsx)（仅参考布局）、[SongDetailsEditor.jsx](src/components/SongDetailsEditor.jsx)、[localSongStore.js](src/lib/localSongStore.js)、`App.jsx` 的 `removeImportedSong`、`saveSongDetails`。

建议提炼通用展示组件：桌面提供可见的三点菜单，触屏支持长按。本机导入歌曲可编辑/删除，项目文件夹歌曲与原创示例的权限须区分。

验收：网格/列表切换与刷新记忆；搜索；编辑保存后刷新仍有效；换音频后播放正确；改歌词后按现有规则更新对应进度/解析，不影响其他歌曲。

### 阶段二：逐句编辑、跟唱与最近学习

参考：[AndroidSingAlong.jsx](src/components/AndroidSingAlong.jsx)、[AndroidLessonHeader.jsx](src/components/AndroidLessonHeader.jsx)（仅参考）、[LyricLineEditor.jsx](src/components/LyricLineEditor.jsx)、[lyricEditing.js](src/lib/lyricEditing.js)、[AnnotatedLine.jsx](src/components/AnnotatedLine.jsx)、`App.jsx` 的 `startContinuousPlayback`、`playSingAlongFromLine`、`handleLyricRowClick`、`saveEditedLyric`。

跟唱复用现有播放器；切歌/切模式时取消旧的逐句停止任务；用户暂停后重播当前句并继续往后，不能意外回到整曲开头。逐句与跟唱共用歌词编辑和读音修正数据，不另复制修正表。

验收：从头唱、从任意句唱、暂停重播、连续越过句末、音频结束；人工修正即刻在两模式一致显示，刷新后仍一致。

### 阶段三：问 AI、历史对话与联网

参考：[LyricChatHistory.jsx](src/components/LyricChatHistory.jsx)、[lyricChat.js](src/lib/lyricChat.js)、[lyricChatStore.js](src/lib/lyricChatStore.js)、[aiSettings.js](src/lib/aiSettings.js)、[mobileAi.js](src/lib/mobileAi.js)（协议参考）、[mobileWebSearch.js](src/lib/mobileWebSearch.js)。

**明确缺口：** `server/app.py` 没有 `/api/ai/lyric-chat` 路由，聊天组件直接调 `postMobileAi`。接入网页前应提供网页请求适配层，并在 Python 后端实现聊天与联网协议，复用既有供应商配置验证。返回结构保持 `{ answer, sources?, searchUsed? }`。

联网开关与设置共享，切换不清空 API Key；来源链接仅接受 HTTP(S)；歌词与网页内容作为数据，不作为执行指令。默认关闭联网。

验收优先用模拟供应商：上下文正确、历史刷新仍存在、续问含前次消息、删除确认、取消请求、开关双向同步、来源可查看。

### 阶段四：个人资料与设置

参考：[ProfilePanel.jsx](src/components/ProfilePanel.jsx)、[localProfile.js](src/lib/localProfile.js)、[SettingsDialog.jsx](src/components/SettingsDialog.jsx)。

昵称和头像存本地，不增加登录。头像 Blob 存 IndexedDB，大 GIF 不能塞 localStorage。静态图裁到 512×512；GIF 保存原始帧与裁剪参数，不能经 Canvas 转静态图。上传上限 10 MB、4000 万像素；支持 JPG/PNG/WebP/GIF。

桌面歌词是否允许选词属于独立选择，不要把整页 `user-select:none` 套到网页上。

### 阶段五：网页 WebDAV 备份

参考：[WebDavPanel.jsx](src/components/WebDavPanel.jsx)、[webDav.js](src/lib/webDav.js)、[WebDavAutoSync.jsx](src/components/WebDavAutoSync.jsx)、[webDavSchedule.js](src/lib/webDavSchedule.js)、[cloudBackup.js](src/lib/cloudBackup.js)、[cloudData.js](src/lib/cloudData.js)。

传输方案需先确定：允许跨域的 WebDAV 直连，或经本机 Python 代理。多数服务不能假定允许浏览器跨域。若做代理，限定目标地址与协议，避免任意访问内网；生产部署需鉴权，不能成为公开代理。凭据不得进入日志、代码或文档。

产品规则：上传新备份不覆盖旧快照；下载先校验/预览，用户确认后恢复；API Key 默认排除；WebDAV 密码永不进入备份；恢复失败回滚本机数据。

自动同步默认关闭、默认 86400 秒、只接受 0/正整数；只在页面可见时检查，不是关掉页面仍运行的后台任务。

### 阶段六：版本提示

网页可显示自身构建版本，并对新部署提供刷新提示。不要让网页用户下载 APK 来“更新网页”，也不要在编辑歌词/导入时强制刷新。未采用 Service Worker/PWA 流程时不应宣称支持。

## 5. 数据与兼容约定

| 数据 | 当前位置 / 结构 |
| --- | --- |
| 本机导入歌曲及音频 | `localSongStore.js`，IndexedDB；保留歌曲 ID 与 line ID |
| 学习记录、读音修正、单句编辑 | `uta-pronunciation-progress-v2`；以 learningBackup 校验结构为准 |
| 注音、整曲 AI 复核、逐句解析、封面覆盖 | `learningBackup.js` 的 `BACKUP_STORAGE_KEYS` |
| 昵称及头像参数 | `uta-local-profile-v1`；头像 Blob 在 `uta-profile-assets` / `avatars` |
| 历史对话 | `uta-lyric-chats` / `sessions`，含歌曲上下文与 messages |
| AI 配置 | `uta-ai-provider-v1`；密钥单独保存，浏览器显式记住为明文本地存储，不能称为系统加密 |
| 最近歌曲 | `uta-recent-learn-v1`、`uta-recent-sing-v1` |
| 本地学习备份 | `UTA-LEARNING-BACKUP` 格式 |
| 完整云备份 | `UTA-CLOUD-BACKUP` 格式；包裹学习备份、资料、头像、对话和可选 AI Key |

修改存储结构需兼容已有数据，先备份再做迁移；不要为方便开发清空 IndexedDB。人工修正的映射不能只凭数组索引或歌曲排序猜测。

## 6. 验证与协作检查

```bash
npm run build
node --test tests/*.test.mjs
server/.venv/bin/python -m unittest discover -s server/tests
```

构建会运行歌词同步，注意本机生成的 `src/data/songs.generated.js` 不应误提交。联调至少覆盖桌面与窄屏触屏、刷新后的存储、断网、取消操作、异常提示与音频时序。AI/WebDAV 先用模拟服务或原创测试数据。

协作要求：

- 修改现有实现时，除非负责人要求删除，保留旧实现作注释对照；新增或修改的代码加中文说明。
- 分享或推送前核对 README 与当前功能、安装步骤一致。
- 不提交 API Key、WebDAV 密码、浏览器数据、个人头像原件、商业歌曲或本机生成歌曲数据。
- 不必再构建安卓包，也没有 Windows 启动脚本；验证以网页构建与测试为准。推送与公开发布按负责人授权执行。

## 7. 建议首次接手产出

1. 对照第 3 节运行网页，确认可用与待接入的真实边界。
2. 给出把「待接入」功能落到网页的布局方案与首期清单。
3. 优先完成歌曲库编辑和跟唱，再接入有后端缺口的问 AI。
4. 每完成一阶段更新第 3 节状态，补充验收结果与未完成项。
