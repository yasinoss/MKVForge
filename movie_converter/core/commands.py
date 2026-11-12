"""Command generator for ffmpeg and mkvmerge.
Builds the minimal set of commands necessary to execute a VideoGroup's Track Plan.
Preserves HDR metadata with NVENC, supports track sync delays, and multi-track ordering.
Version: 1.00
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from movie_converter.core.models import Track, TrackAction, VideoGroup


@dataclass
class CommandStep:
    tool: str  # "ffmpeg" or "mkvmerge"
    description: str
    args: list[str]
    output_target: Path | None = None


def sanitize_filename(name: str) -> str:
    """Removes or replaces invalid Windows filename characters."""
    invalid = '<>:"/\\|?*'
    result = name
    for ch in invalid:
        result = result.replace(ch, "_")
    return result.strip()


def build_output_filepath(group: VideoGroup, output_folder: Path, pattern: str) -> Path:
    """Evaluates the naming pattern tokens, supporting subfolders like {show}/Season {season}/{name}."""
    tokens = {
        "{name}": group.key,
        "{show}": group.show or group.key,
        "{season}": f"{group.season:02d}" if group.season is not None else "01",
        "{episode}": f"{group.episode:02d}" if group.episode is not None else "01",
    }
    rendered = pattern
    for k, v in tokens.items():
        rendered = rendered.replace(k, str(v))

    # Clean segments separated by slash
    parts = rendered.replace("\\", "/").split("/")
    clean_parts = [sanitize_filename(p) for p in parts if p.strip()]
    rel_path = Path(*clean_parts)
    if not rel_path.name.lower().endswith(".mkv"):
        rel_path = rel_path.with_suffix(".mkv")

    return output_folder / rel_path


def build_ffmpeg_video_args(action: TrackAction, source_details: dict[str, Any]) -> list[str]:
    """Builds ffmpeg CLI video encode arguments based on hardware, codec, bit depth, and HDR."""
    params = action.params
    hw = params.get("hardware", "nvidia")
    codec = action.target_codec or "hevc"
    crf_cq = params.get("quality_value", 22)
    bit_depth = params.get("bit_depth", 10)
    speed = params.get("speed_preset", "medium")
    resolution = params.get("resolution", "keep")
    hdr_mode = params.get("hdr_mode", "keep")

    args: list[str] = []

    # Codec selection based on hardware
    if hw == "nvidia":
        if codec == "h264":
            args += ["-c:v", "h264_nvenc", "-rc", "vbr", "-cq", str(crf_cq), "-b:v", "0", "-preset", "p5"]
            if bit_depth == 10:
                args += ["-pix_fmt", "p010le"]
        elif codec == "av1":
            args += ["-c:v", "av1_nvenc", "-rc", "vbr", "-cq", str(crf_cq), "-b:v", "0", "-preset", "p5"]
            if bit_depth == 10:
                args += ["-pix_fmt", "p010le"]
        else:  # hevc (default)
            args += ["-c:v", "hevc_nvenc", "-rc", "vbr", "-cq", str(crf_cq), "-b:v", "0", "-preset", "p5"]
            if bit_depth == 10:
                args += ["-pix_fmt", "p010le"]
    elif hw == "cpu":
        if codec == "h264":
            args += ["-c:v", "libx264", "-crf", str(crf_cq), "-preset", speed]
            if bit_depth == 10:
                args += ["-pix_fmt", "yuv420p10le"]
        elif codec == "av1":
            args += ["-c:v", "libsvtav1", "-crf", str(crf_cq), "-preset", "5"]
            if bit_depth == 10:
                args += ["-pix_fmt", "yuv420p10le"]
        else:  # hevc
            args += ["-c:v", "libx265", "-crf", str(crf_cq), "-preset", speed]
            if bit_depth == 10:
                args += ["-pix_fmt", "yuv420p10le"]
    else:
        # Fallback CPU
        args += ["-c:v", "libx265", "-crf", str(crf_cq), "-preset", "medium"]

    # Resolution scaling
    if resolution != "keep":
        res_map = {"2160p": 2160, "1440p": 1440, "1080p": 1080, "720p": 720}
        target_h = res_map.get(resolution)
        if target_h:
            args += ["-vf", f"scale=-2:{target_h}:flags=lanczos"]

    # HDR Metadata Passthrough (Crucial for preventing washed-out colors with NVENC)
    color_primaries = source_details.get("color_primaries", "")
    color_transfer = source_details.get("color_transfer", "")
    color_space = source_details.get("color_space", "")

    is_source_hdr = "2020" in color_primaries or "smpte2084" in color_transfer or "arib-std-b67" in color_transfer

    if is_source_hdr and hdr_mode == "keep":
        args += [
            "-color_primaries", "bt2020",
            "-color_trc", "smpte2084",
            "-colorspace", "bt2020nc",
        ]

    return args


def generate_group_commands(
    group: VideoGroup,
    output_final_path: Path,
    temp_dir: Path,
    shared_attachments: list[Path] | None = None,
    remove_old_attachments: bool = False,
    ffmpeg_bin: str = "ffmpeg",
    mkvmerge_bin: str = "mkvmerge",
) -> list[CommandStep]:
    """Generates the exact sequence of CommandSteps needed to produce the final MKV."""
    steps: list[CommandStep] = []
    shared_attachments = shared_attachments or []

    # Map of temp pieces to pass to mkvmerge
    temp_video_mkv: Path | None = None
    converted_audio_map: dict[str, Path] = {}  # track.id -> temp_audio_path

    # Step 1: Video re-encoding (if plan requires convert)
    for t in group.tracks:
        if t.kind == "video":
            action = group.plan.get(t.id)
            if action and action.kind == "convert":
                temp_video_mkv = temp_dir / "converted_video.mkv"
                encode_args = build_ffmpeg_video_args(action, t.details)
                ff_args = [
                    ffmpeg_bin,
                    "-hide_banner",
                    "-nostdin",
                    "-y",
                    "-progress", "pipe:1",
                    "-nostats",
                    "-i", str(group.source),
                    "-map", f"0:{t.source_index}",
                    "-an", "-sn", "-dn",
                    "-map_chapters", "-1",
                    "-map_metadata", "-1",
                ] + encode_args + [str(temp_video_mkv)]

                steps.append(
                    CommandStep(
                        tool="ffmpeg",
                        description=f"Encode video with {action.target_codec or 'preset'}",
                        args=ff_args,
                        output_target=temp_video_mkv,
                    )
                )

    # Step 2: Audio re-encoding for any audio tracks marked 'convert'
    for t in group.tracks:
        if t.kind == "audio":
            action = group.plan.get(t.id)
            if action and action.kind == "convert":
                temp_audio = temp_dir / f"converted_audio_{t.source_index}.mka"
                converted_audio_map[t.id] = temp_audio

                audio_codec = action.target_codec or "aac"
                # Map target codec name to ffmpeg encoder
                codec_flag = "aac" if audio_codec == "aac" else ("ac3" if audio_codec == "ac3" else audio_codec)
                bitrate = action.params.get("bitrate", "192k")

                ff_args = [
                    ffmpeg_bin,
                    "-hide_banner",
                    "-nostdin",
                    "-y",
                    "-progress", "pipe:1",
                    "-nostats",
                    "-i", str(t.source_path),
                    "-map", f"0:{t.source_index}",
                    "-vn", "-sn", "-dn",
                    "-c:a", codec_flag,
                    "-b:a", bitrate,
                ]

                channels = action.params.get("channels", "keep")
                if channels in ("stereo", "2"):
                    ff_args += ["-ac", "2"]
                elif channels in ("5.1", "6"):
                    ff_args += ["-ac", "6"]

                if action.params.get("normalize", False):
                    ff_args += ["-af", "loudnorm"]

                ff_args.append(str(temp_audio))

                steps.append(
                    CommandStep(
                        tool="ffmpeg",
                        description=f"Convert audio {t.language} to {audio_codec}",
                        args=ff_args,
                        output_target=temp_audio,
                    )
                )

    # Step 3: MKVToolNix final assembly
    mkv_part_target = output_final_path.with_suffix(".mkv.part")
    mkv_args: list[str] = [mkvmerge_bin, "--gui-mode", "-o", str(mkv_part_target)]

    # 3.1 Container handling:
    # Audio track IDs to keep from original container (excluding converted ones)
    kept_container_audios = [
        str(t.source_index)
        for t in group.tracks
        if t.kind == "audio" and t.origin == "container" and group.plan.get(t.id, TrackAction(kind="remove")).kind == "keep"
    ]

    # Subtitle track IDs to keep from original container
    kept_container_subs = [
        str(t.source_index)
        for t in group.tracks
        if t.kind == "subtitle" and t.origin == "container" and group.plan.get(t.id, TrackAction(kind="remove")).kind == "keep"
    ]

    # Video from source container
    if temp_video_mkv is None:
        video_track = next((t for t in group.tracks if t.kind == "video"), None)
        if video_track:
            mkv_args += ["--video-tracks", str(video_track.source_index)]
    else:
        mkv_args.append("--no-video")

    # Audio from source container
    if kept_container_audios:
        mkv_args += ["--audio-tracks", ",".join(kept_container_audios)]
    else:
        mkv_args.append("--no-audio")

    # Subtitles from source container
    if kept_container_subs:
        mkv_args += ["--subtitle-tracks", ",".join(kept_container_subs)]
    else:
        mkv_args.append("--no-subtitles")

    # Attachments from source container
    if remove_old_attachments:
        mkv_args.append("--no-attachments")

    # Per-track properties for container tracks (flags, names, languages, delays)
    for t in group.tracks:
        if t.origin == "container":
            action = group.plan.get(t.id)
            if action and action.kind == "keep":
                tid = t.source_index
                mkv_args += [
                    "--language", f"{tid}:{t.language}",
                    "--default-track-flag", f"{tid}:{'yes' if t.is_default else 'no'}",
                    "--forced-display-flag", f"{tid}:{'yes' if t.is_forced else 'no'}",
                ]
                if t.name:
                    mkv_args += ["--track-name", f"{tid}:{t.name}"]
                if action.delay_ms != 0:
                    mkv_args += ["--sync", f"{tid}:{action.delay_ms}"]

    # Add source file
    mkv_args.append(str(group.source))

    # 3.2 If video was converted via ffmpeg, append temp_video_mkv
    if temp_video_mkv:
        mkv_args += ["--default-track-flag", "0:yes", str(temp_video_mkv)]

    # 3.3 If any audio was converted via ffmpeg, append them
    for t in group.tracks:
        if t.id in converted_audio_map:
            temp_path = converted_audio_map[t.id]
            action = group.plan.get(t.id)
            delay = action.delay_ms if action else 0
            mkv_args += [
                "--language", f"0:{t.language}",
                "--default-track-flag", f"0:{'yes' if t.is_default else 'no'}",
                "--forced-display-flag", f"0:{'yes' if t.is_forced else 'no'}",
            ]
            if t.name:
                mkv_args += ["--track-name", f"0:{t.name}"]
            if delay != 0:
                mkv_args += ["--sync", f"0:{delay}"]
            mkv_args.append(str(temp_path))

    # 3.4 Append external audio/subtitles/chapters
    for t in group.tracks:
        if t.origin == "external":
            action = group.plan.get(t.id)
            if action and action.kind == "add":
                delay = action.delay_ms
                if t.kind == "subtitle":
                    mkv_args += [
                        "--language", f"0:{t.language}",
                        "--default-track-flag", f"0:{'yes' if t.is_default else 'no'}",
                        "--forced-display-flag", f"0:{'yes' if t.is_forced else 'no'}",
                    ]
                    if t.name:
                        mkv_args += ["--track-name", f"0:{t.name}"]
                    if delay != 0:
                        mkv_args += ["--sync", f"0:{delay}"]
                    mkv_args.append(str(t.source_path))

                elif t.kind == "audio":
                    mkv_args += [
                        "--language", f"0:{t.language}",
                        "--default-track-flag", f"0:{'yes' if t.is_default else 'no'}",
                        "--forced-display-flag", f"0:{'yes' if t.is_forced else 'no'}",
                    ]
                    if t.name:
                        mkv_args += ["--track-name", f"0:{t.name}"]
                    if delay != 0:
                        mkv_args += ["--sync", f"0:{delay}"]
                    mkv_args.append(str(t.source_path))

                elif t.kind == "chapters":
                    mkv_args += ["--chapters", str(t.source_path)]

    # 3.5 Attachments (group-added + shared attachments)
    all_attachments = list(dict.fromkeys(group.attachments_added + shared_attachments))
    for att in all_attachments:
        if att.is_file():
            mkv_args += ["--attach-file", str(att)]

    steps.append(
        CommandStep(
            tool="mkvmerge",
            description=f"Assemble final MKV: {output_final_path.name}",
            args=mkv_args,
            output_target=mkv_part_target,
        )
    )

    return steps
