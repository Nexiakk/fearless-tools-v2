"""
Firebase utilities for the champion scraping system.
Handles Firebase initialization, data storage, and retrieval operations.
"""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from dataclasses import dataclass


@dataclass
class FirebaseConfig:
    """Configuration for Firebase connection"""
    service_account_key: Optional[str] = None
    project_id: Optional[str] = None

    @classmethod
    def from_environment(cls) -> 'FirebaseConfig':
        """Create config from environment variables"""
        return cls(
            service_account_key=os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY'),
            project_id=os.environ.get('FIREBASE_PROJECT_ID')
        )

    @classmethod
    def from_file(cls, file_path: str) -> 'FirebaseConfig':
        """Create config from service account file"""
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                key_data = json.load(f)
                return cls(
                    service_account_key=json.dumps(key_data),
                    project_id=key_data.get('project_id')
                )
        return cls()


class FirebaseManager:
    """Manages Firebase connection and operations"""

    def __init__(self, config: FirebaseConfig):
        self.config = config
        self._db: Optional[firestore.Client] = None
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize Firebase connection"""
        if self._initialized and self._db:
            return True

        try:
            if not firebase_admin._apps:
                cred = self._get_credentials()
                if not cred:
                    print("No Firebase credentials available")
                    return False

                firebase_admin.initialize_app(cred)

            self._db = firestore.client()
            self._initialized = True
            return True

        except Exception as e:
            print(f"Firebase initialization failed: {e}")
            return False

    def _get_credentials(self) -> Optional[credentials.Certificate]:
        """Get Firebase credentials from config"""
        # Try environment variable first (GitHub Actions/serverless)
        if self.config.service_account_key:
            try:
                return credentials.Certificate(json.loads(self.config.service_account_key))
            except json.JSONDecodeError:
                pass

        # Try local files
        cred_paths = [
            'firebase-key.json',
            os.path.join(os.path.dirname(__file__), '..', 'firebase-key.json'),
            os.path.join(os.path.dirname(__file__), '..', '..', 'firebase-key.json')
        ]

        for path in cred_paths:
            if os.path.exists(path):
                return credentials.Certificate(path)

        return None

    @property
    def db(self) -> firestore.Client:
        """Get Firestore client"""
        if not self._initialized:
            raise RuntimeError("Firebase not initialized. Call initialize() first.")
        return self._db

    def get_champion_data(self, champion_key: str) -> Optional[Dict[str, Any]]:
        """Get champion data from Firestore"""
        try:
            doc_ref = self.db.collection('champions').document('data').collection('champions').document(champion_key)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            print(f"Error getting champion data for {champion_key}: {e}")
            return None

    def store_champion_data(self, champion_key: str, data: Dict[str, Any]) -> bool:
        """Store champion data in Firestore"""
        try:
            doc_ref = self.db.collection('champions').document('data').collection('champions').document(champion_key)
            doc_ref.set(data)
            return True
        except Exception as e:
            print(f"Error storing champion data for {champion_key}: {e}")
            return False

    def get_role_containers(self) -> Optional[Dict[str, Any]]:
        """Get role container data"""
        try:
            doc_ref = self.db.collection('champions').document('data')
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            print(f"Error getting role containers: {e}")
            return None

    def update_role_containers(self, role_data: Dict[str, Any]) -> bool:
        """Update role container data"""
        try:
            doc_ref = self.db.collection('champions').document('data')
            doc_ref.set(role_data, merge=True)
            return True
        except Exception as e:
            print(f"Error updating role containers: {e}")
            return False

    def get_global_patch_info(self) -> Optional[Dict[str, Any]]:
        """Get global patch metadata from champions/data document"""
        try:
            doc_ref = self.db.collection('champions').document('data')
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                return {
                    'abilitiesPatch': data.get('abilitiesPatch'),
                    'abilitiesLastUpdated': data.get('abilitiesLastUpdated')
                }
            return None
        except Exception as e:
            print(f"Error getting global patch info: {e}")
            return None

    def update_global_patch_info(self, patch: str) -> bool:
        """Update global patch metadata in champions/data document"""
        try:
            doc_ref = self.db.collection('champions').document('data')
            doc_ref.set({
                'abilitiesPatch': patch,
                'abilitiesLastUpdated': datetime.utcnow()
            }, merge=True)
            return True
        except Exception as e:
            print(f"Error updating global patch info: {e}")
            return False

    def archive_champion_data(self, champion_key: str, data: Dict[str, Any]) -> bool:
        """Archive champion data for a specific patch"""
        try:
            patch = data.get('patch')
            if patch:
                doc_ref = self.db.collection('champions').document('all').collection('champions').document(champion_key).collection('patch_history').document(patch)
                doc_ref.set(data)
                return True
        except Exception as e:
            print(f"Error archiving data for {champion_key}: {e}")
        return False

    def cleanup_old_patches(self, current_patch: str, keep_count: int = 2) -> int:
        """Clean up old patch data, keeping only recent patches"""
        try:
            deleted_count = 0

            # Get all champions
            champions_ref = self.db.collection('champions').document('all').collection('champions')
            champions = champions_ref.stream()

            for champ_doc in champions:
                patch_history_ref = champ_doc.reference.collection('patch_history')
                patches = patch_history_ref.list_documents()

                # Get patch versions
                patch_versions = [doc.id for doc in patches]
                sorted_patches = sorted(patch_versions, reverse=True)  # Newest first

                # Delete old patches
                if len(sorted_patches) > keep_count:
                    patches_to_delete = sorted_patches[keep_count:]
                    for old_patch in patches_to_delete:
                        patch_history_ref.document(old_patch).delete()
                        deleted_count += 1

            return deleted_count

        except Exception as e:
            print(f"Error during cleanup: {e}")
            return 0


# Global instance for backward compatibility
_firebase_config = FirebaseConfig.from_environment()
_firebase_manager = FirebaseManager(_firebase_config)

def init_firebase() -> bool:
    """Initialize Firebase (backward compatibility)"""
    return _firebase_manager.initialize()

def get_db() -> firestore.Client:
    """Get Firestore client (backward compatibility)"""
    return _firebase_manager.db
