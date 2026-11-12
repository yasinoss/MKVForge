"""Stage 2: Review page with Quick Settings bar, video list, and interactive track table.
Version: 1.00
"""
from pathlib import Path
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QSpinBox,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from movie_converter.core.languages import LANGUAGE_MAP, get_language_display_name
from movie_converter.core.models import Preset, Project, Track, TrackAction, VideoGroup
from movie_converter.core.planner import update_project_plans
from movie_converter.core.presets import load_presets
from movie_converter.ui.theme import ColorPalette
from movie_converter.ui.widgets.action_chip import ActionChip, TrackTypeTag


class ReviewPage(QWidget):
    next_clicked = Signal()

    def __init__(self, project: Project, parent: QWidget | None = None):
        super().__init__(parent)
        self.project = project
        self.presets = load_presets()
        self.palette: ColorPalette | None = None
        self.selected_group: VideoGroup | None = None
        self._init_ui()

    def _init_ui(self) -> None:
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(20, 12, 20, 20)
        main_layout.setSpacing(12)

        # 1. Quick Settings Bar
        self.quick_bar = QFrame()
        self.quick_bar.setObjectName("quickBar")
        self.quick_bar.setProperty("class", "card")
        quick_layout = QHBoxLayout(self.quick_bar)
        quick_layout.setContentsMargins(16, 10, 16, 10)
        quick_layout.setSpacing(16)

        # Quick settings label
        lbl_box = QVBoxLayout()
        lbl_box.setSpacing(2)
        q_title = QLabel("Quick settings")
        q_title.setStyleSheet("font-weight: 700; font-size: 14px;")
        self.q_subtitle = QLabel("Applied to all videos")
        self.q_subtitle.setProperty("class", "statLabel")
        lbl_box.addWidget(q_title)
        lbl_box.addWidget(self.q_subtitle)
        quick_layout.addLayout(lbl_box)

        # Video Preset dropdown
        col_preset = QVBoxLayout()
        col_preset.setSpacing(2)
        lbl_p = QLabel("Video preset")
        lbl_p.setProperty("class", "sectionHeader")
        self.combo_preset = QComboBox()
        for p in self.presets.values():
            self.combo_preset.addItem(p.name, p.id)
        self.combo_preset.currentIndexChanged.connect(self._on_quick_settings_changed)
        col_preset.addWidget(lbl_p)
        col_preset.addWidget(self.combo_preset)
        quick_layout.addLayout(col_preset)

        # Remove audio langs
        col_rm_audio = QVBoxLayout()
        col_rm_audio.setSpacing(2)
        lbl_ra = QLabel("Remove audio")
        lbl_ra.setProperty("class", "sectionHeader")
        self.combo_rm_audio = QComboBox()
        self.combo_rm_audio.addItem("None", "")
        self.combo_rm_audio.addItem("French (fra)", "fra")
        self.combo_rm_audio.addItem("German (deu)", "deu")
        self.combo_rm_audio.addItem("Spanish (spa)", "spa")
        self.combo_rm_audio.currentIndexChanged.connect(self._on_quick_settings_changed)
        col_rm_audio.addWidget(lbl_ra)
        col_rm_audio.addWidget(self.combo_rm_audio)
        quick_layout.addLayout(col_rm_audio)

        # Remove sub langs
        col_rm_sub = QVBoxLayout()
        col_rm_sub.setSpacing(2)
        lbl_rs = QLabel("Remove subtitles")
        lbl_rs.setProperty("class", "sectionHeader")
        self.combo_rm_sub = QComboBox()
        self.combo_rm_sub.addItem("None", "")
        self.combo_rm_sub.addItem("French (fra)", "fra")
        self.combo_rm_sub.addItem("German (deu)", "deu")
        self.combo_rm_sub.addItem("Spanish (spa)", "spa")
        self.combo_rm_sub.currentIndexChanged.connect(self._on_quick_settings_changed)
        col_rm_sub.addWidget(lbl_rs)
        col_rm_sub.addWidget(self.combo_rm_sub)
        quick_layout.addLayout(col_rm_sub)

        # Default Audio
        col_def_audio = QVBoxLayout()
        col_def_audio.setSpacing(2)
        lbl_da = QLabel("Default audio")
        lbl_da.setProperty("class", "sectionHeader")
        self.combo_def_audio = QComboBox()
        self.combo_def_audio.addItem("Keep as in file", "keep")
        self.combo_def_audio.addItem("English (eng)", "eng")
        self.combo_def_audio.addItem("Arabic (ara)", "ara")
        self.combo_def_audio.currentIndexChanged.connect(self._on_quick_settings_changed)
        col_def_audio.addWidget(lbl_da)
        col_def_audio.addWidget(self.combo_def_audio)
        quick_layout.addLayout(col_def_audio)

        # Default Subtitle
        col_def_sub = QVBoxLayout()
        col_def_sub.setSpacing(2)
        lbl_ds = QLabel("Default subtitle")
        lbl_ds.setProperty("class", "sectionHeader")
        self.combo_def_sub = QComboBox()
        self.combo_def_sub.addItem("Keep as in file", "keep")
        self.combo_def_sub.addItem("Arabic (ara)", "ara")
        self.combo_def_sub.addItem("English (eng)", "eng")
        self.combo_def_sub.currentIndexChanged.connect(self._on_quick_settings_changed)
        col_def_sub.addWidget(lbl_ds)
        col_def_sub.addWidget(self.combo_def_sub)
        quick_layout.addLayout(col_def_sub)

        main_layout.addWidget(self.quick_bar)

        # 2. Splitter: Video List (Left) and Track Table (Right)
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left: Video list container
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(8)

        self.lbl_videos_count = QLabel("VIDEOS (0)")
        self.lbl_videos_count.setProperty("class", "sectionHeader")
        left_layout.addWidget(self.lbl_videos_count)

        self.video_list = QListWidget()
        self.video_list.setFixedWidth(280)
        self.video_list.currentRowChanged.connect(self._on_video_selected)
        left_layout.addWidget(self.video_list)
        splitter.addWidget(left_widget)

        # Right: Detail & Track Table
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(12, 0, 0, 0)
        right_layout.setSpacing(10)

        # Detail Header
        self.header_detail = QFrame()
        self.header_detail.setProperty("class", "card")
        hdr_det_layout = QHBoxLayout(self.header_detail)
        hdr_det_layout.setContentsMargins(16, 12, 16, 12)

        title_box = QVBoxLayout()
        title_box.setSpacing(2)
        self.detail_key = QLabel("Select a video")
        self.detail_key.setStyleSheet("font-size: 16px; font-weight: 700;")
        self.detail_desc = QLabel("Everything that will go into the final file")
        self.detail_desc.setProperty("class", "statLabel")
        title_box.addWidget(self.detail_key)
        title_box.addWidget(self.detail_desc)
        hdr_det_layout.addLayout(title_box)
        hdr_det_layout.addStretch()

        self.btn_add_attachment = QPushButton("+ Add Attachment")
        self.btn_add_attachment.clicked.connect(self._add_attachment_to_group)
        hdr_det_layout.addWidget(self.btn_add_attachment)

        right_layout.addWidget(self.header_detail)

        # Table
        self.track_table = QTableWidget()
        self.track_table.setColumnCount(6)
        self.track_table.setHorizontalHeaderLabels(["Kind", "Track / Details", "Language", "Default", "Delay (ms)", "Action"])
        self.track_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.track_table.verticalHeader().setVisible(False)
        self.track_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        right_layout.addWidget(self.track_table)

        splitter.addWidget(right_widget)
        splitter.setStretchFactor(1, 1)
        main_layout.addWidget(splitter, stretch=1)

        # 3. Footer
        footer_layout = QHBoxLayout()
        self.status_line = QLabel("All videos ready")
        self.status_line.setStyleSheet("font-size: 13px; font-weight: 500;")
        footer_layout.addWidget(self.status_line)
        footer_layout.addStretch()

        self.btn_next = QPushButton("Next: Export →")
        self.btn_next.setProperty("class", "primaryButton")
        self.btn_next.clicked.connect(self.next_clicked.emit)
        footer_layout.addWidget(self.btn_next)

        main_layout.addLayout(footer_layout)

    def refresh_project_data(self) -> None:
        """Called when entering Review stage or when files change."""
        self.q_subtitle.setText(f"Applied to all {len(self.project.groups)} videos")
        self.lbl_videos_count.setText(f"VIDEOS ({len(self.project.groups)})")

        self._on_quick_settings_changed()
        self._populate_video_list()

    def update_palette(self, palette: ColorPalette) -> None:
        self.palette = palette
        self._populate_video_list()
        self._populate_track_table()

    def _populate_video_list(self) -> None:
        curr = self.video_list.currentRow()
        self.video_list.clear()

        for g in self.project.groups:
            item = QListWidgetItem()
            audio_count = sum(1 for t in g.tracks if t.kind == "audio")
            sub_count = sum(1 for t in g.tracks if t.kind == "subtitle")
            ext_count = sum(1 for t in g.tracks if t.origin == "external")

            badge_str = f" [{', '.join(g.badges)}]" if g.badges else ""
            line1 = f"{g.key}{badge_str}"
            line2 = f"MKV · {audio_count} audio · {sub_count} subs · +{ext_count} files"

            item.setText(f"{line1}\n{line2}")
            self.video_list.addItem(item)

        if self.project.groups:
            idx = max(0, min(curr, len(self.project.groups) - 1))
            self.video_list.setCurrentRow(idx)

    def _on_video_selected(self, row: int) -> None:
        if 0 <= row < len(self.project.groups):
            self.selected_group = self.project.groups[row]
            self.detail_key.setText(self.selected_group.key)
            self._populate_track_table()

    def _populate_track_table(self) -> None:
        if not self.selected_group:
            self.track_table.setRowCount(0)
            return

        g = self.selected_group
        self.track_table.setRowCount(len(g.tracks))

        for row, t in enumerate(g.tracks):
            # 0. Kind Tag
            tag = TrackTypeTag(t.kind)
            if self.palette:
                tag.update_palette(self.palette)
            self.track_table.setCellWidget(row, 0, tag)

            # 1. Details
            origin_info = "(container)" if t.origin == "container" else "(external)"
            name_text = f"{t.codec} {origin_info} {t.name}".strip()
            item_detail = QTableWidgetItem(name_text)
            self.track_table.setItem(row, 1, item_detail)

            # 2. Language
            lang_name = get_language_display_name(t.language)
            self.track_table.setItem(row, 2, QTableWidgetItem(lang_name))

            # 3. Default Flag
            cb_def = QComboBox()
            cb_def.addItem("No", False)
            cb_def.addItem("Yes", True)
            cb_def.setCurrentIndex(1 if t.is_default else 0)
            cb_def.currentIndexChanged.connect(lambda idx, track=t: self._on_track_default_changed(track, idx == 1))
            self.track_table.setCellWidget(row, 3, cb_def)

            # 4. Delay SpinBox (ms) for sync offset
            spin_delay = QSpinBox()
            spin_delay.setRange(-60000, 60000)
            spin_delay.setSingleStep(50)
            spin_delay.setValue(t.delay_ms)
            spin_delay.valueChanged.connect(lambda val, track=t: self._on_track_delay_changed(track, val))
            self.track_table.setCellWidget(row, 4, spin_delay)

            # 5. Action ComboBox
            action = g.plan.get(t.id, TrackAction(kind="keep"))
            cb_action = QComboBox()
            actions_list = ["Keep", "Convert", "Remove"] if t.origin == "container" else ["Add", "Remove"]
            for a in actions_list:
                cb_action.addItem(a, a.lower())

            curr_idx = cb_action.findData(action.kind)
            if curr_idx >= 0:
                cb_action.setCurrentIndex(curr_idx)

            cb_action.currentIndexChanged.connect(lambda idx, track=t, box=cb_action: self._on_track_action_changed(track, box.currentData()))
            self.track_table.setCellWidget(row, 5, cb_action)

    def _on_quick_settings_changed(self) -> None:
        self.project.quick.video_preset_id = self.combo_preset.currentData() or "copy"

        rm_audio = self.combo_rm_audio.currentData()
        self.project.quick.remove_audio_languages = [rm_audio] if rm_audio else []

        rm_sub = self.combo_rm_sub.currentData()
        self.project.quick.remove_subtitle_languages = [rm_sub] if rm_sub else []

        self.project.quick.default_audio_language = self.combo_def_audio.currentData() or "keep"
        self.project.quick.default_subtitle_language = self.combo_def_sub.currentData() or "keep"

        update_project_plans(self.project, self.presets)
        self._populate_video_list()
        self._populate_track_table()
        self._update_status_line()

    def _on_track_default_changed(self, track: Track, is_default: bool) -> None:
        track.is_default = is_default
        if self.selected_group:
            self.selected_group.overrides.add(track.id)

    def _on_track_delay_changed(self, track: Track, delay: int) -> None:
        track.delay_ms = delay
        if self.selected_group:
            self.selected_group.overrides.add(track.id)
            if track.id in self.selected_group.plan:
                self.selected_group.plan[track.id].delay_ms = delay

    def _on_track_action_changed(self, track: Track, action_str: str) -> None:
        if self.selected_group:
            self.selected_group.overrides.add(track.id)
            self.selected_group.plan[track.id] = TrackAction(kind=action_str, delay_ms=track.delay_ms)  # type: ignore
            self._update_status_line()

    def _add_attachment_to_group(self) -> None:
        if not self.selected_group:
            return
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Attachments (Fonts, Cover)",
            "",
            "Fonts and Images (*.ttf *.otf *.jpg *.jpeg *.png);;All Files (*.*)",
        )
        if files:
            for f in files:
                p = Path(f)
                if p not in self.selected_group.attachments_added:
                    self.selected_group.attachments_added.append(p)
                    # Add as track in list
                    t = Track(
                        id=f"att_add:{p.name}",
                        kind="attachment",
                        origin="external",
                        source_path=p,
                        source_index=0,
                        codec=p.suffix.lstrip(".").upper(),
                        language="und",
                        name=p.name,
                    )
                    self.selected_group.tracks.append(t)
                    self.selected_group.plan[t.id] = TrackAction(kind="add")
            self._populate_track_table()

    def _update_status_line(self) -> None:
        attention_count = sum(1 for g in self.project.groups if g.warnings or "No sub" in g.badges)
        if attention_count > 0:
            self.status_line.setText(f"{len(self.project.groups)} videos ready · {attention_count} need attention")
            self.status_line.setStyleSheet("color: #D97706; font-size: 13px; font-weight: 600;")
        else:
            self.status_line.setText(f"All {len(self.project.groups)} videos ready for export")
            self.status_line.setStyleSheet("color: #10B981; font-size: 13px; font-weight: 600;")
