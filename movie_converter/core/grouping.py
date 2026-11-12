"""File grouping and key extraction for series episodes and movies.
Matches video files with their corresponding external audio, subtitles, and chapters.
Version: 1.00
"""
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Literal

from movie_converter.core.languages import guess_language_from_filename
from movie_converter.core.models import Track, TrackKind, VideoGroup

VIDEO_EXTENSIONS = {".mkv", ".mp4", ".m4v", ".avi", ".ts", ".m2ts", ".mov", ".wmv", ".flv", ".webm"}
AUDIO_EXTENSIONS = {".ac3", ".eac3", ".aac", ".m4a", ".mp3", ".flac", ".opus", ".dts", ".dtshd", ".wav"}
SUBTITLE_EXTENSIONS = {".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx", ".sup"}
CHAPTERS_EXTENSIONS = {".xml", ".txt"}


def get_file_kind(path: Path) -> TrackKind | Literal["attachment", "unknown"]:
    suffix = path.suffix.lower()
    if suffix in VIDEO_EXTENSIONS:
        return "video"
    if suffix in AUDIO_EXTENSIONS:
        return "audio"
    if suffix in SUBTITLE_EXTENSIONS:
        return "subtitle"
    if suffix in CHAPTERS_EXTENSIONS and "chapter" in path.stem.lower():
        return "chapters"
    if suffix in {".ttf", ".otf", ".jpg", ".jpeg", ".png"}:
        return "attachment"
    return "unknown"


@dataclass
class KeyInfo:
    raw_key: str
    show: str | None
    season: int | None
    episode: int | None


def extract_key_info(path: Path) -> KeyInfo:
    r"""Extracts series/episode information or clean stem key from filename.
    Priorities:
    1. S(\d{1,2})E(\d{1,3})
    2. (\d{1,2})x(\d{2,3})
    3. (?:Episode|Ep|E)[ ._-]?(\d{1,3})
    4. Cleaned stem
    """
    stem = path.stem

    # Pattern 1: S01E02 or s1e2
    match1 = re.search(r"^(.*?)[ ._\-]+[Ss](\d{1,2})[Ee](\d{1,3})", stem, re.IGNORECASE)
    if match1:
        show = match1.group(1).replace(".", " ").replace("_", " ").strip()
        season = int(match1.group(2))
        episode = int(match1.group(3))
        key = f"{show} S{season:02d}E{episode:02d}" if show else f"S{season:02d}E{episode:02d}"
        return KeyInfo(raw_key=key, show=show or None, season=season, episode=episode)

    # Pattern 2: 1x02
    match2 = re.search(r"^(.*?)[ ._\-]+(\d{1,2})[xX](\d{2,3})", stem)
    if match2:
        show = match2.group(1).replace(".", " ").replace("_", " ").strip()
        season = int(match2.group(2))
        episode = int(match2.group(3))
        key = f"{show} S{season:02d}E{episode:02d}" if show else f"S{season:02d}E{episode:02d}"
        return KeyInfo(raw_key=key, show=show or None, season=season, episode=episode)

    # Pattern 3: Ep 02 or Episode 2
    match3 = re.search(r"^(.*?)[ ._\-]+(?:Episode|Ep|E)[ ._-]?(\d{1,3})", stem, re.IGNORECASE)
    if match3:
        show = match3.group(1).replace(".", " ").replace("_", " ").strip()
        episode = int(match3.group(2))
        key = f"{show} E{episode:02d}" if show else f"E{episode:02d}"
        return KeyInfo(raw_key=key, show=show or None, season=1, episode=episode)

    # Pattern 4: Normalized stem (remove release tags, language codes)
    cleaned = stem
    # Strip common release tokens
    cleaned = re.sub(
        r"(\.|\b)(1080p|720p|2160p|4k|web-?dl|bluray|brrip|h264|h265|x264|x265|hevc|aac|ac3|dts|remux)(\.|\b)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    # Strip language tokens
    cleaned = re.sub(r"(\.|\b)(ar|ara|arabic|en|eng|english|fr|fra|fre|de|deu|ger|forced)(\.|\b)", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[ ._\-]+", " ", cleaned).strip()

    return KeyInfo(raw_key=cleaned or stem, show=cleaned or stem, season=None, episode=None)


def group_files(file_paths: list[Path]) -> tuple[list[VideoGroup], list[Path]]:
    """Groups video files with their matching audio, subtitle, and chapter files.
    Returns:
        (video_groups, unassigned_files)
    """
    videos: list[Path] = []
    others: list[Path] = []

    for p in file_paths:
        kind = get_file_kind(p)
        if kind == "video":
            videos.append(p)
        elif kind in ("audio", "subtitle", "chapters"):
            others.append(p)

    if not videos:
        return [], others

    # Movie single video rule: if only 1 video, all non-video files join it
    if len(videos) == 1:
        v = videos[0]
        k_info = extract_key_info(v)
        group = VideoGroup(
            key=k_info.raw_key,
            show=k_info.show,
            season=k_info.season,
            episode=k_info.episode,
            source=v,
            tracks=[],
        )
        # Add external tracks
        for other in others:
            kind = get_file_kind(other)
            lang, is_forced = guess_language_from_filename(other)
            ext_track = Track(
                id=f"ext:{other.name}",
                kind=kind,  # type: ignore
                origin="external",
                source_path=other,
                source_index=0,
                codec=other.suffix.lstrip(".").upper(),
                language=lang,
                name=other.stem,
                is_default=False,
                is_forced=is_forced,
            )
            group.tracks.append(ext_track)
        return [group], []

    # Series / Multi-video matching
    groups_by_key: dict[str, VideoGroup] = {}
    for v in videos:
        k_info = extract_key_info(v)
        # Unique key identifier
        key = k_info.raw_key
        group = VideoGroup(
            key=key,
            show=k_info.show,
            season=k_info.season,
            episode=k_info.episode,
            source=v,
            tracks=[],
        )
        groups_by_key[key] = group

    unassigned: list[Path] = []

    for other in others:
        other_k_info = extract_key_info(other)
        matched_group: VideoGroup | None = None

        # Try exact key match
        if other_k_info.raw_key in groups_by_key:
            matched_group = groups_by_key[other_k_info.raw_key]
        else:
            # Try matching by (season, episode) if both are known
            if other_k_info.season is not None and other_k_info.episode is not None:
                for grp in groups_by_key.values():
                    if grp.season == other_k_info.season and grp.episode == other_k_info.episode:
                        matched_group = grp
                        break

        if matched_group:
            kind = get_file_kind(other)
            lang, is_forced = guess_language_from_filename(other)
            ext_track = Track(
                id=f"ext:{other.name}",
                kind=kind,  # type: ignore
                origin="external",
                source_path=other,
                source_index=0,
                codec=other.suffix.lstrip(".").upper(),
                language=lang,
                name=other.stem,
                is_default=False,
                is_forced=is_forced,
            )
            matched_group.tracks.append(ext_track)
        else:
            unassigned.append(other)

    # Sort groups cleanly (e.g. by season, episode, or key)
    sorted_groups = sorted(
        groups_by_key.values(),
        key=lambda g: (g.season or 0, g.episode or 0, g.key),
    )
    return sorted_groups, unassigned
