import psutil
import logging
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)

@dataclass
class LCUSession:
    port: int
    auth_token: str
    install_dir: str
    pid: int
    
    @property
    def display_name(self) -> str:
        # A simple heuristic based on the installation folder.
        install_dir_lower = self.install_dir.lower()
        if "pbe" in install_dir_lower:
            return f"League of Legends PBE (PID {self.pid})"
        elif "tournament" in install_dir_lower or "esports" in install_dir_lower:
            return f"Tournament Realm (PID {self.pid})"
        return f"League of Legends Live (PID {self.pid})"

def get_active_lcu_sessions() -> List[LCUSession]:
    """Scans running processes and returns a list of active LCU sessions."""
    sessions = []
    
    for proc in psutil.process_iter(['name', 'cmdline', 'exe']):
        try:
            name = proc.info.get('name')
            if name and name.lower() == 'leagueclientux.exe':
                cmdline = proc.info.get('cmdline') or []
                port = None
                auth_token = None
                install_dir = proc.info.get('exe') or ""
                
                for arg in cmdline:
                    if arg.startswith('--app-port='):
                        port = int(arg.split('=', 1)[1])
                    elif arg.startswith('--remoting-auth-token='):
                        auth_token = arg.split('=', 1)[1]
                
                if port and auth_token:
                    sessions.append(LCUSession(
                        port=port,
                        auth_token=auth_token,
                        install_dir=install_dir,
                        pid=proc.pid
                    ))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
            
    return sessions
