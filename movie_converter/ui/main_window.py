"""Main application window for Movie Converter.
Hosts the top navigation bar, Stepper, Light/Dark toggle, and 4 stacked screens.
Version: 1.00
"""
from pathlib import Path
from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from movie_converter.core.models import AppSettings, Project
from movie_converter.core.probe import find_tool, probe_media_tracks
from movie_converter.core.settings import load_settings
from movie_converter.ui.export_page import ExportPage
from movie_converter.ui.import_page import ImportPage
from movie_converter.ui.review_page import ReviewPage
from movie_converter.ui.settings_page import SettingsPage
from movie_converter.ui.theme import generate_stylesheet, get_palette
from movie_converter.ui.widgets.stepper import StepperWidget


class MediaProbeWorker(QThread):
    finished_probing = Signal()

    def __init__(self, project: Project, ffprobe_bin: str, mkvmerge_bin: str):
        super().__init__()
        self.project = project
        self.ffprobe_bin = ffprobe_bin
        self.mkvmerge_bin = mkvmerge_bin

    def run(self) -> None:
        for group in self.project.groups:
            # Probe container tracks
            container_tracks = probe_media_tracks(group.source, self.ffprobe_bin, self.mkvmerge_bin)
            # Combine container tracks with any pre-matched external tracks
            external_tracks = [t for t in group.tracks if t.origin == "external"]
            group.tracks = container_tracks + external_tracks
        self.finished_probing.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.settings: AppSettings = load_settings()
        self.project = Project()

        self.setWindowTitle("Movie Converter")
        self.resize(1280, 800)
        self.setMinimumSize(1024, 680)

        self._current_stage_idx = 0  # 0: Import, 1: Review, 2: Export
        self._init_ui()
        self._apply_current_theme()

    def _init_ui(self) -> None:
        central = QWidget()
        central.setObjectName("centralWidget")
        self.setCentralWidget(central)
        root_layout = QVBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # 1. Top Bar (72px)
        self.top_bar = QFrame()
        self.top_bar.setObjectName("topBar")
        top_layout = QHBoxLayout(self.top_bar)
        top_layout.setContentsMargins(28, 0, 28, 0)
        top_layout.setSpacing(20)

        # Logo / Title
        self.app_title = QLabel("Movie Converter")
        self.app_title.setObjectName("appTitle")
        top_layout.addWidget(self.app_title)

        top_layout.addStretch()

        # Center: Stepper
        self.stepper = StepperWidget(current_step=1, parent=self)
        top_layout.addWidget(self.stepper)

        top_layout.addStretch()

        # Top-Right Controls: Theme Toggle + Settings Button
        self.btn_theme_toggle = QPushButton("Dark")
        self.btn_theme_toggle.setFixedWidth(75)
        self.btn_theme_toggle.clicked.connect(self._toggle_theme_mode)
        top_layout.addWidget(self.btn_theme_toggle)

        self.btn_settings = QPushButton("Settings")
        self.btn_settings.clicked.connect(self._toggle_settings)
        top_layout.addWidget(self.btn_settings)

        root_layout.addWidget(self.top_bar)

        # 2. Stacked Pages
        self.stack = QStackedWidget()

        # Page 0: Import
        self.import_page = ImportPage(self.project)
        self.import_page.next_clicked.connect(self._go_to_review)
        self.stack.addWidget(self.import_page)

        # Page 1: Review
        self.review_page = ReviewPage(self.project)
        self.review_page.next_clicked.connect(self._go_to_export)
        self.stack.addWidget(self.review_page)

        # Page 2: Export
        self.export_page = ExportPage(
            project=self.project,
            ffmpeg_bin=self.settings.ffmpeg_path,
            mkvmerge_bin=self.settings.mkvmerge_path,
        )
        self.stack.addWidget(self.export_page)

        # Page 3: Settings
        self.settings_page = SettingsPage()
        self.settings_page.settings_saved.connect(self._on_settings_saved)
        self.settings_page.theme_changed.connect(self._on_theme_changed)
        self.stack.addWidget(self.settings_page)

        root_layout.addWidget(self.stack, stretch=1)

    def _apply_current_theme(self) -> None:
        appearance = self.settings.theme
        if appearance == "system":
            appearance = "dark"

        accent = self.settings.accent
        palette = get_palette(appearance, accent)  # type: ignore

        # Set stylesheet application-wide
        app = QApplication.instance()
        if app:
            app.setStyleSheet(generate_stylesheet(appearance, accent))  # type: ignore

        # Update custom widgets with current palette
        self.stepper.set_palette(palette)
        self.import_page.update_palette(palette)
        self.review_page.update_palette(palette)
        self.export_page.update_palette(palette)

        self.btn_theme_toggle.setText("Light" if appearance == "dark" else "Dark")

    def _toggle_theme_mode(self) -> None:
        curr = self.settings.theme
        new_theme = "light" if curr == "dark" else "dark"
        self.settings.theme = new_theme
        self._apply_current_theme()

    def _on_theme_changed(self, theme: str, accent: str) -> None:
        self.settings.theme = theme  # type: ignore
        self.settings.accent = accent  # type: ignore
        self._apply_current_theme()

    def _on_settings_saved(self, new_settings: AppSettings) -> None:
        self.settings = new_settings
        self.export_page.ffmpeg_bin = new_settings.ffmpeg_path
        self.export_page.mkvmerge_bin = new_settings.mkvmerge_path
        self._apply_current_theme()
        # Return back to active stage
        self.stack.setCurrentIndex(self._current_stage_idx)
        self.btn_settings.setText("Settings")

    def _toggle_settings(self) -> None:
        if self.stack.currentIndex() == 3:
            # Back to previous stage
            self.stack.setCurrentIndex(self._current_stage_idx)
            self.btn_settings.setText("Settings")
        else:
            self._current_stage_idx = self.stack.currentIndex()
            self.stack.setCurrentIndex(3)
            self.btn_settings.setText("Back")

    def _go_to_review(self) -> None:
        # Start probing tracks for all imported videos
        self.import_page.btn_next.setEnabled(False)
        self.import_page.btn_next.setText("Analyzing tracks...")

        self.probe_worker = MediaProbeWorker(
            self.project,
            self.settings.ffprobe_path,
            self.settings.mkvmerge_path,
        )
        self.probe_worker.finished_probing.connect(self._on_probing_finished)
        self.probe_worker.start()

    def _on_probing_finished(self) -> None:
        self.import_page.btn_next.setEnabled(True)
        self.import_page.btn_next.setText("Next: Review →")

        self.review_page.refresh_project_data()
        self.stepper.set_step(2)
        self._current_stage_idx = 1
        self.stack.setCurrentIndex(1)

    def _go_to_export(self) -> None:
        self.export_page.refresh_project_data()
        self.stepper.set_step(3)
        self._current_stage_idx = 2
        self.stack.setCurrentIndex(2)
