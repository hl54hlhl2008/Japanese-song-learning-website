import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPlaybackClip,
  DEFAULT_PLAYBACK_MODE,
  isPlaybackModeEntryAvailable,
  LINE_PLAYBACK_LEAD_IN_SECONDS,
  lineLoopControl,
  linePlaybackButton,
  normalizePlaybackMode,
  PLAYBACK_MODE_FROM_START,
  PLAYBACK_MODE_OPTIONS,
  PLAYBACK_MODE_SINGLE,
  playbackModeSelection,
  resolvePlaybackMode,
} from '../src/lib/playbackModes.js'

// 本地验收音频约 15 秒，三行歌词分别从 2、6、11 秒开始。
const LINES = [
  { id: 'a', start: 2 },
  { id: 'b', start: 6 },
  { id: 'c', start: 11 },
]
const DURATION = 15

test('default、未知模式与入口判断回到单句', () => {
  assert.equal(DEFAULT_PLAYBACK_MODE, PLAYBACK_MODE_SINGLE)
  for (const mode of [undefined, null, '', 'broken', 'FROM-START']) {
    assert.equal(normalizePlaybackMode(mode), PLAYBACK_MODE_SINGLE)
  }
  assert.equal(normalizePlaybackMode(PLAYBACK_MODE_FROM_START), PLAYBACK_MODE_FROM_START)

  // 模式只由网页歌词列表入口启用：安卓、逐句练习和复习仍固定单句。
  assert.equal(isPlaybackModeEntryAvailable({ page: 'lesson' }), true)
  assert.equal(isPlaybackModeEntryAvailable({ page: 'lesson', practiceActive: true }), false)
  assert.equal(isPlaybackModeEntryAvailable({ page: 'lesson', isAndroid: true }), false)
  assert.equal(isPlaybackModeEntryAvailable({ page: 'library' }), false)
  assert.equal(resolvePlaybackMode({ page: 'lesson', mode: PLAYBACK_MODE_FROM_START }), PLAYBACK_MODE_FROM_START)
  assert.equal(resolvePlaybackMode({ page: 'lesson', practiceActive: true, mode: PLAYBACK_MODE_FROM_START }), PLAYBACK_MODE_SINGLE)
  assert.equal(resolvePlaybackMode({ page: 'lesson', isAndroid: true, mode: PLAYBACK_MODE_FROM_START }), PLAYBACK_MODE_SINGLE)
  assert.equal(resolvePlaybackMode({ page: 'library', mode: PLAYBACK_MODE_FROM_START }), PLAYBACK_MODE_SINGLE)
})

test('单句模式保留原有提前量、下一句终点和未知时长回退区间', () => {
  const first = buildPlaybackClip({ lines: LINES, lineIndex: 0, mode: PLAYBACK_MODE_SINGLE, duration: DURATION })
  assert.deepEqual(
    { start: first.start, end: first.end, loops: first.loops },
    { start: 2 - LINE_PLAYBACK_LEAD_IN_SECONDS, end: 6, loops: false },
  )
  const middle = buildPlaybackClip({ lines: LINES, lineIndex: 1, mode: PLAYBACK_MODE_SINGLE, duration: DURATION })
  assert.equal(middle.start, 5.5)
  assert.equal(middle.end, 11)

  // 末句没有下一句：用音频时长；时长未知时用起点加 8 秒。
  const last = buildPlaybackClip({ lines: LINES, lineIndex: 2, mode: PLAYBACK_MODE_SINGLE, duration: DURATION })
  assert.equal(last.start, 10.5)
  assert.equal(last.end, DURATION)
  const unknown = buildPlaybackClip({ lines: LINES, lineIndex: 2, mode: PLAYBACK_MODE_SINGLE, duration: Number.NaN })
  assert.equal(unknown.end, 10.5 + 8)

  // 首句之前没有空间，起点不能小于 0。
  const opening = buildPlaybackClip({ lines: [{ id: 'z', start: 0 }], lineIndex: 0, mode: PLAYBACK_MODE_SINGLE, duration: 4 })
  assert.equal(opening.start, 0)
  assert.equal(opening.end, 4)
})

