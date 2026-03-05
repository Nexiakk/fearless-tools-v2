from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QListWidget, QListWidgetItem, QWidget
from PySide6.QtCore import Qt
from typing import List, Optional
from lcu_process_scanner import LCUSession

class ClientSelectorDialog(QDialog):
    def __init__(self, sessions: List[LCUSession], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select LCU Session")
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self.sessions = sessions
        self.selected_session: Optional[LCUSession] = None
        
        self.setup_ui()
        self.apply_styles()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        container = QWidget()
        container.setObjectName("dialogContainer")
        container_layout = QVBoxLayout(container)
        container_layout.setContentsMargins(20, 20, 20, 20)
        
        title = QLabel("Select League Client")
        title.setObjectName("dialogTitle")
        
        desc = QLabel("Multiple League Clients detected. Select which one to track:")
        desc.setWordWrap(True)
        
        self.list_widget = QListWidget()
        for session in self.sessions:
            item = QListWidgetItem(session.display_name)
            item.setData(Qt.UserRole, session)
            self.list_widget.addItem(item)
            
        if self.list_widget.count() > 0:
            self.list_widget.setCurrentRow(0)
            
        btn_layout = QHBoxLayout()
        self.btn_cancel = QPushButton("Cancel")
        self.btn_cancel.setObjectName("cancelBtn")
        self.btn_cancel.clicked.connect(self.reject)
        
        self.btn_select = QPushButton("Connect")
        self.btn_select.setObjectName("saveBtn")
        self.btn_select.clicked.connect(self.accept_selection)
        
        btn_layout.addWidget(self.btn_cancel)
        btn_layout.addWidget(self.btn_select)
        
        container_layout.addWidget(title)
        container_layout.addWidget(desc)
        container_layout.addWidget(self.list_widget)
        container_layout.addLayout(btn_layout)
        
        main_layout.addWidget(container)

    def accept_selection(self):
        current_item = self.list_widget.currentItem()
        if current_item:
            self.selected_session = current_item.data(Qt.UserRole)
            self.accept()

    def apply_styles(self):
        self.setStyleSheet("""
            QWidget#dialogContainer {
                background-color: #1e1e24;
                border: 1px solid #333;
                border-radius: 8px;
            }
            QLabel#dialogTitle {
                color: white;
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            QLabel {
                color: #ccc;
                font-size: 13px;
            }
            QListWidget {
                background-color: #141418;
                border: 1px solid #333;
                border-radius: 4px;
                color: white;
                padding: 5px;
            }
            QListWidget::item {
                padding: 10px;
                border-bottom: 1px solid #222;
            }
            QListWidget::item:selected {
                background-color: #2d5af0;
                border-radius: 4px;
            }
            QPushButton {
                padding: 8px 15px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton#saveBtn {
                background-color: #2d5af0;
                color: white;
                border: none;
            }
            QPushButton#saveBtn:hover {
                background-color: #3f6bf5;
            }
            QPushButton#cancelBtn {
                background-color: transparent;
                color: #aaa;
                border: 1px solid #555;
            }
            QPushButton#cancelBtn:hover {
                background-color: #333;
                color: white;
            }
        """)
