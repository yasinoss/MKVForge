"""Stage 3: Export page with output settings, shared attachments, and live queue monitoring.
Version: 1.00
"""
import os
from pathlib import Path
from PySide6.QtCore import Qt, Signal, QTimer
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QProgressBar,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from movie_converter.core.models import Job, Project
from movie_converter.core.queue import JobQueueManager
from movie_converter.ui.theme import ColorPalette
from movie_converter.ui.widgets.action_chip import ActionChip


class ExportPage(QWidget):
    def __init__(self, project: Project, ffmpeg_bin: str = "ffmpeg", mkvmerge_bin: str = "mkvmerge", parent: QWidget | None = None):
        super().__init__(parent)
        self.project = project
        self.ffmpeg_bin = ffmpeg_bin
        self.mkvmerge_bin = mkvmerge_bin
        self.queue_mgr: JobQueueManager | None = None
        self.palette: ColorPalette | None = None
        self._init_ui()

    def _init_ui(self) -> None:
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(24, 16, 24, 24)
        main_layout.setSpacing(16)

        # 1. Output Settings Card
        out_card = QFrame()
        out_card.setProperty("class", "card")
        out_layout = QVBoxLayout(out_card)
        out_layout.setContentsMargins(20, 16, 20, 16)
        out_layout.setSpacing(12)

        # Top row: Output Folder
        folder_row = QHBoxLayout()
        folder_row.setSpacing(10)
        lbl_folder = QLabel("Output folder")
        lbl_folder.setFixedWidth(100)
        self.txt_output_folder = QLineEdit(str(self.project.export.output_folder))
        self.btn_browse = QPushButton("Browse")
        self.btn_browse.clicked.connect(self._browse_output_folder)
        folder_row.addWidget(lbl_folder)
        folder_row.addWidget(self.txt_output_folder, stretch=1)
        folder_row.addWidget(self.btn_browse)
        out_layout.addLayout(folder_row)

        # Middle row: File name pattern & Exists policy
        mid_row = QHBoxLayout()
        mid_row.setSpacing(16)

        lbl_pattern = QLabel("File name")
        lbl_pattern.setFixedWidth(100)
        self.combo_pattern = QComboBox()
        self.combo_pattern.setEditable(True)
        self.combo_pattern.addItem("{show} - S{season}E{episode}")
        self.combo_pattern.addItem("{show}/Season {season}/{show} - S{season}E{episode}")
        self.combo_pattern.addItem("{name}")
        mid_row.addWidget(lbl_pattern)
        mid_row.addWidget(self.combo_pattern, stretch=2)

        lbl_exists = QLabel("If file exists")
        self.combo_exists = QComboBox()
        self.combo_exists.addItem("Ask me", "ask")
        self.combo_exists.addItem("Overwrite", "overwrite")
        self.combo_exists.addItem("Skip", "skip")
        self.combo_exists.addItem("Rename", "rename")
        mid_row.addWidget(lbl_exists)
        mid_row.addWidget(self.combo_exists, stretch=1)
        out_layout.addLayout(mid_row)

        # Bottom row: Checkboxes
        chk_row = QHBoxLayout()
        chk_row.setSpacing(24)
        self.chk_recycle = QCheckBox("Delete original files after success (Send to Recycle Bin)")
        self.chk_recycle.setChecked(self.project.export.delete_originals)
        self.chk_shutdown = QCheckBox("Shut down the PC when finished")
        self.chk_shutdown.setChecked(self.project.export.shutdown_when_finished)
        chk_row.addWidget(self.chk_recycle)
        chk_row.addWidget(self.chk_shutdown)
        chk_row.addStretch()
        out_layout.addLayout(chk_row)

        main_layout.addWidget(out_card)

        # 2. Shared Attachments Strip
        att_card = QFrame()
        att_card.setProperty("class", "card")
        att_layout = QHBoxLayout(att_card)
        att_layout.setContentsMargins(16, 12, 16, 12)
        att_layout.setSpacing(16)

        lbl_att_title = QLabel("Attachments")
        lbl_att_title.setStyleSheet("font-weight: 700; font-size: 14px;")
        self.lbl_att_desc = QLabel("Added to all videos")
        self.lbl_att_desc.setProperty("class", "statLabel")
        att_box = QVBoxLayout()
        att_box.addWidget(lbl_att_title)
        att_box.addWidget(self.lbl_att_desc)
        att_layout.addLayout(att_box)

        self.att_files_label = QLabel("None")
        att_layout.addWidget(self.att_files_label, stretch=1)

        self.btn_add_shared_att = QPushButton("+ Add attachment")
        self.btn_add_shared_att.clicked.connect(self._add_shared_attachment)
        att_layout.addWidget(self.btn_add_shared_att)

        self.chk_remove_old_att = QCheckBox("Remove old attachments first")
        self.chk_remove_old_att.setChecked(self.project.remove_old_attachments)
        self.chk_remove_old_att.toggled.connect(self._toggle_remove_old_att)
        att_layout.addWidget(self.chk_remove_old_att)

        main_layout.addWidget(att_card)

        # 3. Queue Card
        queue_card = QFrame()
        queue_card.setProperty("class", "card")
        q_layout = QVBoxLayout(queue_card)
        q_layout.setContentsMargins(16, 14, 16, 14)
        q_layout.setSpacing(10)

        q_header_row = QHBoxLayout()
        self.lbl_queue_title = QLabel("Queue · 0 videos")
        self.lbl_queue_title.setStyleSheet("font-weight: 700; font-size: 15px;")
        self.lbl_queue_progress = QLabel("0 of 0 done")
        self.lbl_queue_progress.setProperty("class", "statLabel")
        q_header_row.addWidget(self.lbl_queue_title)
        q_header_row.addStretch()
        q_header_row.addWidget(self.lbl_queue_progress)
        q_layout.addLayout(q_header_row)

        self.queue_table = QTableWidget()
        self.queue_table.setColumnCount(4)
        self.queue_table.setHorizontalHeaderLabels(["Video", "Plan", "Progress", "Status"])
        self.queue_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.queue_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.queue_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.queue_table.verticalHeader().setVisible(False)
        q_layout.addWidget(self.queue_table)

        main_layout.addWidget(queue_card, stretch=1)

        # 4. Footer Buttons
        footer_layout = QHBoxLayout()
        footer_layout.setSpacing(12)

        self.btn_pause = QPushButton("Pause")
        self.btn_pause.setEnabled(False)
        self.btn_pause.clicked.connect(self._toggle_pause)
        footer_layout.addWidget(self.btn_pause)

        self.btn_skip = QPushButton("Skip current")
        self.btn_skip.setEnabled(False)
        self.btn_skip.clicked.connect(self._skip_current)
        footer_layout.addWidget(self.btn_skip)

        self.btn_cancel = QPushButton("Cancel all")
        self.btn_cancel.setEnabled(False)
        self.btn_cancel.clicked.connect(self._cancel_all)
        footer_layout.addWidget(self.btn_cancel)

        self.btn_open_folder = QPushButton("Open output folder")
        self.btn_open_folder.clicked.connect(self._open_output_folder)
        footer_layout.addWidget(self.btn_open_folder)

        footer_layout.addStretch()

        self.btn_start = QPushButton("Start")
        self.btn_start.setProperty("class", "primaryButton")
        self.btn_start.clicked.connect(self._start_queue)
        footer_layout.addWidget(self.btn_start)

        main_layout.addLayout(footer_layout)

    def refresh_project_data(self) -> None:
        """Called when entering Export stage."""
        self.lbl_att_desc.setText(f"Added to all {len(self.project.groups)} videos")
        self.lbl_queue_title.setText(f"Queue · {len(self.project.groups)} videos")
        self._init_queue_table()

    def update_palette(self, palette: ColorPalette) -> None:
        self.palette = palette
        self._refresh_chips()

    def _init_queue_table(self) -> None:
        self.queue_table.setRowCount(len(self.project.groups))
        for row, g in enumerate(self.project.groups):
            # Video Key
            item_v = QTableWidgetItem(g.key)
            self.queue_table.setItem(row, 0, item_v)

            # Plan summary text
            actions = list(g.plan.values())
            has_v_conv = any(a.kind == "convert" for a in actions if a.target_codec)
            has_a_conv = any(a.kind == "convert" for a in actions if not a.target_codec)
            has_add = any(a.kind == "add" for a in actions)

            summary_parts = []
            if has_v_conv:
                summary_parts.append("Convert video")
            else:
                summary_parts.append("Keep video")
            if has_a_conv:
                summary_parts.append("+convert audio")
            if has_add:
                summary_parts.append("+external files")

            item_plan = QTableWidgetItem(" · ".join(summary_parts))
            self.queue_table.setItem(row, 1, item_plan)

            # Progress Bar
            pbar = QProgressBar()
            pbar.setRange(0, 100)
            pbar.setValue(0)
            self.queue_table.setCellWidget(row, 2, pbar)

            # Status Chip
            chip = ActionChip("Waiting", "neutral")
            if self.palette:
                chip.update_palette(self.palette)
            self.queue_table.setCellWidget(row, 3, chip)

    def _start_queue(self) -> None:
        # Save output settings into project
        self.project.export.output_folder = Path(self.txt_output_folder.text().strip() or ".")
        self.project.export.file_name_pattern = self.combo_pattern.currentText().strip()
        self.project.export.if_exists = self.combo_exists.currentData() or "ask"
        self.project.export.delete_originals = self.chk_recycle.isChecked()
        self.project.export.shutdown_when_finished = self.chk_shutdown.isChecked()

        self.queue_mgr = JobQueueManager(
            project=self.project,
            ffmpeg_bin=self.ffmpeg_bin,
            mkvmerge_bin=self.mkvmerge_bin,
            on_job_updated=self._on_job_updated,
            on_all_finished=self._on_all_finished,
        )

        self.btn_start.setEnabled(False)
        self.btn_pause.setEnabled(True)
        self.btn_skip.setEnabled(True)
        self.btn_cancel.setEnabled(True)

        self.queue_mgr.start()

    def _on_job_updated(self, job: Job) -> None:
        # Schedule on UI thread
        QTimer.singleShot(0, lambda: self._update_job_row(job))

    def _update_job_row(self, job: Job) -> None:
        row = next((i for i, g in enumerate(self.project.groups) if g.key == job.group.key), -1)
        if row < 0:
            return

        pbar = self.queue_table.cellWidget(row, 2)
        if isinstance(pbar, QProgressBar):
            pbar.setValue(int(job.progress))

        # Update Chip
        status_types = {
            "waiting": ("Waiting", "neutral"),
            "running": (f"Running {job.speed}".strip(), "blue"),
            "done": ("Done", "green"),
            "warning": ("Warning", "amber"),
            "failed": ("Failed", "red"),
            "skipped": ("Skipped", "neutral"),
            "cancelled": ("Cancelled", "red"),
        }
        text, chip_type = status_types.get(job.status, ("Waiting", "neutral"))
        chip = ActionChip(text, chip_type)  # type: ignore
        if self.palette:
            chip.update_palette(self.palette)
        self.queue_table.setCellWidget(row, 3, chip)

        # Update header progress count
        if self.queue_mgr:
            done_cnt = sum(1 for j in self.queue_mgr.jobs if j.status in ("done", "warning", "skipped"))
            self.lbl_queue_progress.setText(f"{done_cnt} of {len(self.queue_mgr.jobs)} done")

    def _on_all_finished(self) -> None:
        def finish_ui():
            self.btn_start.setEnabled(True)
            self.btn_pause.setEnabled(False)
            self.btn_skip.setEnabled(False)
            self.btn_cancel.setEnabled(False)

            if self.project.export.shutdown_when_finished:
                os.system("shutdown /s /t 60")

        QTimer.singleShot(0, finish_ui)

    def _toggle_pause(self) -> None:
        if not self.queue_mgr:
            return
        if self.queue_mgr._is_paused:
            self.queue_mgr.resume()
            self.btn_pause.setText("Pause")
        else:
            self.queue_mgr.pause()
            self.btn_pause.setText("Resume")

    def _skip_current(self) -> None:
        if self.queue_mgr:
            self.queue_mgr.skip_current()

    def _cancel_all(self) -> None:
        if self.queue_mgr:
            self.queue_mgr.cancel_all()

    def _open_output_folder(self) -> None:
        folder = Path(self.txt_output_folder.text().strip() or ".")
        if folder.exists():
            os.startfile(str(folder))

    def _browse_output_folder(self) -> None:
        d = QFileDialog.getExistingDirectory(self, "Select Output Folder", self.txt_output_folder.text())
        if d:
            self.txt_output_folder.setText(d)

    def _add_shared_attachment(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Shared Attachments (Applied to all videos)",
            "",
            "Fonts and Images (*.ttf *.otf *.jpg *.jpeg *.png);;All Files (*.*)",
        )
        if files:
            for f in files:
                p = Path(f)
                if p not in self.project.shared_attachments:
                    self.project.shared_attachments.append(p)
            names = ", ".join(p.name for p in self.project.shared_attachments)
            self.att_files_label.setText(names or "None")

    def _toggle_remove_old_att(self, checked: bool) -> None:
        self.project.remove_old_attachments = checked

    def _refresh_chips(self) -> None:
        pass
