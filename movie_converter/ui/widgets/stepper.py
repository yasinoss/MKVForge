"""Top stepper widget displaying stages: 1 Import -> 2 Review -> 3 Export.
Version: 1.00
"""
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPaintEvent, QPen
from PySide6.QtWidgets import QWidget

from movie_converter.ui.theme import ColorPalette


class StepperWidget(QWidget):
    step_clicked = Signal(int)

    def __init__(self, current_step: int = 1, parent: QWidget | None = None):
        super().__init__(parent)
        self.steps = ["Import", "Review", "Export"]
        self.current_step = current_step
        self.palette: ColorPalette | None = None
        self.setFixedHeight(50)
        self.setMinimumWidth(340)

    def set_step(self, step: int) -> None:
        self.current_step = max(1, min(3, step))
        self.update()

    def set_palette(self, palette: ColorPalette) -> None:
        self.palette = palette
        self.update()

    def paintEvent(self, event: QPaintEvent) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        if not self.palette:
            return

        w = self.width()
        h = self.height()
        cy = h // 2

        num_steps = len(self.steps)
        spacing = w / (num_steps + 0.5)
        start_x = spacing * 0.75

        positions = [int(start_x + i * spacing) for i in range(num_steps)]

        # Draw connecting lines
        pen_line = QPen(QColor(self.palette.border), 2)
        painter.setPen(pen_line)
        for i in range(num_steps - 1):
            painter.drawLine(positions[i] + 16, cy, positions[i + 1] - 16, cy)

        # Draw steps
        radius = 13
        for i, (name, x) in enumerate(zip(self.steps, positions), start=1):
            is_done = i < self.current_step
            is_active = i == self.current_step

            if is_done:
                painter.setBrush(QColor(self.palette.chip_green_bg))
                painter.setPen(QPen(QColor(self.palette.chip_green_text), 1.5))
                painter.drawEllipse(x - radius, cy - radius, radius * 2, radius * 2)

                # Checkmark
                painter.setPen(QPen(QColor(self.palette.chip_green_text), 2))
                painter.drawPolyline([(x - 5, cy), (x - 1, cy + 4), (x + 5, cy - 4)])
            elif is_active:
                painter.setBrush(QColor(self.palette.accent))
                painter.setPen(Qt.PenStyle.NoPen)
                painter.drawEllipse(x - radius, cy - radius, radius * 2, radius * 2)

                painter.setPen(QColor("#FFFFFF"))
                font = painter.font()
                font.setBold(True)
                font.setPointSize(9)
                painter.setFont(font)
                painter.drawText(x - radius, cy - radius, radius * 2, radius * 2, Qt.AlignmentFlag.AlignCenter, str(i))
            else:
                painter.setBrush(QColor(self.palette.panel))
                painter.setPen(QPen(QColor(self.palette.border_strong), 1.5))
                painter.drawEllipse(x - radius, cy - radius, radius * 2, radius * 2)

                painter.setPen(QColor(self.palette.muted_text))
                font = painter.font()
                font.setBold(False)
                font.setPointSize(9)
                painter.setFont(font)
                painter.drawText(x - radius, cy - radius, radius * 2, radius * 2, Qt.AlignmentFlag.AlignCenter, str(i))

            # Step label text
            painter.setPen(QColor(self.palette.text if is_active else self.palette.muted_text))
            font = painter.font()
            font.setBold(is_active)
            font.setPointSize(10)
            painter.setFont(font)
            painter.drawText(x + radius + 8, cy - 10, 80, 20, Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft, name)
