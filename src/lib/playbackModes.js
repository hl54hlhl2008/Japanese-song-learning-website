// 播放模式的纯判断：片段区间、循环可用状态、入口适用范围和按钮文案。
// 所有副作用（<audio>、React 状态）留在 App.jsx，这里只接收状态并返回结果。

export const PLAYBACK_MODE_SINGLE = 'single'
export const PLAYBACK_MODE_FROM_START = 'from-start'
export const DEFAULT_PLAYBACK_MODE = PLAYBACK_MODE_SINGLE

// 单句播放沿用原有的 0.5 秒提前量，让学习者听到完整的字头。
export const LINE_PLAYBACK_LEAD_IN_SECONDS = 0.5
// 片段至少要有 0.12 秒，避免元数据异常时零长度循环。
export const MIN_CLIP_SECONDS = 0.12
// 循环区间短于 0.3 秒时改用 5 秒回退区间，避免疯狂重播。
export const SHORT_LOOP_SECONDS = 0.3
export const LOOP_FALLBACK_SECONDS = 5
// 时长未知时单句片段最多播放 8 秒。
export const UNKNOWN_DURATION_CLIP_SECONDS = 8

export const PLAYBACK_MODE_OPTIONS = [
  { value: PLAYBACK_MODE_SINGLE, label: '单句', title: '只播放当前这一句' },
  { value: PLAYBACK_MODE_FROM_START, label: '从开头播放到当前句', title: '从音频 0 秒播放到当前句结束' },
]

export function normalizePlaybackMode(mode) {
  return mode === PLAYBACK_MODE_FROM_START ? PLAYBACK_MODE_FROM_START : PLAYBACK_MODE_SINGLE
}

export function isFromStartMode(mode) {
  return normalizePlaybackMode(mode) === PLAYBACK_MODE_FROM_START
}

// 模式只在桌面/手机网页的歌词列表里生效；逐句练习、复习和安卓客户端固定单句。
export function isPlaybackModeEntryAvailable({ isAndroid = false, practiceActive = false, page = 'lesson' } = {}) {
  return !isAndroid && !practiceActive && page === 'lesson'
}

export function resolvePlaybackMode({ isAndroid = false, practiceActive = false, page = 'lesson', mode } = {}) {
  return isPlaybackModeEntryAvailable({ isAndroid, practiceActive, page }) ? normalizePlaybackMode(mode) : DEFAULT_PLAYBACK_MODE
}

// 选择控件的文案与激活状态。
export function playbackModeSelection(mode, options = PLAYBACK_MODE_OPTIONS) {
  const selected = normalizePlaybackMode(mode)
  return options.map((option) => ({ ...option, selected: option.value === selected }))
}

// 单句循环只属于单句模式；切到新模式时禁用控件但保留用户原来的设置。
export function lineLoopControl({ mode, loop = false } = {}) {
  const available = normalizePlaybackMode(mode) === PLAYBACK_MODE_SINGLE
  const active = available && Boolean(loop)
  return {
    available,
    disabled: !available,
    active,
    pressed: active,
    label: available ? (loop ? '循环中' : '单句循环') : '循环不可用',
    title: available ? (loop ? '关闭单句循环' : '开启单句循环：当前句反复播放') : '单句循环只在「单句」播放模式下可用',
  }
}

// 歌词行播放按钮的文案与激活状态。
export function linePlaybackButton({ mode, isPlaying = false, displayNumber = '' } = {}) {
  const fromStart = isFromStartMode(mode)
  const number = displayNumber === '' || displayNumber == null ? '' : String(displayNumber)
  const target = number ? `第 ${number} 句` : '这一句'
  if (fromStart) {
    return {
      mode: PLAYBACK_MODE_FROM_START,
      active: Boolean(isPlaying),
      label: `${isPlaying ? '暂停' : '从开头播放到'}${target}`,
      title: isPlaying ? `暂停${target}` : `从开头播放到${target}，从音频 0 秒开始`,
    }
  }
  return {
    mode: PLAYBACK_MODE_SINGLE,
    active: Boolean(isPlaying),
    label: `${isPlaying ? '暂停' : '播放'}${target}`,
    title: isPlaying ? '暂停这一句' : '播放这一句',
  }
}

function finiteDuration(duration) {
  return Number.isFinite(duration) ? duration : null
}

// 单句模式沿用紧邻下一句的时间戳；新模式取目标句之后第一个严格更晚的时间戳。
// 同时间戳的句子因此共用同一个终点，末句则播到音频结束。
function nextStrictlyLaterStart(lines, lineIndex, lineStart) {
  for (let index = lineIndex + 1; index < lines.length; index += 1) {
    const start = lines[index]?.start
    if (Number.isFinite(start) && start > lineStart) return start
  }
  return null
}

/**
 * 计算一次片段播放的区间。
 * @param {{ lines: Array, lineIndex: number, mode?: string, duration?: number|null, loop?: boolean }} input
 * @returns {{ lineId: any, mode: string, lineStart: number, start: number, end: number|null, loops: boolean }|null}
 */
export function buildPlaybackClip({ lines, lineIndex, mode, duration = null, loop = false } = {}) {
  if (!Array.isArray(lines) || !Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) return null
  const line = lines[lineIndex]
  if (!line) return null
  const normalizedMode = normalizePlaybackMode(mode)
  const lineStart = Number.isFinite(line.start) ? line.start : 0
  const totalDuration = finiteDuration(duration)

  if (normalizedMode === PLAYBACK_MODE_FROM_START) {
    const laterStart = nextStrictlyLaterStart(lines, lineIndex, lineStart)
    const rawEnd = laterStart ?? totalDuration
    const end = rawEnd == null ? null : Math.max(MIN_CLIP_SECONDS, Math.min(rawEnd, totalDuration ?? rawEnd))
    return { lineId: line.id, mode: normalizedMode, lineStart, start: 0, end, loops: false }
  }

  const start = Math.max(0, lineStart - LINE_PLAYBACK_LEAD_IN_SECONDS)
  const nextStart = lines[lineIndex + 1]?.start
  const fallbackEnd = totalDuration ?? start + UNKNOWN_DURATION_CLIP_SECONDS
  let end = Math.max(start + MIN_CLIP_SECONDS, Number.isFinite(nextStart) ? nextStart : fallbackEnd)
  if (loop && end - start < SHORT_LOOP_SECONDS) end = Math.min(fallbackEnd, start + LOOP_FALLBACK_SECONDS)
  return { lineId: line.id, mode: normalizedMode, lineStart, start, end, loops: Boolean(loop) }
}
