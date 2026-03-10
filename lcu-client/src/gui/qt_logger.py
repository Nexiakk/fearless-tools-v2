import logging
from PySide6.QtCore import QObject, Signal

class QtLogSignals(QObject):
    log_message = Signal(str)

class QtLogHandler(logging.Handler):
    """
    A custom logging handler that emits log records via a Qt Signal
    so they can be safely appended to GUI widgets from different threads.
    """
    def __init__(self):
        super().__init__()
        self.signals = QtLogSignals()

    def emit(self, record):
        try:
            msg = self.format(record)
            self.signals.log_message.emit(msg)
        except Exception:
            self.handleError(record)
