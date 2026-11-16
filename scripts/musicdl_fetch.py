"""单曲链接 → 音频(mp3) + 歌词(lrc)，供 UTA 的「粘贴链接导入」使用。

只做一件事：把音乐平台单曲链接解析成 UTA 可用的 `歌手-歌名.mp3` + `歌手-歌名.lrc`。
不负责入库/重建前端（由后端 library_import 负责）。

用法:
    python musicdl_fetch.py "<歌曲链接>" <输出目录> [--quality 192k]

输出: 每行一个 JSON 事件（progress / done / error），最后一行 type=done 或 type=error。
平台: 目前仅网易云音乐（链接 → 歌曲 id → 元数据 → 按 id 精确匹配搜索结果）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# 平台后缀 → 内部标识。只列出已验证可自动解析链接的平台。
SUPPORTED_HOSTS = {
    "music.163.com": "netease",
    "y.music.163.com": "netease",
}

# 网易云短链域名（mobile/官方分享），需要先跟随跳转再解析
SHORTENER_HOSTS = {"163cn.tv", "music.163.com"}



def ensure_tool_path() -> None:
    """把 node / ffmpeg 所在目录补进 PATH（systemd 服务环境里 PATH 很窄）。"""
    extra = [
        str(Path.home() / ".local" / "opt" / "node" / "bin"),
        "/usr/local/bin", "/usr/bin", "/bin",
    ]
    for base in sorted((Path.home() / ".hermes" / "tools").glob("ffmpeg-*/bin")):
        extra.insert(0, str(base))
    parts = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
    for path in extra:
        if path not in parts and Path(path).is_dir():
            parts.append(path)
    os.environ["PATH"] = os.pathsep.join(parts)

    global FFMPEG
    FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


FFMPEG = "ffmpeg"


def emit(**payload) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def resolve_redirect(url: str) -> str:
    """短链跟随跳转，取出真实链接。失败时原样返回。"""
    try:
        import requests

        resp = requests.get(url, allow_redirects=True, timeout=15,
                            headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"})
        return resp.url or url
    except Exception:
        return url


def _extract_id(url: str) -> str | None:
    """从网易云链接里取歌曲 id：支持 /song?id=、#/song?id=、/song/123、/m/song?id=。"""
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if query.get("id"):
        return query["id"][0]
    fragment = parsed.fragment or ""
    if "?" in fragment:
        frag_query = parse_qs(fragment.split("?", 1)[1])
        if frag_query.get("id"):
            return frag_query["id"][0]
    match = re.search(r"/song/(\d+)", parsed.path or "")
    return match.group(1) if match else None


def detect_platform(url: str) -> tuple[str, str]:
    """返回 (platform, song_id)；不支持的平台抛 ValueError。"""
    candidate = url
    host = (urlparse(candidate).hostname or "").lower()
    if host in SHORTENER_HOSTS and "163cn.tv" in host:
        candidate = resolve_redirect(url)
        host = (urlparse(candidate).hostname or "").lower()

    platform = next((name for suffix, name in SUPPORTED_HOSTS.items()
                     if host == suffix or host.endswith("." + suffix)), None)
    if platform is None:
        raise ValueError(f"暂不支持该平台：{host or url}。目前仅支持网易云音乐单曲链接。")

    song_id = _extract_id(candidate)
    if not song_id:
        raise ValueError("链接里没有解析到歌曲 id，请确认是单曲页面链接（含 ?id= 或 /song/数字）。")
    return platform, song_id


def safe_stem(artist: str, title: str) -> str:
    raw = f"{artist}-{title}" if artist else title
    return re.sub(r'[\\/:*?"<>|\r\n\t]', "_", raw).strip()[:120] or "unknown-song"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("out_dir")
    parser.add_argument("--quality", default="192k", help="转码码率，默认 192k")
    args = parser.parse_args()

    ensure_tool_path()
    out_dir = Path(args.out_dir).expanduser().resolve()
    work_dir = Path(tempfile.mkdtemp(prefix="uta-fetch-"))

    try:
        platform, song_id = detect_platform(args.url.strip())
        emit(type="progress", step="detect", platform=platform, song_id=song_id)

        from musicdl.modules.sources.netease import NeteaseMusicClient

        client = NeteaseMusicClient(work_dir=str(work_dir), disable_print=True)

        meta = client._getsongmetainfo(int(song_id)) or {}
        title = (meta.get("name") or "").strip()
        artists = ", ".join(a.get("name", "") for a in (meta.get("ar") or []) if a.get("name")).strip()
        if not title:
            raise RuntimeError("没能取到歌曲信息，可能是链接失效或该曲目已下架。")
        emit(type="progress", step="meta", title=title, artist=artists)

        emit(type="progress", step="search", message="正在匹配音源…")
        results = client.search(f"{title} {artists}")
        items = results if isinstance(results, list) else (results.get("NeteaseMusicClient") or [])
        target = next(
            (item for item in items
             if str((item.raw_data.get("search") or {}).get("id")) == str(song_id)),
            None,
        )
        if target is None:
            raise RuntimeError("没有找到该曲目的可下载音源（可能需要会员或已下架）。")
        emit(type="progress", step="matched", ext=target.ext, size=target.file_size,
             lyric=bool(target.lyric))

        emit(type="progress", step="download", message=f"正在下载（{target.file_size}）…")
        downloaded = client.download(song_infos=[target])
        if not downloaded:
            raise RuntimeError("下载失败，未得到音频文件。")
        audio_path = Path(downloaded[0].save_path)
        lrc_path = audio_path.with_suffix(".lrc")

        out_dir.mkdir(parents=True, exist_ok=True)
        stem = safe_stem(artists, title)
        mp3_path = out_dir / f"{stem}.mp3"

        emit(type="progress", step="transcode", message="正在转为 mp3…")
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", str(audio_path),
             "-b:a", args.quality, str(mp3_path)],
            check=True,
        )

        out_lrc = out_dir / f"{stem}.lrc"
        has_lrc = lrc_path.exists() and lrc_path.stat().st_size > 0
        if has_lrc:
            shutil.copy2(lrc_path, out_lrc)

        emit(
            type="done",
            title=title,
            artist=artists,
            stem=stem,
            mp3=str(mp3_path),
            mp3_mb=round(mp3_path.stat().st_size / 1048576, 1),
            lrc=str(out_lrc) if has_lrc else None,
            lrc_lines=len(out_lrc.read_text(encoding="utf-8", errors="ignore").splitlines()) if has_lrc else 0,
        )
        return 0
    except Exception as exc:  # noqa: BLE001 - 统一转成 JSON 事件交给后端展示
        emit(type="error", message=str(exc))
        return 1
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
