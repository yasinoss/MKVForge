"""Persistence manager for application settings and external tools configuration.
Saves to %APPDATA%/MovieConverter/settings.json.
Version: 1.00
"""
from dataclasses import asdict
import json
import os
from pathlib import Path

from movie_converter.core.models import AppSettings
from movie_converter.core.probe import find_tool


def get_app_data_dir() -> Path:
    """Returns the persistent application configuration directory."""
    appdata = os.environ.get("APPDATA")
    if appdata:
        base = Path(appdata)
    else:
        base = Path.home() / ".config"
    target = base / "MovieConverter"
    target.mkdir(parents=True, exist_ok=True)
    return target


def get_settings_file_path() -> Path:
    return get_app_data_dir() / "settings.json"


def load_settings() -> AppSettings:
    """Loads settings from disk, applying tool auto-discovery if paths are empty."""
    path = get_settings_file_path()
    settings = AppSettings()

    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            settings = AppSettings(
                theme=data.get("theme", "dark"),
                accent=data.get("accent", "teal"),
                ffmpeg_path=data.get("ffmpeg_path", ""),
                ffprobe_path=data.get("ffprobe_path", ""),
                mkvmerge_path=data.get("mkvmerge_path", ""),
                temp_folder=data.get("temp_folder", ""),
                default_export_folder=data.get("default_export_folder", ""),
                default_preset_id=data.get("default_preset_id", "h265_nvenc_1080p"),
                preferred_audio_lang=data.get("preferred_audio_lang", "keep"),
                preferred_sub_lang=data.get("preferred_sub_lang", "ara"),
                audio_remove_langs=data.get("audio_remove_langs", []),
            )
        except Exception:
            pass

    # Auto-discover tools if not configured
    if not settings.ffmpeg_path:
        settings.ffmpeg_path = find_tool("ffmpeg") or "ffmpeg"
    if not settings.ffprobe_path:
        settings.ffprobe_path = find_tool("ffprobe") or "ffprobe"
    if not settings.mkvmerge_path:
        settings.mkvmerge_path = find_tool("mkvmerge") or ""

    return settings


def save_settings(settings: AppSettings) -> None:
    """Saves AppSettings dataclass to JSON."""
    path = get_settings_file_path()
    data = asdict(settings)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
