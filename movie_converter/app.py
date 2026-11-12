"""Application entry point for Movie Converter.
Version: 1.00
"""
import sys
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from movie_converter.ui.main_window import MainWindow


def main():
    # Enable high DPI scaling
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("Movie Converter")
    app.setOrganizationName("MovieConverter")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
