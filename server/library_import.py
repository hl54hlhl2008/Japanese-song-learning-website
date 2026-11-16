"""粘贴单曲链接导入：调用 musicdl 取歌，落盘到 geci/ 与 song/，再重建前端。

设计要点:
- musicdl 装在独立 venv（.tools/musicdl-venv），用子进程调用，避免污染后端依赖。
- 全流程串行（一把锁），避免并发写入 geci/song 与并发构建。
- 进度写进内存 job 表，前端轮询 GET /api/library/import/{job_id}。
- 构建产物是 dist/，uvicorn 每次请求都从磁盘读取，所以重建后刷新页面即生效。
"""

from __future__ import annotations

import ipaddress
import json
import os
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FETCH_SCRIPT = PROJECT_ROOT / "scripts" / "musicdl_fetch.py"
MUSICDL_PYTHON = PROJECT_ROOT / ".tools" / "musicdl-venv" / "bin" / "python"
GECI_DIR = PROJECT_ROOT / "geci"
SONG_DIR = PROJECT_ROOT / "song"

FETCH_TIMEOUT = 900
BUILD_TIMEOUT = 600

JOB_LOCK = threading.Lock()
IMPORT_LOCK = threading.Lock()
JOBS: dict[str, dict[str, Any]] = {}
MAX_JOBS = 20



def _clean_env() -> dict[str, str]:
    """构造子进程环境：补全 PATH（systemd 服务的 PATH 只有 venv/bin），并清掉代理。

    node/npm 装在 ~/.local/opt/node/bin，只靠 systemd 的 PATH 会找不到。
    """
    env = dict(os.environ)
    for key in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"):
        env.pop(key, None)
    extra = [
        str(Path.home() / ".local" / "opt" / "node" / "bin"),
        "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin",
    ]
    parts = [p for p in env.get("PATH", "").split(os.pathsep) if p]
    for path in extra:
        if path not in parts:
            parts.append(path)
    env["PATH"] = os.pathsep.join(parts)
    return env


def _now() -> float:
    return time.time()


def _trim_jobs() -> None:
    if len(JOBS) <= MAX_JOBS:
        return
    for job_id, _ in sorted(JOBS.items(), key=lambda kv: kv[1]["created_at"])[: len(JOBS) - MAX_JOBS]:
        JOBS.pop(job_id, None)


def _update(job_id: str, **fields: Any) -> None:
    with JOB_LOCK:
        job = JOBS.get(job_id)
        if job is not None:
            job.update(fields)
            job["updated_at"] = _now()


def get_job(job_id: str) -> dict[str, Any] | None:
    with JOB_LOCK:
        job = JOBS.get(job_id)
        return dict(job) if job else None


def is_private_client(host: str) -> bool:
    """仅允许本机 / 局域网 / Tailscale 触发导入，避免暴露到公网后被人当下载器用。"""
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host in {"localhost", ""}
    return (
        address.is_loopback
        or address in ipaddress.ip_network("10.0.0.0/8")
        or address in ipaddress.ip_network("172.16.0.0/12")
        or address in ipaddress.ip_network("192.168.0.0/16")
        or address in ipaddress.ip_network("100.64.0.0/10")  # Tailscale CGNAT
        or address in ipaddress.ip_network("fc00::/7")
    )


def _run_fetch(url: str, out_dir: Path, job_id: str) -> dict[str, Any]:
    """子进程跑取歌脚本，边读边把进度写进 job。返回最后一条 done 事件。"""
    env = _clean_env()

    process = subprocess.Popen(
        [str(MUSICDL_PYTHON), str(FETCH_SCRIPT), url, str(out_dir), "--quality", "192k"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        cwd=str(PROJECT_ROOT),
        env=env,
    )

    done_event: dict[str, Any] | None = None
    error_event: dict[str, Any] | None = None
    deadline = _now() + FETCH_TIMEOUT

    assert process.stdout is not None
    for line in process.stdout:
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            event = json.loads(line)
        except ValueError:
            continue
        kind = event.get("type")
        if kind == "progress":
            step = event.get("step", "")
            message = event.get("message") or {
                "detect": "已识别链接",
                "meta": f"找到歌曲：{event.get('title', '')} / {event.get('artist', '')}",
                "search": "正在匹配音源…",
                "matched": f"音源匹配成功（{event.get('ext', '')} {event.get('size', '')}）",
                "download": "正在下载音频…",
                "transcode": "正在转换 mp3…",
            }.get(step, step)
            _update(job_id, state="running", step=step, message=message,
                    title=event.get("title"), artist=event.get("artist"))
        elif kind == "done":
            done_event = event
        elif kind == "error":
            error_event = event
        if _now() > deadline:
            process.kill()
            raise RuntimeError("下载超时，请稍后重试。")

    stderr = (process.stderr.read() if process.stderr else "") or ""
    code = process.wait()
    if code != 0 or done_event is None:
        detail = (error_event or {}).get("message") or stderr.strip().splitlines()[-1:] or ["取歌失败"]
        raise RuntimeError(detail[0] if isinstance(detail, list) else detail)
    return done_event


def _run_node(args: list[str], job_id: str, step: str, message: str) -> None:
    _update(job_id, state="running", step=step, message=message)
    env = _clean_env()
    result = subprocess.run(
        args, cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=BUILD_TIMEOUT, env=env
    )
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "").strip().splitlines()[-3:]
        raise RuntimeError("前端重建失败：" + " | ".join(tail))


def _worker(job_id: str, url: str) -> None:
    staging = PROJECT_ROOT / ".tools" / "import-tmp" / job_id
    try:
        with IMPORT_LOCK:
            _update(job_id, state="running", step="start", message="开始处理链接…")
            staging.mkdir(parents=True, exist_ok=True)

            done = _run_fetch(url, staging, job_id)
            stem = done["stem"]
            mp3 = Path(done["mp3"])
            lrc = Path(done["lrc"]) if done.get("lrc") else None

            if lrc is None or not lrc.exists():
                raise RuntimeError("这首没有取到歌词（LRC），无法用于逐句学习。换一首或改用手动导入。")

            GECI_DIR.mkdir(exist_ok=True)
            SONG_DIR.mkdir(exist_ok=True)
            shutil.copy2(mp3, SONG_DIR / mp3.name)
            shutil.copy2(lrc, GECI_DIR / lrc.name)
            _update(job_id, title=done["title"], artist=done["artist"], message="已保存音频与歌词", step="save")

            _run_node(["node", "scripts/sync-lyrics.mjs"], job_id, "sync", "正在同步歌曲列表…")
            _run_node(["npm", "run", "build"], job_id, "build", "正在重建网页（约 5 秒）…")

            _update(
                job_id,
                state="done",
                step="finished",
                message=f"导入完成：{done['artist']} - {done['title']}，刷新页面即可看到。",
                files={"mp3": f"song/{mp3.name}", "lrc": f"geci/{lrc.name}"},
                mp3_mb=done.get("mp3_mb"),
                lrc_lines=done.get("lrc_lines"),
                finished_at=_now(),
            )
    except Exception as exc:  # noqa: BLE001 - 失败原因直接回给前端
        _update(job_id, state="error", message=str(exc), finished_at=_now())
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def start_import(url: str) -> str:
    """创建一个导入任务，返回 job_id。"""
    job_id = uuid.uuid4().hex[:12]
    with JOB_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "url": url,
            "state": "queued",
            "step": "queued",
            "message": "排队中…",
            "created_at": _now(),
            "updated_at": _now(),
        }
        _trim_jobs()
    threading.Thread(target=_worker, args=(job_id, url), daemon=True).start()
    return job_id
