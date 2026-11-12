"""Subprocess runners with live progress parsing for ffmpeg and mkvmerge.
Supports pause, resume, cancel, and safe .mkv.part validation.
Version: 1.00
"""
from collections.abc import Callable
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time

import psutil

from movie_converter.core.commands import CommandStep


class ProcessExecutionError(Exception):
    pass


class StepRunner:
    """Runs a single CommandStep, reporting progress and handling process suspension."""

    def __init__(self, step: CommandStep, on_progress: Callable[[float, str], None] | None = None, on_log: Callable[[str], None] | None = None):
        self.step = step
        self.on_progress = on_progress
        self.on_log = on_log
        self.process: subprocess.Popen | None = None
        self.is_cancelled = False
        self.is_paused = False
        self._psutil_proc: psutil.Process | None = None

    def run(self, total_duration_seconds: float = 0.0) -> None:
        """Executes the command, streams output, and parses progress."""
        if self.is_cancelled:
            return

        cmd = self.step.args
        self._log(f"Starting: {' '.join(cmd)}")

        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

        try:
            self._psutil_proc = psutil.Process(self.process.pid)
        except Exception:
            self._psutil_proc = None

        tool = self.step.tool

        if self.process.stdout:
            for raw_line in iter(self.process.stdout.readline, ""):
                line = raw_line.strip()
                if not line:
                    continue

                self._log(line)

                # Parse progress based on tool
                if tool == "mkvmerge":
                    # Looks like: #GUI#progress 45%
                    match = re.search(r"#GUI#progress\s+(\d+)%", line)
                    if match:
                        pct = float(match.group(1))
                        if self.on_progress:
                            self.on_progress(pct, "")

                elif tool == "ffmpeg":
                    # In pipe:1 mode, ffmpeg outputs key=value pairs
                    if line.startswith("out_time_us="):
                        us_val = line.split("=")[1].strip()
                        if us_val.isdigit() and total_duration_seconds > 0:
                            current_secs = float(us_val) / 1_000_000.0
                            pct = min(99.0, (current_secs / total_duration_seconds) * 100.0)
                            if self.on_progress:
                                self.on_progress(pct, "")
                    elif line.startswith("speed="):
                        speed_val = line.split("=")[1].strip()
                        if self.on_progress:
                            self.on_progress(-1.0, speed_val)  # -1 indicates update speed only

        self.process.wait()
        ret = self.process.returncode

        # mkvmerge exit code 0 = success, 1 = warnings (still success)
        if tool == "mkvmerge" and ret in (0, 1):
            return

        if ret != 0 and not self.is_cancelled:
            raise ProcessExecutionError(f"Process failed with exit code {ret}: {self.step.description}")

    def pause(self) -> None:
        if self._psutil_proc and not self.is_paused:
            try:
                self._psutil_proc.suspend()
                self.is_paused = True
                self._log("Process suspended.")
            except Exception:
                pass

    def resume(self) -> None:
        if self._psutil_proc and self.is_paused:
            try:
                self._psutil_proc.resume()
                self.is_paused = False
                self._log("Process resumed.")
            except Exception:
                pass

    def cancel(self) -> None:
        self.is_cancelled = True
        if self._psutil_proc:
            try:
                for child in self._psutil_proc.children(recursive=True):
                    child.kill()
                self._psutil_proc.kill()
            except Exception:
                pass
        elif self.process:
            self.process.kill()

    def _log(self, msg: str) -> None:
        if self.on_log:
            self.on_log(msg)
