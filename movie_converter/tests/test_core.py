"""Unit tests for Movie Converter core modules (M0).
Tests grouping, auto-UTF8 subtitles, track planner, and command generator.
Version: 1.00
"""
from pathlib import Path
import pytest

from movie_converter.core.commands import build_output_filepath, generate_group_commands
from movie_converter.core.grouping import extract_key_info, group_files
from movie_converter.core.models import (
    Preset,
    Project,
    QuickSettings,
    Track,
    TrackAction,
    VideoGroup,
)
from movie_converter.core.planner import build_track_plan
from movie_converter.core.subtitles import ensure_clean_utf8_subtitle


def test_key_extraction():
    # S01E02 format
    k1 = extract_key_info(Path("Dark.S01E02.1080p.mkv"))
    assert k1.season == 1
    assert k1.episode == 2
    assert "Dark" in k1.raw_key

    # 1x05 format
    k2 = extract_key_info(Path("Breaking.Bad.1x05.720p.mkv"))
    assert k2.season == 1
    assert k2.episode == 5

    # Movie format (no episode)
    k3 = extract_key_info(Path("Inception.2010.1080p.BluRay.x264.mkv"))
    assert k3.season is None
    assert k3.episode is None
    assert "Inception" in k3.raw_key


def test_grouping_series_and_external_subs():
    files = [
        Path("Dark.S01E01.mkv"),
        Path("Dark.S01E01.ara.srt"),
        Path("Dark.S01E01.en.ac3"),
        Path("Dark.S01E02.mkv"),
        Path("Dark.S01E02.ara.srt"),
    ]
    groups, unassigned = group_files(files)
    assert len(groups) == 2
    assert len(unassigned) == 0

    g1 = groups[0]
    assert g1.episode == 1
    # Check that tracks were populated with external tracks
    sub_track = next((t for t in g1.tracks if t.kind == "subtitle"), None)
    assert sub_track is not None
    assert sub_track.language == "ara"


def test_movie_single_video_grouping():
    files = [
        Path("Avatar.2009.mkv"),
        Path("Avatar.arabic.srt"),
        Path("Avatar.commentary.ac3"),
        Path("chapters.xml"),
    ]
    groups, unassigned = group_files(files)
    assert len(groups) == 1
    assert len(unassigned) == 0
    assert len(groups[0].tracks) == 3


def test_auto_utf8_subtitle_conversion(tmp_path):
    # Create an Arabic subtitle encoded in Windows-1256 (cp1256)
    arabic_text = "1\n00:00:01,000 --> 00:00:03,000\nمرحبا بك في الفيلم!\n"
    cp1256_bytes = arabic_text.encode("cp1256")

    sub_file = tmp_path / "arabic_cp1256.srt"
    sub_file.write_bytes(cp1256_bytes)

    temp_out = tmp_path / "temp_clean"
    clean_path, detected_enc, was_converted = ensure_clean_utf8_subtitle(sub_file, temp_out)

    assert was_converted is True
    assert detected_enc.lower() in ("cp1256", "windows-1256")
    # Verify resulting content is valid UTF-8 and contains the Arabic text
    decoded_text = clean_path.read_text(encoding="utf-8")
    assert "مرحبا بك في الفيلم!" in decoded_text


def test_deterministic_audio_filter_rescue():
    # Test that we never leave a video completely silent!
    group = VideoGroup(
        key="Dark.S01E01",
        show="Dark",
        season=1,
        episode=1,
        source=Path("Dark.S01E01.mkv"),
        tracks=[
            Track(
                id="v:0",
                kind="video",
                origin="container",
                source_path=Path("Dark.S01E01.mkv"),
                source_index=0,
                codec="HEVC",
                language="und",
            ),
            Track(
                id="a:1",
                kind="audio",
                origin="container",
                source_path=Path("Dark.S01E01.mkv"),
                source_index=1,
                codec="AC3",
                language="fra",  # French
            ),
        ],
    )
    # Quick settings removes French
    quick = QuickSettings(remove_audio_languages=["fra"])
    preset = Preset(id="copy", name="Copy", codec="copy")  # type: ignore

    plan, warnings = build_track_plan(group, quick, preset)

    # Audio track should be rescued because it was the only audio track
    assert plan["a:1"].kind == "keep"
    assert len(warnings) > 0
    assert "Retained audio" in warnings[0]


def test_command_generation_nvenc_and_sync(tmp_path):
    group = VideoGroup(
        key="Dark.S01E01",
        show="Dark",
        season=1,
        episode=1,
        source=Path("Dark.S01E01.mkv"),
        tracks=[
            Track(
                id="v:0",
                kind="video",
                origin="container",
                source_path=Path("Dark.S01E01.mkv"),
                source_index=0,
                codec="H264",
                language="und",
                details={"color_primaries": "bt2020", "color_transfer": "smpte2084"},
            ),
            Track(
                id="ext:sub1",
                kind="subtitle",
                origin="external",
                source_path=Path("Dark.01.ara.srt"),
                source_index=0,
                codec="SRT",
                language="ara",
                delay_ms=250,  # 250ms sync delay
            ),
        ],
        plan={
            "v:0": TrackAction(
                kind="convert",
                target_codec="hevc",
                params={"hardware": "nvidia", "quality_value": 22, "bit_depth": 10, "hdr_mode": "keep"},
            ),
            "ext:sub1": TrackAction(kind="add", delay_ms=250),
        },
    )

    out_file = tmp_path / "output.mkv"
    steps = generate_group_commands(
        group=group,
        output_final_path=out_file,
        temp_dir=tmp_path / "temp",
        ffmpeg_bin="ffmpeg",
        mkvmerge_bin="mkvmerge",
    )

    assert len(steps) == 2
    # Step 1: ffmpeg video convert
    assert steps[0].tool == "ffmpeg"
    assert "hevc_nvenc" in steps[0].args
    assert "p010le" in steps[0].args
    # Verify HDR tags preserved!
    assert "-color_primaries" in steps[0].args
    assert "bt2020" in steps[0].args

    # Step 2: mkvmerge assembly
    assert steps[1].tool == "mkvmerge"
    assert "--sync" in steps[1].args
    assert "0:250" in steps[1].args
