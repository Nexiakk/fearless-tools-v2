import sys
import logging
import asyncio
from typing import Optional
from PySide6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QMessageBox
from PySide6.QtGui import QIcon, QAction
from PySide6.QtCore import Qt

import qasync
from .main_window import MainWindow
from .workspace_dialog import WorkspaceDialog
from .client_selector_dialog import ClientSelectorDialog
from lcu_monitor import get_lcu_monitor
from config_manager import get_config_manager
from lcu_process_scanner import get_active_lcu_sessions

logger = logging.getLogger(__name__)

class LCUClientApp:
    def __init__(self, debug: bool = False):
        self.app = QApplication(sys.argv)
        self.app.setQuitOnLastWindowClosed(False) # Keep running in background
        self.debug = debug
        self.main_window: Optional[MainWindow] = None
        self.tray_icon: Optional[QSystemTrayIcon] = None
        
        self.config_manager = get_config_manager()
        self.monitor = get_lcu_monitor()
        
    def setup_ui(self):
        """Initialize UI components after the event loop is ready"""
        self.main_window = MainWindow()
        self._setup_tray_icon()
        
        # Connect main window buttons
        self.main_window.btn_set_workspace.clicked.connect(self.show_workspace_dialog)
        self.main_window.btn_select_client.clicked.connect(self.show_client_selector)
        
        # Connect monitor signals to UI
        self.monitor.status_changed.connect(self.update_status)
        self.monitor.workspace_updated.connect(lambda wid: self.main_window.workspace_lbl.setText(f"Workspace: {wid}"))
        
        workspace_id = self.config_manager.get_workspace_id()
        if workspace_id:
            self.main_window.workspace_lbl.setText(f"Workspace: {workspace_id}")
            
        # Start the background LCUMonitor logic
        self.monitor.start()

        # Show window initially, but user can minimize to tray
        self.main_window.show()

    def _setup_tray_icon(self):
        from PySide6.QtWidgets import QStyle
        self.tray_icon = QSystemTrayIcon(self.app)
        
        self.tray_icon.setIcon(self.app.style().standardIcon(QStyle.SP_ComputerIcon))
        self.tray_icon.setToolTip("Fearless Tools LCU Client")

        # Tray menu
        tray_menu = QMenu()
        
        show_action = QAction("Show", self.app)
        show_action.triggered.connect(self.show_window)
        tray_menu.addAction(show_action)
        
        quit_action = QAction("Quit", self.app)
        quit_action.triggered.connect(self.quit_app)
        tray_menu.addAction(quit_action)
        
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self._tray_icon_activated)
        self.tray_icon.show()

    def _tray_icon_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            if self.main_window.isVisible():
                self.main_window.hide()
            else:
                self.show_window()

    def update_status(self, system: str, status: str):
        if system == "LCU":
            self.main_window.lcu_status_label.setText(f"LCU: {status}")
            if status == "Disconnected":
                self.main_window.lcu_status_label.setStyleSheet("color: #ff5555;")
            else:
                self.main_window.lcu_status_label.setStyleSheet("color: #55ff55;")
        elif system == "Netlify":
            self.main_window.cloud_status_label.setText(f"Netlify: {status}")
            if status == "Error":
                self.main_window.cloud_status_label.setStyleSheet("color: #ff5555;")
            else:
                self.main_window.cloud_status_label.setStyleSheet("color: #dddddd;")

    def show_workspace_dialog(self):
        current_workspace = self.config_manager.get_workspace_id() or ""
        dialog = WorkspaceDialog(self.main_window, current_workspace)
        if dialog.exec():
            # Save credentials
            wid = dialog.workspace_id
            pwd = dialog.password
            if wid and pwd:
                try:
                    self.config_manager.save_credentials(wid, pwd)
                    self.main_window.workspace_lbl.setText(f"Workspace: {wid}")
                    QMessageBox.information(self.main_window, "Success", "Workspace credentials saved!")
                    # Tell monitor to update
                    self.monitor.workspace_id = wid
                except Exception as e:
                    QMessageBox.warning(self.main_window, "Error", f"Failed to save credentials: {e}")

    def show_client_selector(self):
        sessions = get_active_lcu_sessions()
        if not sessions:
            QMessageBox.information(self.main_window, "No Clients", "No League Client processes detected.")
            return
            
        dialog = ClientSelectorDialog(sessions, self.main_window)
        if dialog.exec() and dialog.selected_session:
            session = dialog.selected_session
            self.main_window.client_lbl.setText(f"Active Client: {session.display_name}")
            # Target this specific PID for LCU monitor
            self.monitor.set_target_pid(session.pid)
            QMessageBox.information(self.main_window, "Client Selected", f"Now tracking {session.display_name}. Wait a moment for connection.")

    def show_window(self):
        if self.main_window:
            self.main_window.show()
            self.main_window.raise_()
            self.main_window.activateWindow()

    def quit_app(self):
        logger.info("Quitting application...")
        if self.tray_icon:
            self.tray_icon.hide()
        
        # Stop background tasks
        asyncio.create_task(self.monitor.stop())
        
        # Stop event loop and quit
        asyncio.get_event_loop().stop()
        self.app.quit()
