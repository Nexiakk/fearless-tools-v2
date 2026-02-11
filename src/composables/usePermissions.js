// Permissions Composable - Handles view-only mode for anonymous users
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

// Reactive state for permission checking
const isCheckingPermission = ref(false)

/**
 * Check if the current user can perform write operations
 * Returns true if user can write, false if view-only
 */
export function canWrite() {
  const authStore = useAuthStore()
  const adminStore = useAdminStore()
  
  // If user is not anonymous, they can always write
  if (!authStore.isAnonymous) {
    return true
  }
  
  // If user is anonymous, check the global setting
  // Default to 'interact' if not set (backward compatible)
  const anonymousMode = adminStore.globalSettings?.anonymousUserMode || 'interact'
  
  // If mode is 'view', anonymous users cannot write
  if (anonymousMode === 'view') {
    return false
  }
  
  // Default: anonymous users can interact
  return true
}

/**
 * Composable for permissions management
 */
export function usePermissions() {
  const authStore = useAuthStore()
  const adminStore = useAdminStore()
  
  const isViewOnly = computed(() => {
    // Non-anonymous users are never in view-only mode
    if (!authStore.isAnonymous) {
      return false
    }
    
    // Check global setting
    const anonymousMode = adminStore.globalSettings?.anonymousUserMode || 'interact'
    return anonymousMode === 'view'
  })
  
  const canEdit = computed(() => !isViewOnly.value)
  
  const canInteract = computed(() => {
    // Non-anonymous users can always interact
    if (!authStore.isAnonymous) {
      return true
    }
    
    // Check global setting
    const anonymousMode = adminStore.globalSettings?.anonymousUserMode || 'interact'
    return anonymousMode === 'interact'
  })
  
  /**
   * Check if write operation is allowed
   * Returns true if allowed, false if blocked
   */
  function checkWritePermission() {
    if (isViewOnly.value) {
      console.log('[Permissions] Write operation blocked: User is in view-only mode')
      return false
    }
    return true
  }
  
  /**
   * Check if edit operation is allowed with optional callback
   * @param {Function} onBlocked - Optional callback when operation is blocked
   * @returns {boolean} - Whether operation is allowed
   */
  function checkEditPermission(onBlocked = null) {
    if (isViewOnly.value) {
      console.log('[Permissions] Edit operation blocked: User is in view-only mode')
      if (typeof onBlocked === 'function') {
        onBlocked()
      }
      return false
    }
    return true
  }
  
  return {
    // State
    isViewOnly,
    canEdit,
    canInteract,
    isCheckingPermission,
    // Methods
    checkWritePermission,
    checkEditPermission,
    canWrite
  }
}

export default usePermissions
