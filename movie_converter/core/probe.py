"""External tools discovery and media stream probing.
Finds ffmpeg, ffprobe, and mkvmerge, and extracts tracks, formats, and chapters.
Version: 1.00
"""
from functools import lru_cache
import json
from pathlib import Path
import shutil
import subprocess
from typing import Any

from movie_converter.core.languages import guess_language_from_filename
from movie_converter.core.models import Track, TrackKind

# Known common search paths for MKVToolNix and FFmpeg on Windows
COMMON_MKVTOOLNIX_PATHS = [
    r"D:\Program\Media\mkvtoolnix",
    r"C:\Program Files\MKVToolNix",
    r"C:\Program Files (x86)\MKVToolNix",
    r"D:\Program Files\MKVToolNix",
]

COMMON_FFMPEG_PATHS = [
    r"C:\ffmpeg\bin",
    r"D:\Program\Media\ffmpeg\bin",
]


def find_tool(tool_name: str, custom_path: str = "") -> str | None:
    """Finds an executable tool (ffmpeg, ffprobe, mkvmerge).
    Checks:
    1. custom_path (if provided)
    2. System PATH
    3. Known common locations
    """
    if custom_path:
        p = Path(custom_path)
        if p.is_file():
            return str(p)
        if p.is_dir():
            cand = p / f"{tool_name}.exe"
            if cand.is_file():
                return str(cand)

    # Check system PATH
    found = shutil.which(tool_name)
    if found:
        return found

    # Check known paths
    search_dirs = COMMON_MKVTOOLNIX_PATHS if "mkv" in tool_name else COMMON_FFMPEG_PATHS
    for d in search_dirs:
        cand = Path(d) / f"{tool_name}.exe"
        if cand.is_file():
            return str(cand)

    return None


@lru_cache(maxsize=1)
def get_available_encoders(ffmpeg_bin: str = "ffmpeg") -> set[str]:
    """Queries ffmpeg for supported video and audio encoders."""
    tool = find_tool("ffmpeg", ffmpeg_bin) or ffmpeg_bin
    try:
        res = subprocess.run(
            [tool, "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        encoders = set()
        for line in res.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0].startswith("V") or parts[0].startswith("A"):
                encoders.add(parts[1])
        return encoders
    except Exception:
        # Fallback conservative list
        return {"libx264", "libx265", "aac", "ac3", "hevc_nvenc", "h264_nvenc"}


def probe_with_ffprobe(file_path: Path, ffprobe_bin: str = "ffprobe") -> dict[str, Any]:
    """Runs ffprobe on a media file and returns parsed JSON output."""
    tool = find_tool("ffprobe", ffprobe_bin) or ffprobe_bin
    cmd = [
        tool,
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-show_chapters",
        str(file_path),
    ]
    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return json.loads(res.stdout)


def probe_with_mkvmerge(file_path: Path, mkvmerge_bin: str = "mkvmerge") -> dict[str, Any] | None:
    """Runs mkvmerge -J identification on a file, returning JSON."""
    tool = find_tool("mkvmerge", mkvmerge_bin)
    if not tool:
        return None
    cmd = [tool, "--identification-format", "json", "--identify", str(file_path)]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return json.loads(res.stdout)
    except Exception:
        return None


def probe_media_tracks(file_path: Path, ffprobe_bin: str = "ffprobe", mkvmerge_bin: str = "mkvmerge") -> list[Track]:
    """Probes a media file and constructs a normalized list of Track objects.
    Uses mkvmerge -J if available (essential for precise mkv track IDs and attachment info),
    otherwise falls back cleanly to ffprobe.
    """
    mkv_info = probe_with_mkvmerge(file_path, mkvmerge_bin)
    tracks: list[Track] = []

    if mkv_info and "tracks" in mkv_info:
        for t in mkv_info["tracks"]:
            t_type = t.get("type", "")
            if t_type not in ("video", "audio", "subtitles"):
                continue

            kind: TrackKind = "subtitle" if t_type == "subtitles" else t_type  # type: ignore
            props = t.get("properties", {})

            # Language
            lang = props.get("language", "und")
            if not lang or lang == "und":
                lang, _ = guess_language_from_filename(props.get("track_name", ""))

            track = Track(
                id=f"cnt:{t['id']}",
                kind=kind,
                origin="container",
                source_path=file_path,
                source_index=t["id"],
                codec=t.get("codec", props.get("codec_id", "Unknown")),
                language=lang,
                name=props.get("track_name", ""),
                is_default=props.get("default_track", False),
                is_forced=props.get("forced_track", False),
                details=props,
            )
            tracks.append(track)

        # Attachments inside MKV
        for att in mkv_info.get("attachments", []):
            att_track = Track(
                id=f"att:{att['id']}",
                kind="attachment",
                origin="container",
                source_path=file_path,
                source_index=att["id"],
                codec=att.get("content_type", "application/octet-stream"),
                language="und",
                name=att.get("file_name", f"attachment_{att['id']}"),
                details=att,
            )
            tracks.append(att_track)

        # Chapters
        if mkv_info.get("chapters", []):
            chap_count = len(mkv_info["chapters"])
            tracks.append(
                Track(
                    id="chap:0",
                    kind="chapters",
                    origin="container",
                    source_path=file_path,
                    source_index=0,
                    codec="Chapters",
                    language="und",
                    name=f"{chap_count} chapters",
                    details={"count": chap_count},
                )
            )
        return tracks

    # Fallback to ffprobe
    try:
        ff_info = probe_with_ffprobe(file_path, ffprobe_bin)
    except Exception:
        return []

    for s in ff_info.get("streams", []):
        codec_type = s.get("codec_type")
        if codec_type not in ("video", "audio", "subtitle"):
            continue

        kind: TrackKind = codec_type  # type: ignore
        tags = s.get("tags", {})
        lang = tags.get("language", "und")
        disp = s.get("disposition", {})

        track = Track(
            id=f"cnt:{s['index']}",
            kind=kind,
            origin="container",
            source_path=file_path,
            source_index=s["index"],
            codec=s.get("codec_name", "").upper(),
            language=lang,
            name=tags.get("title", ""),
            is_default=bool(disp.get("default", 0)),
            is_forced=bool(disp.get("forced", 0)),
            details=s,
        )
        tracks.append(track)

    chapters = ff_info.get("chapters", [])
    if chapters:
        tracks.append(
            Track(
                id="chap:0",
                kind="chapters",
                origin="container",
                source_path=file_path,
                source_index=0,
                codec="Chapters",
                language="und",
                name=f"{len(chapters)} chapters",
                details={"count": len(chapters)},
            )
        )

    return tracks
