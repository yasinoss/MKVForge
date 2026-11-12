"""Pure functional Track Planner for Movie Converter.
Generates an optimal decision plan per track with minimal commands,
respecting language filters, default flags, presets, and manual overrides.
Version: 1.00
"""
from collections import Counter
from typing import Any

from movie_converter.core.models import (
    Preset,
    Project,
    QuickSettings,
    Track,
    TrackAction,
    VideoGroup,
)

IMAGE_SUBTITLE_CODECS = {"HDMV PGS", "PGS", "VOBSUB", "DVD_SUBTITLE", "DVB_SUBTITLE"}


def is_image_subtitle(codec: str) -> bool:
    clean = codec.upper().replace("-", " ").strip()
    return any(img in clean for img in ("PGS", "VOBSUB", "DVD", "DVB"))


def build_track_plan(
    group: VideoGroup,
    quick: QuickSettings,
    preset: Preset,
    remove_old_attachments: bool = False,
) -> tuple[dict[str, TrackAction], list[str]]:
    """Builds the Track Plan dictionary (track_id -> TrackAction) and returns (plan, warnings).
    Preserves any track.id present in group.overrides.
    """
    plan: dict[str, TrackAction] = {}
    warnings: list[str] = []

    # 1. Video track planning
    video_tracks = [t for t in group.tracks if t.kind == "video"]
    for vt in video_tracks:
        if vt.id in group.overrides and vt.id in group.plan:
            plan[vt.id] = group.plan[vt.id]
            continue

        if preset.id == "copy" or preset.codec == "copy":  # type: ignore
            plan[vt.id] = TrackAction(kind="keep")
        else:
            plan[vt.id] = TrackAction(
                kind="convert",
                target_codec=preset.codec,
                params={
                    "hardware": preset.hardware,
                    "resolution": preset.resolution,
                    "quality_value": preset.quality_value,
                    "rate_control": preset.rate_control,
                    "speed_preset": preset.speed_preset,
                    "bit_depth": preset.bit_depth,
                    "hdr_mode": preset.hdr_mode,
                },
            )

    # 2. Audio tracks planning
    audio_tracks = [t for t in group.tracks if t.kind == "audio"]
    # Separate into candidates to keep/add vs remove based on language
    audio_candidates: list[Track] = []
    audio_to_remove: list[Track] = []

    for at in audio_tracks:
        if at.id in group.overrides and at.id in group.plan:
            # Manual override preserved
            plan[at.id] = group.plan[at.id]
            if plan[at.id].kind in ("keep", "convert", "add"):
                audio_candidates.append(at)
            continue

        # Check remove language filter
        if at.language in quick.remove_audio_languages:
            audio_to_remove.append(at)
        else:
            audio_candidates.append(at)

    # Deterministic rule: Never leave video completely silent!
    # If all audio would be removed, rescue the first one
    if not audio_candidates and audio_to_remove:
        rescued = audio_to_remove.pop(0)
        audio_candidates.append(rescued)
        warnings.append(f"Retained audio track '{rescued.name or rescued.codec}' ({rescued.language}) to avoid silent video.")

    for at in audio_to_remove:
        plan[at.id] = TrackAction(kind="remove", delay_ms=at.delay_ms)

    for at in audio_candidates:
        if at.id in plan:
            continue  # Already set by manual override

        action_kind = "add" if at.origin == "external" else "keep"

        # Check if audio needs conversion based on preset
        if preset.audio_codec and preset.audio_codec != "copy":
            # If codec differs or volume normalization is required
            if at.codec.lower() != preset.audio_codec.lower() or preset.audio_normalize:
                action_kind = "convert"

        plan[at.id] = TrackAction(
            kind=action_kind,
            target_codec=preset.audio_codec if action_kind == "convert" else None,
            params={
                "bitrate": preset.audio_bitrate,
                "channels": preset.audio_channels,
                "normalize": preset.audio_normalize,
            },
            delay_ms=at.delay_ms,
        )

    # 3. Subtitles planning
    subtitle_tracks = [t for t in group.tracks if t.kind == "subtitle"]
    for st in subtitle_tracks:
        if st.id in group.overrides and st.id in group.plan:
            plan[st.id] = group.plan[st.id]
            continue

        # Remove filter
        if st.language in quick.remove_subtitle_languages:
            plan[st.id] = TrackAction(kind="remove", delay_ms=st.delay_ms)
            continue

        if st.origin == "external":
            plan[st.id] = TrackAction(kind="add", delay_ms=st.delay_ms)
        else:
            plan[st.id] = TrackAction(kind="keep", delay_ms=st.delay_ms)

    # 4. Chapters planning
    chapters_tracks = [t for t in group.tracks if t.kind == "chapters"]
    has_external_chapters = any(c.origin == "external" for c in chapters_tracks)
    for ct in chapters_tracks:
        if ct.id in group.overrides and ct.id in group.plan:
            plan[ct.id] = group.plan[ct.id]
            continue

        if ct.origin == "external":
            plan[ct.id] = TrackAction(kind="add")
        elif has_external_chapters:
            # Replace internal chapters if external chapters exist
            plan[ct.id] = TrackAction(kind="remove")
        else:
            plan[ct.id] = TrackAction(kind="keep")

    # 5. Attachments planning
    attachment_tracks = [t for t in group.tracks if t.kind == "attachment"]
    for att in attachment_tracks:
        if att.id in group.overrides and att.id in group.plan:
            plan[att.id] = group.plan[att.id]
            continue

        if remove_old_attachments and att.origin == "container":
            plan[att.id] = TrackAction(kind="remove")
        else:
            plan[att.id] = TrackAction(kind="keep" if att.origin == "container" else "add")

    # 6. Apply Default Track Flags
    # Audio default flag
    kept_audios = [t for t in audio_tracks if plan.get(t.id, TrackAction(kind="remove")).kind in ("keep", "convert", "add")]
    if quick.default_audio_language and quick.default_audio_language != "keep":
        matched_audio = next((t for t in kept_audios if t.language == quick.default_audio_language), None)
        for t in kept_audios:
            if matched_audio:
                t.is_default = (t.id == matched_audio.id)
    elif kept_audios and not any(t.is_default for t in kept_audios):
        # Ensure at least the first audio track is default if none has it
        kept_audios[0].is_default = True

    # Subtitle default flag
    kept_subs = [t for t in subtitle_tracks if plan.get(t.id, TrackAction(kind="remove")).kind in ("keep", "add")]
    if quick.default_subtitle_language and quick.default_subtitle_language != "keep":
        matched_sub = next((t for t in kept_subs if t.language == quick.default_subtitle_language), None)
        for t in kept_subs:
            if matched_sub:
                t.is_default = (t.id == matched_sub.id)
            else:
                t.is_default = False

    return plan, warnings


