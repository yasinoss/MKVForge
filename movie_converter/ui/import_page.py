"""Stage 1: Import page with drag-and-drop zone and import statistics.
Version: 1.00
"""
from pathlib import Path
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QDragEnterEvent, QDropEvent
from PySide6.QtWidgets import (
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from movie_converter.core.grouping import (
    AUDIO_EXTENSIONS,
    CHAPTERS_EXTENSIONS,
    SUBTITLE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    get_file_kind,
    group_files,
)
from movie_converter.core.models import Project
from movie_converter.ui.theme import ColorPalette
from movie_converter.ui.widgets.action_chip import TrackTypeTag


class DropZoneFrame(QFrame):
    files_dropped = Signal(list)

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setObjectName("dropZone")
        self.setAcceptDrops(True)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def dragEnterEvent(self, event: QDragEnterEvent) -> None:
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            self.setProperty("class", "dragOver")
            self.style().unpolish(self)
            self.style().polish(self)

    def dragLeaveEvent(self, event) -> None:
        self.setProperty("class", "")
        self.style().unpolish(self)
        self.style().polish(self)

    def dropEvent(self, event: QDropEvent) -> None:
        self.setProperty("class", "")
        self.style().unpolish(self)
        self.style().polish(self)

        paths = []
        for url in event.mimeData().urls():
            p = Path(url.toLocalFile())
            if p.is_dir():
                for sub in p.rglob("*"):
                    if sub.is_file():
                        paths.append(sub)
            elif p.is_file():
                paths.append(p)

        if paths:
            self.files_dropped.emit(paths)
        event.acceptProposedAction()


class ImportPage(QWidget):
    next_clicked = Signal()
    files_imported = Signal(list)

    def __init__(self, project: Project, parent: QWidget | None = None):
        super().__init__(parent)
        self.project = project
        self.all_imported_files: list[Path] = []
        self._init_ui()

    def _init_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 24, 40, 32)
        layout.setSpacing(20)

        # Title & Subtitle
        header_layout = QVBoxLayout()
        header_layout.setSpacing(4)
        title = QLabel("Import your files")
        title.setObjectName("pageTitle")
        subtitle = QLabel("Add everything for the job at once. Files with matching names are grouped under the same video.")
        subtitle.setObjectName("pageSubtitle")
        header_layout.addWidget(title)
        header_layout.addWidget(subtitle)
        layout.addLayout(header_layout)

        # Drop Zone Frame
        self.drop_zone = DropZoneFrame(self)
        self.drop_zone.files_dropped.connect(self._handle_files_added)
        drop_layout = QVBoxLayout(self.drop_zone)
        drop_layout.setContentsMargins(30, 40, 30, 40)
        drop_layout.setSpacing(16)
        drop_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        drop_label = QLabel("Drag files or folders here")
        drop_label.setStyleSheet("font-size: 18px; font-weight: 600;")
        drop_layout.addWidget(drop_label, alignment=Qt.AlignmentFlag.AlignCenter)

        # Tags row
        tags_row = QHBoxLayout()
        tags_row.setSpacing(8)
        tags_row.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.tag_video = TrackTypeTag("video")
        self.tag_audio = TrackTypeTag("audio")
        self.tag_sub = TrackTypeTag("subtitle")
        self.tag_chap = TrackTypeTag("chapters")
        for tag in [self.tag_video, self.tag_audio, self.tag_sub, self.tag_chap]:
            tags_row.addWidget(tag)
        drop_layout.addLayout(tags_row)

        # Buttons row
        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)
        btn_row.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.btn_add_files = QPushButton("Add files")
        self.btn_add_files.setMinimumWidth(110)
        self.btn_add_files.clicked.connect(self._browse_files)
        btn_row.addWidget(self.btn_add_files)

        self.btn_add_folder = QPushButton("Add folder")
        self.btn_add_folder.setMinimumWidth(110)
        self.btn_add_folder.clicked.connect(self._browse_folder)
        btn_row.addWidget(self.btn_add_folder)

        drop_layout.addLayout(btn_row)
        layout.addWidget(self.drop_zone, stretch=1)

        # Imported so far Card
        self.stats_card = QFrame()
        self.stats_card.setProperty("class", "card")
        stats_layout = QVBoxLayout(self.stats_card)
        stats_layout.setContentsMargins(24, 16, 24, 16)
        stats_layout.setSpacing(8)

        section_hdr = QLabel("IMPORTED SO FAR")
        section_hdr.setProperty("class", "sectionHeader")
        stats_layout.addWidget(section_hdr)

        cols_layout = QHBoxLayout()
        self.num_videos = QLabel("0")
        self.num_videos.setProperty("class", "statNumber")
        self.num_audios = QLabel("0")
        self.num_audios.setProperty("class", "statNumber")
        self.num_subs = QLabel("0")
        self.num_subs.setProperty("class", "statNumber")
        self.num_chaps = QLabel("0")
        self.num_chaps.setProperty("class", "statNumber")
        self.num_groups = QLabel("0")
        self.num_groups.setProperty("class", "statNumber")

        def make_stat_col(num_lbl: QLabel, text: str) -> QVBoxLayout:
            col = QVBoxLayout()
            col.setSpacing(2)
            col.addWidget(num_lbl)
            lbl = QLabel(text)
            lbl.setProperty("class", "statLabel")
            col.addWidget(lbl)
            return col

        cols_layout.addLayout(make_stat_col(self.num_videos, "Videos"))
        cols_layout.addLayout(make_stat_col(self.num_audios, "Audio files"))
        cols_layout.addLayout(make_stat_col(self.num_subs, "Subtitles"))
        cols_layout.addLayout(make_stat_col(self.num_chaps, "Chapters"))
        cols_layout.addLayout(make_stat_col(self.num_groups, "Groups found"))

        stats_layout.addLayout(cols_layout)
        layout.addWidget(self.stats_card)

        # Footer
        footer_layout = QHBoxLayout()
        self.footer_hint = QLabel("Next, you will check each video and its files.")
        self.footer_hint.setStyleSheet("color: #71717A; font-size: 13px;")
        footer_layout.addWidget(self.footer_hint)
        footer_layout.addStretch()

        self.btn_next = QPushButton("Next: Review →")
        self.btn_next.setProperty("class", "primaryButton")
        self.btn_next.setEnabled(False)
        self.btn_next.clicked.connect(self.next_clicked.emit)
        footer_layout.addWidget(self.btn_next)

        layout.addLayout(footer_layout)

    def update_palette(self, palette: ColorPalette) -> None:
        for tag in [self.tag_video, self.tag_audio, self.tag_sub, self.tag_chap]:
            tag.update_palette(palette)

    def _browse_files(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Media and Subtitle Files",
            "",
            "Media Files (*.mkv *.mp4 *.m4v *.avi *.ts *.srt *.ass *.ac3 *.aac *.eac3 *.flac *.xml);;All Files (*.*)",
        )
        if files:
            self._handle_files_added([Path(f) for f in files])

    def _browse_folder(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Select Folder to Import")
        if folder:
            paths = [p for p in Path(folder).rglob("*") if p.is_file()]
            self._handle_files_added(paths)

    def _handle_files_added(self, paths: list[Path]) -> None:
        valid_paths = [p for p in paths if get_file_kind(p) != "unknown"]
        for p in valid_paths:
            if p not in self.all_imported_files:
                self.all_imported_files.append(p)

        self._update_stats_and_grouping()
        self.files_imported.emit(self.all_imported_files)

    def _update_stats_and_grouping(self) -> None:
        v_count = sum(1 for p in self.all_imported_files if p.suffix.lower() in VIDEO_EXTENSIONS)
        a_count = sum(1 for p in self.all_imported_files if p.suffix.lower() in AUDIO_EXTENSIONS)
        s_count = sum(1 for p in self.all_imported_files if p.suffix.lower() in SUBTITLE_EXTENSIONS)
        c_count = sum(1 for p in self.all_imported_files if p.suffix.lower() in CHAPTERS_EXTENSIONS)

        groups, unassigned = group_files(self.all_imported_files)
        self.project.groups = groups
        self.project.unassigned_files = unassigned

        self.num_videos.setText(str(v_count))
        self.num_audios.setText(str(a_count))
        self.num_subs.setText(str(s_count))
        self.num_chaps.setText(str(c_count))
        self.num_groups.setText(str(len(groups)))

        self.btn_next.setEnabled(v_count > 0)
