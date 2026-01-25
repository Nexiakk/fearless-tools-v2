#!/usr/bin/env python3
"""
Test script for the new authentication system.
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from config_manager import get_config_manager

def test_config_manager():
    """Test the config manager authentication functions"""
    print("Testing ConfigManager authentication...")

    config_manager = get_config_manager()

    # Test hash function
    test_password = "test123"
    hash1 = config_manager._hash_password(test_password)
    hash2 = config_manager._hash_password(test_password)

    assert hash1 == hash2, "Hash function should be deterministic"
    assert hash1 != test_password, "Hash should not equal plain password"
    print("✅ Password hashing works")

    # Test credential saving/loading
    test_workspace_id = "test-workspace"
    test_password_hash = config_manager._hash_password("testpass")

    success = config_manager.save_workspace_credentials(test_workspace_id, test_password_hash)
    assert success, "Should save credentials successfully"
    print("✅ Credential saving works")

    loaded_id = config_manager.get_workspace_id()
    loaded_hash = config_manager.get_password_hash()

    assert loaded_id == test_workspace_id, f"Expected {test_workspace_id}, got {loaded_id}"
    assert loaded_hash == test_password_hash, f"Hash mismatch"
    print("✅ Credential loading works")

    # Test validation
    valid = config_manager.validate_credentials_locally(test_workspace_id, "testpass")
    assert valid, "Should validate correct credentials"
    print("✅ Credential validation works")

    invalid = config_manager.validate_credentials_locally(test_workspace_id, "wrongpass")
    assert not invalid, "Should reject incorrect credentials"
    print("✅ Credential rejection works")

    # Clean up
    config_manager.clear_saved_credentials()
    print("✅ Credential clearing works")

    print("🎉 All ConfigManager tests passed!")

if __name__ == "__main__":
    test_config_manager()