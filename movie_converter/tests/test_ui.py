"""UI and theme tests for Movie Converter.
Verifies MainWindow lifecycle, theme generation, and step navigation.
Version: 1.00
"""
import sys
from PySide6.QtWidgets import QApplication
import pytest

from movie_converter.ui.main_window import MainWindow
from movie_converter.ui.theme import ACCENT_COLORS, generate_stylesheet, get_palette


@pytest.fixture(scope="session")
def qapp():
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    yield app


def test_theme_generation():
    # Verify all accent palettes generate without errors
    for accent in ACCENT_COLORS.keys():
        for appearance in ("light", "dark"):
            p = get_palette(appearance, accent)  # type: ignore
            assert p.accent is not None
            qss = generate_stylesheet(appearance, accent)  # type: ignore
            assert len(qss) > 200
            assert p.accent in qss


def test_main_window_lifecycle(qapp):
    window = MainWindow()
    assert window.windowTitle() == "Movie Converter"
    assert window.stack.count() == 4
    assert window.stack.currentIndex() == 0  # Starts on Import page

    # Switch theme to light and dark
    window._toggle_theme_mode()
    assert window.settings.theme == "light"

    window._toggle_theme_mode()
    assert window.settings.theme == "dark"

    # Toggle settings
    window._toggle_settings()
    assert window.stack.currentIndex() == 3

    window._toggle_settings()
    assert window.stack.currentIndex() == 0

    window.close()
