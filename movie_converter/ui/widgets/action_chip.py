"""Status and Action Chip widgets.
Renders semantic color-coded chips with clear text labels and outlined track tags.
Version: 1.00
"""
from typing import Literal
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QLabel, QWidget

from movie_converter.ui.theme import ColorPalette

ChipType = Literal["neutral", "blue", "red", "green", "amber"]


class ActionChip(QLabel):
    """Action chip with rounded border, background, and bold text."""

    def __init__(self, text: str, chip_type: ChipType = "neutral", parent: QWidget | None = None):
        super().__init__(text, parent)
        self.chip_type = chip_type
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setFixedHeight(26)
        self.setContentsMargins(10, 2, 10, 2)

    def update_palette(self, palette: ColorPalette) -> None:
        type_styles = {
            "neutral": (palette.chip_neutral_bg, palette.chip_neutral_text),
            "blue": (palette.chip_blue_bg, palette.chip_blue_text),
            "red": (palette.chip_red_bg, palette.chip_red_text),
            "green": (palette.chip_green_bg, palette.chip_green_text),
            "amber": (palette.chip_amber_bg, palette.chip_amber_text),
        }
        bg, fg = type_styles.get(self.chip_type, (palette.chip_neutral_bg, palette.chip_neutral_text))
        self.setStyleSheet(f"""
            QLabel {{
                background-color: {bg};
                color: {fg};
                border-radius: 6px;
                font-weight: 600;
                font-size: 12px;
                padding: 2px 8px;
            }}
        """)


class TrackTypeTag(QLabel):
    """Outlined tag for track types (Video, Audio, Subtitle, Chapters, Attachment)."""

    def __init__(self, kind: str, parent: QWidget | None = None):
        super().__init__(kind.capitalize(), parent)
        self.kind = kind.lower()
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setFixedHeight(22)
        self.setContentsMargins(6, 1, 6, 1)

    def update_palette(self, palette: ColorPalette) -> None:
        colors = {
            "video": ("#2563EB", "#3B82F6"),
            "audio": ("#D97706", "#F59E0B"),
            "subtitle": ("#16A34A", "#22C55E"),
            "chapters": (palette.muted_text, palette.muted_text),
            "attachment": (palette.muted_text, palette.muted_text),
        }
        border_c, text_c = colors.get(self.kind, (palette.muted_text, palette.muted_text))
        self.setStyleSheet(f"""
            QLabel {{
                border: 1px solid {border_c};
                color: {text_c};
                border-radius: 4px;
                font-weight: 600;
                font-size: 11px;
                background: transparent;
                padding: 1px 6px;
            }}
        """)