test('单句循环使用原有区间，过短区间回退到 5 秒', () => {
  const normal = buildPlaybackClip({ lines: LINES, lineIndex: 1, mode: PLAYBACK_MODE_SINGLE, duration: DURATION, loop: true })
  assert.equal(normal.start, 5.5)
  assert.equal(normal.end, 11)
  assert.equal(normal.loops, true)

  // 下一句时间戳早于当前句时区间会短于 0.3 秒，此时回退到起点加 5 秒。
  const crowded = [{ id: 'a', start: 5 }, { id: 'b', start: 4.7 }]
  const short = buildPlaybackClip({ lines: crowded, lineIndex: 0, mode: PLAYBACK_MODE_SINGLE, duration: DURATION, loop: true })
  assert.equal(short.start, 4.5)
  assert.equal(short.end, Math.min(DURATION, 4.5 + 5))
  assert.equal(short.loops, true)

  // 不开循环时只保证最短片段长度，不做 5 秒回退。
  const tight = buildPlaybackClip({ lines: crowded, lineIndex: 0, mode: PLAYBACK_MODE_SINGLE, duration: DURATION, loop: false })
  assert.equal(tight.start, 4.5)
  assert.ok(tight.end >= 4.5 + 0.12)
  assert.equal(tight.end, Math.max(4.5 + 0.12, 4.7))
  assert.equal(tight.loops, false)

  // 循环回退也遵守未知时长的 8 秒上限。
  const unknownShort = buildPlaybackClip({ lines: crowded, lineIndex: 0, mode: PLAYBACK_MODE_SINGLE, duration: Number.NaN, loop: true })
  assert.equal(unknownShort.end, Math.min(4.5 + 8, 4.5 + 5))
})

