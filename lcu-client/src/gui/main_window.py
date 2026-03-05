from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QPushButton, QFrame, QSizePolicy
)
from PySide6.QtCore import Qt, QPoint
from PySide6.QtGui import QMouseEvent

class FramelessWindow(QMainWindow):
    """A frameless window that can be dragged by clicking its custom title bar."""
    
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowSystemMenuHint | Qt.WindowMinimizeButtonHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self._drag_pos = QPoint()
        
    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        if event.buttons() == Qt.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()

class MainWindow(FramelessWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Fearless LCU Tools")
        self.resize(350, 450)
        
        self.setup_ui()
        self.apply_styles()

    def setup_ui(self):
        central_widget = QWidget()
        central_widget.setObjectName("centralWidget")
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # --- Title Bar ---
        title_bar = QWidget()
        title_bar.setObjectName("titleBar")
        title_layout = QHBoxLayout(title_bar)
        title_layout.setContentsMargins(15, 10, 10, 10)
        
        title_label = QLabel("Fearless LCU")
        title_label.setObjectName("titleLabel")
        
        min_btn = QPushButton("—")
        min_btn.setObjectName("controlBtn")
        min_btn.clicked.connect(self.hide)  # Minimize to tray
        
        close_btn = QPushButton("✕")
        close_btn.setObjectName("controlBtn")
        close_btn.clicked.connect(self.hide) # Also minimize to tray instead of closing
        
        title_layout.addWidget(title_label)
        title_layout.addStretch()
        title_layout.addWidget(min_btn)
        title_layout.addWidget(close_btn)
        
        main_layout.addWidget(title_bar)
        
        # --- Main Content ---
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(20, 20, 20, 20)
        content_layout.setSpacing(15)
        
        # Status Section
        status_frame = QFrame()
        status_frame.setObjectName("cardFrame")
        status_layout = QVBoxLayout(status_frame)
        
        self.lcu_status_label = QLabel("LCU: Disconnected")
        self.lcu_status_label.setObjectName("statusLabel")
        
        self.cloud_status_label = QLabel("Netlify: Waiting")
        self.cloud_status_label.setObjectName("statusLabel")
        
        status_layout.addWidget(self.lcu_status_label)
        status_layout.addWidget(self.cloud_status_label)
        
        content_layout.addWidget(status_frame)
        
        # Workspace Section
        workspace_frame = QFrame()
        workspace_frame.setObjectName("cardFrame")
        workspace_layout = QVBoxLayout(workspace_frame)
        
        self.workspace_lbl = QLabel("Workspace: Not Set")
        self.workspace_lbl.setObjectName("infoLabel")
        
        self.btn_set_workspace = QPushButton("Set Workspace")
        self.btn_set_workspace.setObjectName("actionBtn")
        
        workspace_layout.addWidget(self.workspace_lbl)
        workspace_layout.addWidget(self.btn_set_workspace)
        
        content_layout.addWidget(workspace_frame)
        
        # Client Select Section
        client_frame = QFrame()
        client_frame.setObjectName("cardFrame")
        client_layout = QVBoxLayout(client_frame)
        
        self.client_lbl = QLabel("Active Client: Auto")
        self.client_lbl.setObjectName("infoLabel")
        
        self.btn_select_client = QPushButton("Select Client Instance")
        self.btn_select_client.setObjectName("actionBtn")
        
        client_layout.addWidget(self.client_lbl)
        client_layout.addWidget(self.btn_select_client)
        
        content_layout.addWidget(client_frame)
        
        content_layout.addStretch()
        main_layout.addWidget(content_widget)

    def apply_styles(self):
        self.setStyleSheet("""
            QWidget#centralWidget {
                background-color: #1e1e24;
                border-radius: 10px;
                border: 1px solid #333333;
            }
            QWidget#titleBar {
                background-color: #141418;
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
            }
            QLabel#titleLabel {
                color: #ffffff;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton#controlBtn {
                background: transparent;
                border: none;
                color: #888888;
                font-size: 14px;
                width: 30px;
                height: 30px;
            }
            QPushButton#controlBtn:hover {
                color: #ffffff;
                background-color: #333333;
                border-radius: 5px;
            }
            QFrame#cardFrame {
                background-color: #25252b;
                border-radius: 8px;
                padding: 10px;
            }
            QLabel#statusLabel, QLabel#infoLabel {
                color: #dddddd;
                font-size: 13px;
                padding: 2px 0;
            }
            QPushButton#actionBtn {
                background-color: #2d5af0;
                color: white;
                border: none;
                border-radius: 5px;
                padding: 8px 12px;
                font-weight: bold;
                margin-top: 5px;
            }
            QPushButton#actionBtn:hover {
                background-color: #3f6bf5;
            }
        """)
