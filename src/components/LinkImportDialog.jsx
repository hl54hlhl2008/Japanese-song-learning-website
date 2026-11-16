import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Link2, LoaderCircle, RotateCw, X } from 'lucide-react'

/**
 * 粘贴音乐平台单曲链接 → 后端下载音频与 LRC 到 geci/song → 自动重建前端。
 * 目前后端只支持网易云音乐单曲链接。
 */
export default function LinkImportDialog({ onClose }) {
  const [url, setUrl] = useState('')
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const poll = (jobId) => {
    stopPolling()
    timerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/library/import/${jobId}`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.detail || '查询进度失败')
        setJob(data)
        if (data.state === 'done' || data.state === 'error') {
          stopPolling()
          setBusy(false)
          if (data.state === 'error') setError(data.message || '导入失败')
        }
      } catch {
        // 单次轮询失败不打断流程
      }
    }, 1500)
  }

  async function submit(event) {
    event.preventDefault()
    const value = url.trim()
    if (!value) {
      setError('请先粘贴单曲链接')
      return
    }
    setError('')
    setBusy(true)
    setJob({ state: 'queued', step: 'queued', message: '提交中…' })
    try {
      const response = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || '提交失败')
      poll(data.job_id)
    } catch (err) {
      setBusy(false)
      setError(err.message || '提交失败')
    }
  }

  const done = job?.state === 'done'

  return (
    <div className="song-import-backdrop" role="presentation" onClick={onClose}>
      <form className="song-import-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <button className="song-import-close" type="button" onClick={onClose} aria-label="关闭导入窗口"><X size={18} /></button>
        <p className="eyebrow">IMPORT FROM LINK</p>
        <h2>粘贴单曲链接导入</h2>
        <p className="song-import-intro">
          把网易云音乐的单曲页面链接粘贴进来，服务端会下载音频与逐句歌词，保存到 <code>song/</code> 与 <code>geci/</code>，然后自动重建页面。整个过程约 1–3 分钟。
        </p>

        <label className="song-file-field">
          <span>01 · 单曲链接</span>
          <strong><Link2 size={14} /> 例如 https://music.163.com/#/song?id=1234567</strong>
          <small>必须是单曲页面链接；歌单/专辑链接暂不支持</small>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://music.163.com/#/song?id=…"
            disabled={busy}
            autoFocus
          />
        </label>

        {job && (
          <div className="link-import-progress" role="status">
            <div className="link-import-line">
              {busy && !done && job.state !== 'error' ? <LoaderCircle className="spin" size={15} /> : null}
              <span>{job.message || '处理中…'}</span>
            </div>
            {job.title ? <small>{job.artist ? `${job.artist} · ` : ''}{job.title}</small> : null}
            {done && job.files ? (
              <ul className="link-import-files">
                <li>{job.files.lrc}</li>
                <li>{job.files.mp3}{job.mp3_mb ? `（${job.mp3_mb} MB）` : ''}</li>
              </ul>
            ) : null}
          </div>
        )}

        {error && <p className="song-import-error"><CircleAlert size={14} /> {error}</p>}

        <div className="song-import-actions">
          {done ? (
            <>
              <button type="button" onClick={onClose}>稍后再说</button>
              <button className="song-import-submit" type="button" onClick={() => window.location.reload()}><RotateCw size={14} /> 刷新查看</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={busy}>取消</button>
              <button className="song-import-submit" type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={14} /> : <Link2 size={14} />}
                {busy ? '正在导入…' : '开始导入'}
              </button>
            </>
          )}
        </div>

        <p className="link-import-note">
          仅供个人学习使用。下载内容来自公开接口，若平台限制（会员/下架）会提示失败，可改用「导入歌曲」手动上传文件。
        </p>
      </form>
    </div>
  )
}
