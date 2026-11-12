"""Core data models for Movie Converter.
Version: 1.00
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

TrackKind = Literal["video", "audio", "subtitle", "chapters", "attachment"]
TrackOrigin = Literal["container", "external"]
TrackActionKind = Literal["keep", "convert", "remove", "add"]
JobStatus = Literal["waiting", "running", "done", "warning", "failed", "skipped", "cancelled"]
AccentTheme = Literal["teal", "amber", "sage", "blue"]
AppearanceTheme = Literal["light", "dark", "system"]


@dataclass
class Track:
    id: str  # Unique stable id inside the project (e.g. "v:0", "a:1", "ext:sub:1")
    kind: TrackKind
    origin: TrackOrigin
    source_path: Path
    source_index: int  # mkvmerge track id (for container) or 0 (external file)
    codec: str  # e.g. "H.264", "E-AC3", "SubRip/SRT", "HDMV PGS"
    language: str  # ISO 639-2 (3-letter), e.g. "ara", "eng", "und"
    name: str = ""
    is_default: bool = False
    is_forced: bool = False
    delay_ms: int = 0  # Sync offset in milliseconds (+/-)
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class TrackAction:
    kind: TrackActionKind
    target_codec: str | None = None
    params: dict[str, Any] = field(default_factory=dict)
    delay_ms: int = 0


@dataclass
class VideoGroup:
    key: str  # Clean identifier, e.g. "Dark.S01E01"
    show: str | None
    season: int | None
    episode: int | None
    source: Path  # Original video file
    tracks: list[Track] = field(default_factory=list)
    plan: dict[str, TrackAction] = field(default_factory=dict)  # track.id -> TrackAction
    overrides: set[str] = field(default_factory=set)  # Track IDs manually customized
    attachments_added: list[Path] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    badges: list[str] = field(default_factory=list)  # e.g. "No sub", "Extra"


@dataclass
class QuickSettings:
    video_preset_id: str = "default"
    remove_audio_languages: list[str] = field(default_factory=list)
    remove_subtitle_languages: list[str] = field(default_factory=list)
    default_audio_language: str = "keep"  # "keep" or ISO 639-2 code
    default_subtitle_language: str = "keep"  # "keep" or ISO 639-2 code


@dataclass
class ExportSettings:
    output_folder: Path = field(default_factory=lambda: Path("."))
    file_name_pattern: str = "{show} - S{season}E{episode}"
    if_exists: Literal["ask", "overwrite", "skip", "rename"] = "ask"
    delete_originals: bool = False
    shutdown_when_finished: bool = False
    temp_same_as_output: bool = True
    custom_temp_folder: Path | None = None


@dataclass
class Preset:
    id: str
    name: str
    hardware: Literal["cpu", "nvidia", "amd", "intel"] = "nvidia"
    codec: Literal["h264", "hevc", "av1"] = "hevc"
    resolution: str = "keep"  # "keep", "2160p", "1440p", "1080p", "720p"
    scaling: str = "lanczos"
    rate_control: Literal["crf", "cq", "bitrate"] = "cq"
    quality_value: int = 22
    speed_preset: str = "medium"  # or "p5" for nvenc
    bit_depth: int = 10
    frame_rate: str = "keep"
    hdr_mode: Literal["keep", "tonemap_sdr"] = "keep"
    audio_codec: str = "copy"  # "copy", "aac", "ac3", "eac3", "flac", "opus"
    audio_bitrate: str = "192k"
    audio_channels: str = "keep"  # "keep", "2", "6"
    audio_normalize: bool = False


@dataclass
class Project:
    groups: list[VideoGroup] = field(default_factory=list)
    quick: QuickSettings = field(default_factory=QuickSettings)
    export: ExportSettings = field(default_factory=ExportSettings)
    shared_attachments: list[Path] = field(default_factory=list)
    remove_old_attachments: bool = False
    unassigned_files: list[Path] = field(default_factory=list)


@dataclass
class Job:
    id: str
    group: VideoGroup
    status: JobStatus = "waiting"
    progress: float = 0.0
    speed: str = ""
    eta_seconds: int = 0
    error_message: str | None = None
    output_file: Path | None = None
    temp_dir: Path | None = None
    log_lines: list[str] = field(default_factory=list)


@dataclass
class AppSettings:
    theme: AppearanceTheme = "dark"
    accent: AccentTheme = "teal"  # Default is our calm Nordic Teal
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    mkvmerge_path: str = ""
    temp_folder: str = ""
    default_export_folder: str = ""
    default_preset_id: str = "h265_nvenc_1080p"
    preferred_audio_lang: str = "keep"
    preferred_sub_lang: str = "ara"
    audio_remove_langs: list[str] = field(default_factory=list)
