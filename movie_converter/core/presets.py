"""Video and audio presets manager.
Saves to %APPDATA%/MovieConverter/presets.json.
Version: 1.00
"""
from dataclasses import asdict
import json
from pathlib import Path

from movie_converter.core.models import Preset
from movie_converter.core.settings import get_app_data_dir

# Default factory presets
DEFAULT_PRESETS: list[Preset] = [
    Preset(
        id="copy",
        name="Copy (no re-encode - Mux only)",
        hardware="cpu",
        codec="copy",  # type: ignore
        resolution="keep",
        audio_codec="copy",
    ),
    Preset(
        id="h265_nvenc_1080p",
        name="H.265 NVIDIA NVENC (Fast & 10-bit)",
        hardware="nvidia",
        codec="hevc",
        resolution="keep",
        rate_control="cq",
        quality_value=22,
        speed_preset="p5",
        bit_depth=10,
        hdr_mode="keep",
        audio_codec="copy",
    ),
    Preset(
        id="h265_crf22_1080p",
        name="H.265 CPU CRF 22 1080p (Balanced)",
        hardware="cpu",
        codec="hevc",
        resolution="1080p",
        rate_control="crf",
        quality_value=22,
        speed_preset="medium",
        bit_depth=10,
        hdr_mode="keep",
        audio_codec="copy",
    ),
    Preset(
        id="h264_crf20_1080p",
        name="H.264 CPU CRF 20 1080p (Universal)",
        hardware="cpu",
        codec="h264",
        resolution="1080p",
        rate_control="crf",
        quality_value=20,
        speed_preset="medium",
        bit_depth=8,
        hdr_mode="tonemap_sdr",
        audio_codec="copy",
    ),
    Preset(
        id="av1_nvenc_small",
        name="AV1 NVIDIA NVENC (Smallest Size)",
        hardware="nvidia",
        codec="av1",
        resolution="keep",
        rate_control="cq",
        quality_value=24,
        speed_preset="p5",
        bit_depth=10,
        hdr_mode="keep",
        audio_codec="aac",
        audio_bitrate="192k",
    ),
]


def get_presets_file_path() -> Path:
    return get_app_data_dir() / "presets.json"


def load_presets() -> dict[str, Preset]:
    """Loads presets from disk, combining defaults with custom presets."""
    presets = {p.id: p for p in DEFAULT_PRESETS}
    path = get_presets_file_path()

    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for item in data:
                p = Preset(**item)
                presets[p.id] = p
        except Exception:
            pass

    return presets


def save_presets(presets: dict[str, Preset]) -> None:
    """Saves non-built-in or updated presets to disk."""
    path = get_presets_file_path()
    data = [asdict(p) for p in presets.values()]
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
