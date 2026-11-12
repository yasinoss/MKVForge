"""Subtitle encoding detector and automated converter to clean UTF-8.
Converts any incoming text subtitle (cp1256, windows-1252, ISO-8859, UTF-16, etc.)
to standard UTF-8 automatically without prompting the user.
Version: 1.00
"""
from pathlib import Path
import re
import chardet

# Common subtitle extensions
TEXT_SUBTITLE_EXTENSIONS = {".srt", ".ass", ".ssa", ".vtt", ".sub", ".txt"}


def is_text_subtitle(file_path: Path) -> bool:
    return file_path.suffix.lower() in TEXT_SUBTITLE_EXTENSIONS


def detect_and_read_subtitle(file_path: Path) -> tuple[str, str]:
    """Reads a text subtitle file, automatically detecting its character encoding.
    Returns:
        tuple[content_as_str, detected_encoding_name]
    """
    raw_data = file_path.read_bytes()
    if not raw_data:
        return "", "utf-8"

    # 1. Check for standard BOMs
    if raw_data.startswith(b"\xef\xbb\xbf"):
        try:
            return raw_data[3:].decode("utf-8"), "utf-8-sig"
        except UnicodeDecodeError:
            pass
    elif raw_data.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return raw_data.decode("utf-16"), "utf-16"
        except UnicodeDecodeError:
            pass

    # 2. Try strict UTF-8 first (fast path)
    try:
        text = raw_data.decode("utf-8")
        return text, "utf-8"
    except UnicodeDecodeError:
        pass

    # 3. Use chardet analysis
    detected = chardet.detect(raw_data[:65536])
    chardet_enc = detected.get("encoding")
    confidence = detected.get("confidence", 0.0) or 0.0

    if chardet_enc and confidence >= 0.70:
        try:
            return raw_data.decode(chardet_enc), chardet_enc
        except (UnicodeDecodeError, LookupError):
            pass

    # 4. Fallback heuristics for Arabic and common media encodings
    # cp1256 (Arabic Windows) is extremely common in movie subtitles
    candidate_encodings = [
        "cp1256",       # Windows Arabic
        "iso-8859-6",   # ISO Arabic
        "windows-1252", # Western Europe
        "iso-8859-1",   # Latin 1
        "cp1250",       # Central Europe
        "gb18030",      # Chinese
        "shift_jis",    # Japanese
    ]

    for enc in candidate_encodings:
        try:
            decoded = raw_data.decode(enc)
            # If Arabic letters appear when decoded with cp1256, it's very likely cp1256
            if enc in ("cp1256", "iso-8859-6"):
                # Arabic unicode range: \u0600-\u06FF
                if re.search(r"[\u0600-\u06FF]", decoded):
                    return decoded, enc
            else:
                return decoded, enc
        except (UnicodeDecodeError, LookupError):
            continue

    # 5. Last resort: decode with utf-8 errors replaced
    return raw_data.decode("utf-8", errors="replace"), "utf-8-lossy"


def convert_subtitle_to_utf8(source_path: Path, destination_path: Path) -> str:
    """Converts source subtitle to clean UTF-8 (no BOM, standardized line breaks).
    Returns the original detected encoding.
    """
    text, original_encoding = detect_and_read_subtitle(source_path)

    # Normalize line breaks to standard \r\n (preferred for SRT players) or \n
    normalized_text = text.replace("\r\n", "\n").replace("\r", "\n")
    # For SRT and ASS, standard CRLF is broadly compatible with hardware media players
    output_text = normalized_text.replace("\n", "\r\n")

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_text(output_text, encoding="utf-8", newline="")
    return original_encoding


def ensure_clean_utf8_subtitle(source_path: Path, temp_dir: Path) -> tuple[Path, str, bool]:
    """Ensures subtitle is clean UTF-8. If it's already pure UTF-8 without BOM,
    returns source_path directly. Otherwise converts to temp_dir and returns new path.
    Returns:
        (active_path, detected_encoding, was_converted)
    """
    if not is_text_subtitle(source_path):
        return source_path, "binary", False

    raw_bytes = source_path.read_bytes()

    # If it's pure UTF-8 and does not have BOM, no conversion needed
    if not raw_bytes.startswith(b"\xef\xbb\xbf"):
        try:
            raw_bytes.decode("utf-8")
            return source_path, "utf-8", False
        except UnicodeDecodeError:
            pass

    # Needs conversion
    temp_dir.mkdir(parents=True, exist_ok=True)
    clean_target = temp_dir / f"utf8_{source_path.name}"
    detected_enc = convert_subtitle_to_utf8(source_path, clean_target)
    return clean_target, detected_enc, True
