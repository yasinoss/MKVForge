"""Design system and QSS theme generator for Movie Converter.
Supports selectable accent colors (Nordic Teal, Amber, Sage, Blue) in Light and Dark themes.
Version: 1.00
"""
from dataclasses import dataclass
from typing import Literal

from movie_converter.core.models import AccentTheme, AppearanceTheme


@dataclass
class ColorPalette:
    background: str
    panel: str
    border: str
    border_strong: str
    text: str
    muted_text: str
    accent: str
    accent_hover: str
    accent_surface: str
    accent_text: str
    group_header: str
    warning_row: str

    # Action chip colors (bg, text)
    chip_neutral_bg: str
    chip_neutral_text: str
    chip_blue_bg: str
    chip_blue_text: str
    chip_red_bg: str
    chip_red_text: str
    chip_green_bg: str
    chip_green_text: str
    chip_amber_bg: str
    chip_amber_text: str


# Accent Palettes
ACCENT_COLORS = {
    "teal": {
        "light_accent": "#0D9488",
        "light_hover": "#0F766E",
        "light_surface": "#F0FDFA",
        "light_text": "#0F766E",
        "dark_accent": "#14B8A6",
        "dark_hover": "#2DD4BF",
        "dark_surface": "#112A28",
        "dark_text": "#5EEAD4",
    },
    "amber": {
        "light_accent": "#D97706",
        "light_hover": "#B45309",
        "light_surface": "#FFFBEB",
        "light_text": "#92400E",
        "dark_accent": "#F59E0B",
        "dark_hover": "#FBBF24",
        "dark_surface": "#2A2010",
        "dark_text": "#FCD34D",
    },
    "sage": {
        "light_accent": "#15803D",
        "light_hover": "#166534",
        "light_surface": "#F2FDF5",
        "light_text": "#166534",
        "dark_accent": "#10B981",
        "dark_hover": "#34D399",
        "dark_surface": "#132E22",
        "dark_text": "#6EE7B7",
    },
    "blue": {
        "light_accent": "#2563EB",
        "light_hover": "#1D4ED8",
        "light_surface": "#EFF5FF",
        "light_text": "#1E40AF",
        "dark_accent": "#2F6FE4",
        "dark_hover": "#4B88F5",
        "dark_surface": "#1B2536",
        "dark_text": "#BFD8FF",
    },
}


def get_palette(appearance: Literal["light", "dark"], accent: AccentTheme = "teal") -> ColorPalette:
    acc = ACCENT_COLORS.get(accent, ACCENT_COLORS["teal"])

    if appearance == "dark":
        return ColorPalette(
            background="#101216",
            panel="#181B21",
            border="#2A2F38",
            border_strong="#3A404A",
            text="#E8EAED",
            muted_text="#9AA3AF",
            accent=acc["dark_accent"],
            accent_hover=acc["dark_hover"],
            accent_surface=acc["dark_surface"],
            accent_text=acc["dark_text"],
            group_header="#1E232B",
            warning_row="#2A2414",
            chip_neutral_bg="#2A3038",
            chip_neutral_text="#C9D1DB",
            chip_blue_bg="#1E3A66",
            chip_blue_text="#BFD8FF",
            chip_red_bg="#4A2326",
            chip_red_text="#FFB4AB",
            chip_green_bg="#17402B",
            chip_green_text="#9BE8BC",
            chip_amber_bg="#4A3A17",
            chip_amber_text="#FFD98A",
        )
    else:
        return ColorPalette(
            background="#F6F7F9",
            panel="#FFFFFF",
            border="#E3E6EB",
            border_strong="#C5CBD3",
            text="#1B1F24",
            muted_text="#5B6470",
            accent=acc["light_accent"],
            accent_hover=acc["light_hover"],
            accent_surface=acc["light_surface"],
            accent_text=acc["light_text"],
            group_header="#F1F3F6",
            warning_row="#FFFBEB",
            chip_neutral_bg="#EEF0F3",
            chip_neutral_text="#3A424D",
            chip_blue_bg="#DBEAFE",
            chip_blue_text="#1E40AF",
            chip_red_bg="#FEE2E2",
            chip_red_text="#991B1B",
            chip_green_bg="#DCFCE7",
            chip_green_text="#166534",
            chip_amber_bg="#FEF3C7",
            chip_amber_text="#92400E",
        )