def update_project_plans(project: Project, presets_by_id: dict[str, Preset]) -> None:
    """Updates the plans, warnings, and badges across all groups in the project."""
    preset = presets_by_id.get(project.quick.video_preset_id)
    if not preset:
        # Fallback to copy preset
        preset = Preset(id="copy", name="Copy (no re-encode)", codec="copy")  # type: ignore

    # Calculate layout signatures to detect "Extra" badge
    layout_signatures = []
    for g in project.groups:
        sig = tuple((t.kind, t.codec, t.language) for t in g.tracks if t.origin == "container")
        layout_signatures.append(sig)

    majority_signature = None
    if layout_signatures:
        majority_signature = Counter(layout_signatures).most_common(1)[0][0]

    for g in project.groups:
        plan, warnings = build_track_plan(
            group=g,
            quick=project.quick,
            preset=preset,
            remove_old_attachments=project.remove_old_attachments,
        )
        g.plan = plan
        g.warnings = warnings
        g.badges = []

        # Check "No sub" badge
        target_sub_lang = project.quick.default_subtitle_language
        if target_sub_lang and target_sub_lang != "keep":
            has_target_sub = any(
                t.kind == "subtitle"
                and t.language == target_sub_lang
                and g.plan.get(t.id, TrackAction(kind="remove")).kind in ("keep", "add")
                for t in g.tracks
            )
            if not has_target_sub:
                g.badges.append("No sub")

        # Check "Extra" badge
        sig = tuple((t.kind, t.codec, t.language) for t in g.tracks if t.origin == "container")
        if majority_signature and sig != majority_signature:
            g.badges.append("Extra")