test('新模式首句和中间句都从 0 秒播到目标句结束', () => {
  const first = buildPlaybackClip({ lines: LINES, lineIndex: 0, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  assert.deepEqual({ start: first.start, end: first.end, loops: first.loops }, { start: 0, end: 6, loops: false })

  const middle = buildPlaybackClip({ lines: LINES, lineIndex: 1, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  assert.deepEqual({ start: middle.start, end: middle.end, loops: middle.loops }, { start: 0, end: 11, loops: false })

  // 循环开关不影响新模式：每次只播一次。
  const looped = buildPlaybackClip({ lines: LINES, lineIndex: 1, mode: PLAYBACK_MODE_FROM_START, duration: DURATION, loop: true })
  assert.equal(looped.end, 11)
  assert.equal(looped.loops, false)
})

test('新模式同时间戳的句子共用终点', () => {
  const shared = [{ id: 'a', start: 2 }, { id: 'b', start: 6 }, { id: 'c', start: 6 }, { id: 'd', start: 9 }]
  const first = buildPlaybackClip({ lines: shared, lineIndex: 1, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  const second = buildPlaybackClip({ lines: shared, lineIndex: 2, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  assert.equal(first.start, 0)
  assert.equal(first.end, 9)
  assert.equal(second.end, 9)

  // 目标句之前的重复时间戳不影响终点选择。
  const duplicated = [{ id: 'a', start: 2 }, { id: 'b', start: 2 }, { id: 'c', start: 6 }]
  const duplicate = buildPlaybackClip({ lines: duplicated, lineIndex: 0, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  assert.equal(duplicate.end, 6)
})

test('新模式末句播到音频结束，未知时长时不设终点', () => {
  const last = buildPlaybackClip({ lines: LINES, lineIndex: 2, mode: PLAYBACK_MODE_FROM_START, duration: DURATION })
  assert.equal(last.start, 0)
  assert.equal(last.end, DURATION)

  const unknown = buildPlaybackClip({ lines: LINES, lineIndex: 2, mode: PLAYBACK_MODE_FROM_START, duration: Number.NaN })
  assert.equal(unknown.start, 0)
  assert.equal(unknown.end, null)

  // 已知时长时区间终点不会超过音频长度。
  const clamped = buildPlaybackClip({
    lines: [{ id: 'a', start: 1 }, { id: 'b', start: 40 }],
    lineIndex: 0,
    mode: PLAYBACK_MODE_FROM_START,
    duration: 12,
  })
  assert.equal(clamped.end, 12)
})

test('区间计算不修改歌词数据，无效索引返回 null', () => {
  const lines = LINES.map((line) => ({ ...line }))
  buildPlaybackClip({ lines, lineIndex: 1, mode: PLAYBACK_MODE_FROM_START, duration: DURATION, loop: true })
  assert.deepEqual(lines, LINES)
  assert.equal(buildPlaybackClip({ lines, lineIndex: -1 }), null)
  assert.equal(buildPlaybackClip({ lines, lineIndex: 3 }), null)
  assert.equal(buildPlaybackClip({ lines: null, lineIndex: 0 }), null)
  assert.equal(buildPlaybackClip({ lines, lineIndex: 1.5 }), null)
})

test('循环控件只在单句模式可用，并保留用户原来的设置', () => {
  const single = lineLoopControl({ mode: PLAYBACK_MODE_SINGLE, loop: false })
  assert.deepEqual(single, {
    available: true, disabled: false, active: false, pressed: false, label: '单句循环', title: '开启单句循环：当前句反复播放',
  })
  const looping = lineLoopControl({ mode: PLAYBACK_MODE_SINGLE, loop: true })
  assert.equal(looping.active, true)
  assert.equal(looping.pressed, true)
  assert.equal(looping.label, '循环中')
  assert.equal(looping.title, '关闭单句循环')

  // 新模式禁用控件，但 loop=true 的设置保持不变，切回单句后恢复。
  const disabled = lineLoopControl({ mode: PLAYBACK_MODE_FROM_START, loop: true })
  assert.equal(disabled.available, false)
  assert.equal(disabled.disabled, true)
  assert.equal(disabled.active, false)
  assert.equal(disabled.pressed, false)
  assert.match(disabled.title, /单句/)
  assert.equal(lineLoopControl({ mode: PLAYBACK_MODE_SINGLE, loop: true }).active, true)
})

test('播放模式按钮的文案和激活状态由纯函数返回', () => {
  const selected = playbackModeSelection(PLAYBACK_MODE_FROM_START)
  assert.deepEqual(selected.map((option) => option.value), [PLAYBACK_MODE_SINGLE, PLAYBACK_MODE_FROM_START])
  assert.deepEqual(selected.map((option) => option.label), ['单句', '从开头播放到当前句'])
  assert.deepEqual(selected.map((option) => option.selected), [false, true])
  assert.deepEqual(playbackModeSelection(undefined).map((option) => option.selected), [true, false])
  assert.equal(PLAYBACK_MODE_OPTIONS.length, 2)
})

test('歌词行播放按钮的文字和激活状态随模式与播放状态变化', () => {
  const singleIdle = linePlaybackButton({ mode: PLAYBACK_MODE_SINGLE, isPlaying: false, displayNumber: 2 })
  assert.equal(singleIdle.label, '播放第 2 句')
  assert.equal(singleIdle.title, '播放这一句')
  assert.equal(singleIdle.active, false)

  const singlePlaying = linePlaybackButton({ mode: PLAYBACK_MODE_SINGLE, isPlaying: true, displayNumber: 2 })
  assert.equal(singlePlaying.label, '暂停第 2 句')
  assert.equal(singlePlaying.title, '暂停这一句')
  assert.equal(singlePlaying.active, true)

  const fromStartIdle = linePlaybackButton({ mode: PLAYBACK_MODE_FROM_START, isPlaying: false, displayNumber: 2 })
  assert.equal(fromStartIdle.label, '从开头播放到第 2 句')
  assert.equal(fromStartIdle.active, false)
  assert.match(fromStartIdle.title, /0 秒/)

  const fromStartPlaying = linePlaybackButton({ mode: PLAYBACK_MODE_FROM_START, isPlaying: true, displayNumber: 2 })
  assert.equal(fromStartPlaying.label, '暂停第 2 句')
  assert.equal(fromStartPlaying.active, true)

  // 缺省参数与未知模式按单句处理。
  const fallback = linePlaybackButton()
  assert.equal(fallback.label, '播放这一句')
  assert.equal(fallback.mode, PLAYBACK_MODE_SINGLE)
  assert.equal(linePlaybackButton({ mode: 'broken', isPlaying: false, displayNumber: 3 }).label, '播放第 3 句')
})