def generate_stylesheet(appearance: Literal["light", "dark"], accent: AccentTheme = "teal") -> str:
    """Generates the comprehensive Qt stylesheet for the application."""
    p = get_palette(appearance, accent)

    return f"""
    * {{
        font-family: "Segoe UI", "Segoe UI Variable", system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: {p.text};
    }}

    QMainWindow, QWidget#centralWidget {{
        background-color: {p.background};
    }}

    /* Card Panels */
    QFrame.card, QWidget.card {{
        background-color: {p.panel};
        border: 1px solid {p.border};
        border-radius: 12px;
    }}

    /* Top Bar and Headers */
    QFrame#topBar {{
        background-color: {p.panel};
        border-bottom: 1px solid {p.border};
        min-height: 72px;
        max-height: 72px;
    }}

    QLabel#appTitle {{
        font-size: 18px;
        font-weight: 700;
        color: {p.text};
    }}

    QLabel#pageTitle {{
        font-size: 24px;
        font-weight: 700;
        color: {p.text};
    }}

    QLabel#pageSubtitle {{
        font-size: 14px;
        color: {p.muted_text};
    }}

    QLabel.sectionHeader {{
        font-size: 12px;
        font-weight: 600;
        color: {p.muted_text};
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}

    QLabel.statNumber {{
        font-size: 28px;
        font-weight: 700;
        color: {p.text};
    }}

    QLabel.statLabel {{
        font-size: 13px;
        color: {p.muted_text};
    }}

    /* Buttons */
    QPushButton {{
        background-color: {p.panel};
        border: 1px solid {p.border};
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 500;
        color: {p.text};
    }}

    QPushButton:hover {{
        background-color: {p.accent_surface};
        border-color: {p.accent};
        color: {p.accent_text};
    }}

    QPushButton:pressed {{
        background-color: {p.accent};
        color: #FFFFFF;
    }}

    QPushButton:disabled {{
        opacity: 0.5;
        color: {p.muted_text};
        border-color: {p.border};
        background-color: transparent;
    }}

    /* Primary Start / Action Button */
    QPushButton.primaryButton {{
        background-color: {p.accent};
        color: #FFFFFF;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 700;
        min-height: 48px;
        padding: 0 28px;
    }}

    QPushButton.primaryButton:hover {{
        background-color: {p.accent_hover};
        color: #FFFFFF;
    }}

    /* Form Controls */
    QComboBox, QLineEdit, QSpinBox {{
        background-color: {p.panel};
        border: 1px solid {p.border};
        border-radius: 8px;
        padding: 6px 12px;
        color: {p.text};
        min-height: 24px;
    }}

    QComboBox:hover, QLineEdit:focus, QSpinBox:focus {{
        border-color: {p.accent};
    }}

    QComboBox::drop-down {{
        border: none;
        width: 24px;
    }}

    QComboBox QAbstractItemView {{
        background-color: {p.panel};
        border: 1px solid {p.border};
        border-radius: 8px;
        selection-background-color: {p.accent_surface};
        selection-color: {p.accent_text};
        padding: 4px;
    }}

    /* Drop Zone */
    QFrame#dropZone {{
        background-color: {p.panel};
        border: 2px dashed {p.border_strong};
        border-radius: 16px;
    }}

    QFrame#dropZone.dragOver {{
        border-color: {p.accent};
        background-color: {p.accent_surface};
    }}

    /* Quick Settings Bar */
    QFrame#quickBar {{
        background-color: {p.panel};
        border-bottom: 1px solid {p.border};
        min-height: 70px;
    }}

    /* Lists and Tables */
    QListWidget, QTableWidget {{
        background-color: {p.panel};
        border: 1px solid {p.border};
        border-radius: 12px;
        gridline-color: {p.border};
    }}

    QListWidget::item {{
        padding: 12px;
        border-bottom: 1px solid {p.border};
        border-radius: 8px;
        margin: 2px 4px;
    }}

    QListWidget::item:selected {{
        background-color: {p.accent_surface};
        border: 1px solid {p.accent};
        color: {p.accent_text};
    }}

    QHeaderView::section {{
        background-color: {p.group_header};
        color: {p.muted_text};
        font-size: 12px;
        font-weight: 600;
        border: none;
        padding: 8px 12px;
    }}

    /* Progress Bar */
    QProgressBar {{
        background-color: {p.border};
        border: none;
        border-radius: 5px;
        height: 10px;
        text-align: right;
    }}

    QProgressBar::chunk {{
        background-color: {p.accent};
        border-radius: 5px;
    }}

    /* Scrollbars */
    QScrollBar:vertical {{
        background: transparent;
        width: 8px;
        margin: 0;
    }}
    QScrollBar::handle:vertical {{
        background: {p.border_strong};
        border-radius: 4px;
        min-height: 24px;
    }}
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
        height: 0px;
    }}
    """
