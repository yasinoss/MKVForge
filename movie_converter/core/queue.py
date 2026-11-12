"""Queue processor for executing video conversion jobs.
Manages sequential processing, automatic UTF-8 subtitle conversion,
validation of .mkv.part outputs, and safe recycling of source files.
Version: 1.00
"""
from collections.abc import Callable
import os
from pathlib import Path
import shutil
import threading
import time

from send2trash import send2trash

from movie_converter.core.commands import build_output_filepath, generate_group_commands
from movie_converter.core.models import Job, Project
from movie_converter.core.runners import ProcessExecutionError, StepRunner
from movie_converter.core.subtitles import ensure_clean_utf8_subtitle


class JobQueueManager:
    """Manages sequential execution of project jobs on a worker thread."""

    def __init__(
        self,
        project: Project,
        ffmpeg_bin: str = "ffmpeg",
        mkvmerge_bin: str = "mkvmerge",
        on_job_updated: Callable[[Job], None] | None = None,
        on_all_finished: Callable[[], None] | None = None,
    ):
        self.project = project
        self.ffmpeg_bin = ffmpeg_bin
        self.mkvmerge_bin = mkvmerge_bin
        self.on_job_updated = on_job_updated
        self.on_all_finished = on_all_finished

        self.jobs: list[Job] = []
        self._init_jobs()

        self._thread: threading.Thread | None = None
        self._is_running = False
        self._is_paused = False
        self._skip_current_requested = False
        self._cancel_all_requested = False
        self._current_runner: StepRunner | None = None

    def _init_jobs(self) -> None:
        self.jobs = [Job(id=f"job_{i}", group=g) for i, g in enumerate(self.project.groups)]

    def start(self) -> None:
        if self._is_running:
            if self._is_paused:
                self.resume()
            return

        self._is_running = True
        self._is_paused = False
        self._cancel_all_requested = False
        self._skip_current_requested = False

        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()

    def pause(self) -> None:
        self._is_paused = True
        if self._current_runner:
            self._current_runner.pause()

    def resume(self) -> None:
        self._is_paused = False
        if self._current_runner:
            self._current_runner.resume()

    def skip_current(self) -> None:
        self._skip_current_requested = True
        if self._current_runner:
            self._current_runner.cancel()

    def cancel_all(self) -> None:
        self._cancel_all_requested = True
        if self._current_runner:
            self._current_runner.cancel()

    def _worker_loop(self) -> None:
        for job in self.jobs:
            if self._cancel_all_requested:
                job.status = "cancelled"
                self._notify_job(job)
                continue

            if job.status == "done":
                continue

            self._process_single_job(job)

        self._is_running = False
        if self.on_all_finished:
            self.on_all_finished()

    def _process_single_job(self, job: Job) -> None:
        group = job.group
        job.status = "running"
        job.progress = 0.0
        self._notify_job(job)

        export = self.project.export
        output_final_path = build_output_filepath(group, export.output_folder, export.file_name_pattern)
        job.output_file = output_final_path

        # Determine temp directory
        if export.temp_same_as_output:
            temp_root = output_final_path.parent / ".temp_mc"
        elif export.custom_temp_folder:
            temp_root = export.custom_temp_folder / ".temp_mc"
        else:
            temp_root = Path(os.environ.get("TEMP", ".")) / "MovieConverter_Temp"

        job_temp_dir = temp_root / f"job_{group.key}_{int(time.time())}"
        job.temp_dir = job_temp_dir
        job_temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 1. Automatic Silent UTF-8 conversion for external text subtitles
            for t in group.tracks:
                if t.kind == "subtitle" and t.origin == "external":
                    clean_path, detected_enc, was_converted = ensure_clean_utf8_subtitle(
                        t.source_path, job_temp_dir / "clean_subs"
                    )
                    t.source_path = clean_path
                    if was_converted:
                        job.log_lines.append(f"Auto-converted subtitle {t.name} from {detected_enc} to clean UTF-8.")

            # 2. Check Overwrite policy
            if output_final_path.is_file():
                if export.if_exists == "skip":
                    job.status = "skipped"
                    self._notify_job(job)
                    return
                elif export.if_exists == "rename":
                    counter = 1
                    while output_final_path.is_file():
                        output_final_path = output_final_path.with_name(f"{output_final_path.stem}_{counter}.mkv")
                    job.output_file = output_final_path

            output_final_path.parent.mkdir(parents=True, exist_ok=True)

            # 3. Generate commands
            steps = generate_group_commands(
                group=group,
                output_final_path=output_final_path,
                temp_dir=job_temp_dir,
                shared_attachments=self.project.shared_attachments,
                remove_old_attachments=self.project.remove_old_attachments,
                ffmpeg_bin=self.ffmpeg_bin,
                mkvmerge_bin=self.mkvmerge_bin,
            )

            total_steps = len(steps)
            for idx, step in enumerate(steps):
                if self._cancel_all_requested:
                    job.status = "cancelled"
                    self._notify_job(job)
                    return

                if self._skip_current_requested:
                    self._skip_current_requested = False
                    job.status = "skipped"
                    self._notify_job(job)
                    return

                step_weight = 100.0 / total_steps
                base_pct = idx * step_weight

                def on_progress(val: float, speed_str: str) -> None:
                    if speed_str:
                        job.speed = speed_str
                    if val >= 0:
                        job.progress = base_pct + (val * (step_weight / 100.0))
                    self._notify_job(job)

                def on_log(line: str) -> None:
                    job.log_lines.append(line)

                runner = StepRunner(step, on_progress=on_progress, on_log=on_log)
                self._current_runner = runner
                runner.run(total_duration_seconds=group.tracks[0].details.get("duration", 0) if group.tracks else 0)

            # 4. Validate output part file
            part_path = output_final_path.with_suffix(".mkv.part")
            if not part_path.is_file() or part_path.stat().st_size == 0:
                raise ProcessExecutionError("Output MKV part file was not created or is empty.")

            # Rename .part to final .mkv safely
            if output_final_path.is_file():
                output_final_path.unlink()
            part_path.rename(output_final_path)

            # 5. Handle optional Delete Originals (Recycle Bin)
            if export.delete_originals and group.source.is_file():
                try:
                    send2trash(str(group.source))
                    job.log_lines.append(f"Moved original file to Recycle Bin: {group.source}")
                except Exception as ex:
                    job.log_lines.append(f"Warning: Could not recycle original: {ex}")

            job.status = "done"
            job.progress = 100.0

        except Exception as ex:
            if self._cancel_all_requested:
                job.status = "cancelled"
            elif self._skip_current_requested:
                self._skip_current_requested = False
                job.status = "skipped"
            else:
                job.status = "failed"
                job.error_message = str(ex)
        finally:
            self._current_runner = None
            # Cleanup temp folder for this job
            try:
                shutil.rmtree(job_temp_dir, ignore_errors=True)
            except Exception:
                pass
            self._notify_job(job)

    def _notify_job(self, job: Job) -> None:
        if self.on_job_updated:
            self.on_job_updated(job)
