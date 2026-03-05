from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton
from PySide6.QtCore import Qt

class WorkspaceDialog(QDialog):
    def __init__(self, parent=None, current_workspace=""):
        super().__init__(parent)
        self.setWindowTitle("Workspace Setup")
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self.workspace_id = current_workspace
        self.password = ""
        
        self.setup_ui()
        self.apply_styles()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        container = QWidget()
        container.setObjectName("dialogContainer")
        container_layout = QVBoxLayout(container)
        container_layout.setContentsMargins(20, 20, 20, 20)
        
        title = QLabel("Set Workspace")
        title.setObjectName("dialogTitle")
        
        self.workspace_input = QLineEdit()
        self.workspace_input.setPlaceholderText("Workspace ID")
        self.workspace_input.setText(self.workspace_id)
        
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Password")
        self.password_input.setEchoMode(QLineEdit.Password)
        
        btn_layout = QHBoxLayout()
        
        self.btn_cancel = QPushButton("Cancel")
        self.btn_cancel.setObjectName("cancelBtn")
        self.btn_cancel.clicked.connect(self.reject)
        
        self.btn_save = QPushButton("Save")
        self.btn_save.setObjectName("saveBtn")
        self.btn_save.clicked.connect(self.accept_data)
        
        btn_layout.addWidget(self.btn_cancel)
        btn_layout.addWidget(self.btn_save)
        
        container_layout.addWidget(title)
        container_layout.addWidget(QLabel("Connect to a Fearless Pool workspace:"))
        container_layout.addWidget(self.workspace_input)
        container_layout.addWidget(self.password_input)
        container_layout.addLayout(btn_layout)
        
        main_layout.addWidget(container)

    def accept_data(self):
        self.workspace_id = self.workspace_input.text().strip()
        self.password = self.password_input.text().strip()
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
            QLineEdit {
                background-color: #141418;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 8px;
                color: white;
                margin: 5px 0;
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

# Make QWidget import work inside the class via top-level
from PySide6.QtWidgets import QWidget
