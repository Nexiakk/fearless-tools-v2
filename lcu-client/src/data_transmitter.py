"""
Data transmission service for sending draft data to Firestore.
Handles batching, retries, and rate limiting.
"""

import asyncio
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from .models import DraftData, TransmissionBatch
    from .config_manager import get_config_manager
except ImportError:
    from models import DraftData, TransmissionBatch
    from config_manager import get_config_manager

logger = logging.getLogger(__name__)


class DataTransmitter:
    """Handles transmission of draft data to remote server"""

    def __init__(self):
        self.config_manager = get_config_manager()
        self.session = self._create_session()
        self.is_running = False
        self.transmission_queue = None  # Defer creation until start()
        self.last_transmission_time = 0
        self.min_interval = 0.1  # Minimum 100ms between transmissions

    def _create_session(self) -> requests.Session:
        """Create HTTP session with retry configuration"""
        session = requests.Session()

        transmission_settings = self.config_manager.get_transmission_settings()
        retry_attempts = transmission_settings.get("retry_attempts", 3)

        retry_strategy = Retry(
            total=retry_attempts,
            backoff_factor=transmission_settings.get("retry_delay_seconds", 2),
            status_forcelist=[429, 500, 502, 503, 504],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    async def start(self):
        """Start the transmission service"""
        if self.is_running:
            return

        # Create queue now that we have an event loop
        if self.transmission_queue is None:
            self.transmission_queue = asyncio.Queue()

        self.is_running = True
        logger.info("Data transmitter started")

        # Start transmission worker
        asyncio.create_task(self._transmission_worker())

    async def stop(self):
        """Stop the transmission service"""
        self.is_running = False

        # Process remaining items in queue
        if not self.transmission_queue.empty():
            await self._process_batch_transmission()

        logger.info("Data transmitter stopped")

    async def queue_draft_data(self, draft_data: DraftData) -> bool:
        """Queue draft data for transmission"""
        if not self.is_running:
            logger.warning("Transmitter not running, cannot queue data")
            return False

        try:
            await self.transmission_queue.put(draft_data)
            return True
        except Exception as e:
            logger.error(f"Failed to queue draft data: {e}")
            return False

    async def _transmission_worker(self):
        """Background worker for processing transmission queue"""
        batch = TransmissionBatch()
        transmission_settings = self.config_manager.get_transmission_settings()

        batch.max_size = transmission_settings.get("batch_size", 10)
        batch.max_age_seconds = transmission_settings.get("batch_timeout_seconds", 1)

        while self.is_running:
            try:
                # Wait for new data with timeout
                try:
                    draft_data = await asyncio.wait_for(
                        self.transmission_queue.get(),
                        timeout=batch.max_age_seconds
                    )
                    should_transmit = batch.add_item(draft_data)

                except asyncio.TimeoutError:
                    # Timeout reached, transmit if batch has data
                    should_transmit = not batch.is_empty()

                if should_transmit:
                    await self._process_batch_transmission(batch)
                    batch.clear()

            except Exception as e:
                logger.error(f"Error in transmission worker: {e}")
                await asyncio.sleep(1)  # Brief pause before retrying

        # Final transmission on shutdown
        if not batch.is_empty():
            await self._process_batch_transmission(batch)

    async def _process_batch_transmission(self, batch: Optional[TransmissionBatch] = None) -> bool:
        """Process transmission of a batch of draft data"""
        if batch is None:
            # Create batch from queue
            batch = TransmissionBatch()
            transmission_settings = self.config_manager.get_transmission_settings()
            batch.max_size = transmission_settings.get("batch_size", 10)

            # Drain queue into batch
            while not self.transmission_queue.empty() and len(batch.items) < batch.max_size:
                try:
                    draft_data = self.transmission_queue.get_nowait()
                    batch.add_item(draft_data)
                except asyncio.QueueEmpty:
                    break

        if batch.is_empty():
            return True

        # Rate limiting
        current_time = time.time()
        time_since_last = current_time - self.last_transmission_time
        if time_since_last < self.min_interval:
            await asyncio.sleep(self.min_interval - time_since_last)

        # Transmit batch
        success = await self._transmit_batch(batch.items)

        if success:
            self.last_transmission_time = time.time()
            logger.info(f"Successfully transmitted batch of {len(batch.items)} draft(s)")
        else:
            logger.error(f"Failed to transmit batch of {len(batch.items)} draft(s)")

        return success

    async def _transmit_batch(self, drafts: List[DraftData]) -> bool:
        """Transmit a batch of draft data"""
        if not drafts:
            return True

        transmission_settings = self.config_manager.get_transmission_settings()
        endpoint_url = transmission_settings.get("endpoint_url")

        if not endpoint_url:
            logger.error("No endpoint URL configured for transmission")
            return False

        # Send each draft individually (for now - could be optimized for batch API)
        success_count = 0

        for draft in drafts:
            if await self._transmit_single_draft(draft, endpoint_url):
                success_count += 1
            else:
                logger.warning(f"Failed to transmit draft for lobby {draft.lobby_id}")

        return success_count == len(drafts)

    async def _transmit_single_draft(self, draft: DraftData, endpoint_url: str) -> bool:
        """Transmit a single draft to the endpoint"""
        try:
            payload = draft.to_dict()

            # Add transmission metadata
            payload["_timestamp"] = datetime.now().isoformat()
            payload["_client_version"] = "1.0.0"

            # Add workspace password hash for authentication
            password_hash = self.config_manager.get_password_hash()
            if password_hash:
                payload["_passwordHash"] = password_hash

            # Make request
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.session.post(
                    endpoint_url,
                    json=payload,
                    timeout=30,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'LCU-Client/1.0.0'
                    }
                )
            )

            if response.status_code == 200:
                response_data = response.json()
                if response_data.get("success"):
                    logger.debug(f"Successfully transmitted draft for lobby {draft.lobby_id}")
                    return True
                else:
                    logger.warning(f"Server rejected draft for lobby {draft.lobby_id}: {response_data}")
                    return False
            else:
                logger.warning(f"HTTP {response.status_code} transmitting draft for lobby {draft.lobby_id}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error transmitting draft for lobby {draft.lobby_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error transmitting draft for lobby {draft.lobby_id}: {e}")
            return False

    async def send_deletion_request(self, lobby_id: str, workspace_id: str) -> bool:
        """Send deletion request for cancelled champion select"""
        transmission_settings = self.config_manager.get_transmission_settings()
        endpoint_url = transmission_settings.get("endpoint_url")

        if not endpoint_url:
            logger.error("No endpoint URL configured for deletion")
            return False

        try:
            payload = {
                "action": "delete",
                "lobbyId": lobby_id,
                "workspaceId": workspace_id,
                "_timestamp": datetime.now().isoformat(),
                "_client_version": "1.0.0"
            }

            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.session.post(
                    endpoint_url,
                    json=payload,
                    timeout=30,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'LCU-Client/1.0.0'
                    }
                )
            )

            if response.status_code == 200:
                response_data = response.json()
                if response_data.get("success"):
                    logger.info(f"Successfully sent deletion request for lobby {lobby_id}")
                    return True
                else:
                    logger.warning(f"Server rejected deletion for lobby {lobby_id}: {response_data}")
                    return False
            else:
                logger.warning(f"HTTP {response.status_code} sending deletion for lobby {lobby_id}")
                return False

        except Exception as e:
            logger.error(f"Error sending deletion request for lobby {lobby_id}: {e}")
            return False

    def get_queue_size(self) -> int:
        """Get current queue size"""
        return self.transmission_queue.qsize()

    def get_stats(self) -> Dict[str, Any]:
        """Get transmission statistics"""
        return {
            "queue_size": self.get_queue_size(),
            "is_running": self.is_running,
            "last_transmission": self.last_transmission_time
        }


# Global instance
_data_transmitter = DataTransmitter()

def get_data_transmitter() -> DataTransmitter:
    """Get the global data transmitter instance"""
    return _data_transmitter
