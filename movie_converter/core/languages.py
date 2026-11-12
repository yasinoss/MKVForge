"""Language codes, names, and filename language detection.
Version: 1.00
"""
from pathlib import Path
import re

# Common ISO 639-2 (3-letter) mapping
LANGUAGE_MAP: dict[str, str] = {
    "ara": "Arabic",
    "eng": "English",
    "fra": "French",
    "fre": "French",
    "deu": "German",
    "ger": "German",
    "spa": "Spanish",
    "ita": "Italian",
    "jpn": "Japanese",
    "kor": "Korean",
    "zho": "Chinese",
    "chi": "Chinese",
    "rus": "Russian",
    "por": "Portuguese",
    "tur": "Turkish",
    "hin": "Hindi",
    "pol": "Polish",
    "nld": "Dutch",
    "dut": "Dutch",
    "swe": "Swedish",
    "und": "Undetermined",
}

# 2-letter to 3-letter mapping
CODE2_TO_CODE3: dict[str, str] = {
    "ar": "ara",
    "en": "eng",
    "fr": "fra",
    "de": "deu",
    "es": "spa",
    "it": "ita",
    "ja": "jpn",
    "ko": "kor",
    "zh": "zho",
    "ru": "rus",
    "pt": "por",
    "tr": "tur",
    "hi": "hin",
    "pl": "pol",
    "nl": "nld",
    "sv": "swe",
}


def get_language_display_name(code: str) -> str:
    """Returns human-readable English name for a 3-letter or 2-letter language code."""
    code_clean = code.strip().lower()
    if len(code_clean) == 2:
        code_clean = CODE2_TO_CODE3.get(code_clean, code_clean)
    return LANGUAGE_MAP.get(code_clean, code.title() if code else "Undetermined")


def guess_language_from_filename(filename_or_path: str | Path) -> tuple[str, bool]:
    """Guesses language ISO 639-2 code and forced flag from tokens in filename.
    Examples:
        'Dark.S01E01.ar.srt' -> ('ara', False)
        'Dark.S01E01.Arabic.forced.srt' -> ('ara', True)
        'movie.en.ac3' -> ('eng', False)
    """
    stem = Path(filename_or_path).stem.lower()
    is_forced = bool(re.search(r"(\.|\b)(forced|force)(\.|\b)", stem))

    # Split stem by dots, underscores, dashes, spaces
    tokens = re.split(r"[\.\-_\s]+", stem)

    for token in tokens:
        # Check 2-letter code
        if token in CODE2_TO_CODE3:
            return CODE2_TO_CODE3[token], is_forced
        # Check 3-letter code
        if token in LANGUAGE_MAP and token != "und":
            return token, is_forced
        # Check full name
        for code3, name in LANGUAGE_MAP.items():
            if token == name.lower():
                return code3, is_forced

    # Arabic specific tokens
    if any(t in tokens for t in ["arabic", "arabi", "ar"]):
        return "ara", is_forced

    return "und", is_forced
