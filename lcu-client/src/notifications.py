"""
Notification system for LCU Monitor state changes.
Designed for future desktop app integration (system tray, toasts, etc.)
"""

import logging
from enum import Enum
from typing import Callable, List, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


class NotificationType(Enum):
    """Types of notifications that can be sent"""
    CHAMP_SELECT_STARTED = "champ_select_started"
    CHAMP_SELECT_CANCELLED = "champ_select_cancelled"
    GAME_STARTED = "game_started"
    GAME_ENDED = "game_ended"
    DRAFT_SAVED = "draft_saved"
    DRAFT_DELETED = "draft_deleted"
    CONNECTION_LOST = "connection_lost"
    CONNECTION_RESTORED = "connection_restored"
    STATE_CHANGED = "state_changed"


@dataclass
class Notification:
    """A notification event"""
    type: NotificationType
    message: str
    timestamp: datetime
    data: Optional[dict] = None
    silent: bool = False  # If True, don't show UI popup


class MonitorNotifier:
    """
    Handles notifications for monitor state changes.
    Supports multiple subscribers for future UI integration.
    """

    def __init__(self):
        self._subscribers: List[Callable[[Notification], None]] = []
        self._last_notification: Optional[Notification] = None

    def subscribe(self, callback: Callable[[Notification], None]) -> None:
        """Subscribe to notifications"""
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[Notification], None]) -> None:
        """Unsubscribe from notifications"""
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def _notify(self, notification: Notification) -> None:
        """Send notification to all subscribers"""
        self._last_notification = notification

        # Always log
        if notification.type in [NotificationType.CHAMP_SELECT_CANCELLED, NotificationType.CONNECTION_LOST]:
            logger.warning(notification.message)
        elif notification.type in [NotificationType.CHAMP_SELECT_STARTED, NotificationType.GAME_STARTED]:
            logger.info(notification.message)
        else:
            logger.debug(notification.message)

        # Notify subscribers
        for callback in self._subscribers:
            try:
                callback(notification)
            except Exception as e:
                logger.error(f"Notification subscriber failed: {e}")

    # Convenience methods for specific events

    def on_champ_select_started(self, lobby_id: str) -> None:
        """Champion select monitoring started"""
        self._notify(Notification(
            type=NotificationType.CHAMP_SELECT_STARTED,
            message=f"🎮 Champion select started (Lobby: {lobby_id})",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id}
        ))

    def on_champ_select_cancelled(self, lobby_id: str, reason: str = "dodge") -> None:
        """Champion select was cancelled (dodge/leave)"""
        self._notify(Notification(
            type=NotificationType.CHAMP_SELECT_CANCELLED,
            message=f"❌ Champion select cancelled - {reason} (Lobby: {lobby_id})",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id, "reason": reason}
        ))

    def on_game_started(self, lobby_id: str) -> None:
        """Game successfully started from champion select"""
        self._notify(Notification(
            type=NotificationType.GAME_STARTED,
            message=f"✅ Game started! Draft saved (Lobby: {lobby_id})",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id}
        ))

    def on_game_ended(self, lobby_id: str) -> None:
        """Game ended and returned to client"""
        self._notify(Notification(
            type=NotificationType.GAME_ENDED,
            message=f"🏁 Game ended (Lobby: {lobby_id})",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id},
            silent=True  # Silent - not important for user
        ))

    def on_draft_saved(self, lobby_id: str, pick_count: int, ban_count: int) -> None:
        """Draft data was saved/updated"""
        self._notify(Notification(
            type=NotificationType.DRAFT_SAVED,
            message=f"💾 Draft updated: {pick_count} picks, {ban_count} bans",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id, "picks": pick_count, "bans": ban_count},
            silent=True  # Silent - too frequent
        ))

    def on_draft_deleted(self, lobby_id: str, reason: str = "cancelled") -> None:
        """Draft was deleted from server"""
        self._notify(Notification(
            type=NotificationType.DRAFT_DELETED,
            message=f"🗑️ Draft deleted ({reason}): {lobby_id}",
            timestamp=datetime.now(),
            data={"lobby_id": lobby_id, "reason": reason}
        ))

    def on_connection_lost(self) -> None:
        """Connection to LCU lost"""
        self._notify(Notification(
            type=NotificationType.CONNECTION_LOST,
            message="🔌 Connection to League client lost",
            timestamp=datetime.now()
        ))

    def on_connection_restored(self) -> None:
        """Connection to LCU restored"""
        self._notify(Notification(
            type=NotificationType.CONNECTION_RESTORED,
            message="🔌 Connection to League client restored",
            timestamp=datetime.now()
        ))

    def on_state_changed(self, old_state: str, new_state: str) -> None:
        """Monitor state changed"""
        self._notify(Notification(
            type=NotificationType.STATE_CHANGED,
            message=f"State: {old_state} → {new_state}",
            timestamp=datetime.now(),
            data={"old_state": old_state, "new_state": new_state},
            silent=True  # Silent - internal state
        ))

    def get_last_notification(self) -> Optional[Notification]:
        """Get the last notification sent"""
        return self._last_notification


# Global notifier instance
_notifier = MonitorNotifier()


def get_notifier() -> MonitorNotifier:
    """Get the global notifier instance"""
    return _notifier
