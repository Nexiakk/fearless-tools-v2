// Workspace Composable
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { workspaceService } from '@/services/workspace'

export function useWorkspace() {
  const store = useWorkspaceStore()

  const joinWorkspace = async (workspaceId, password) => {
    store.setLoading(true)
    try {
      const result = await workspaceService.joinWorkspace(workspaceId, password)
      if (result.success) {
        // Load workspace will be handled by the store
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  const createWorkspace = async (name, password) => {
    store.setLoading(true)
    try {
      const result = await workspaceService.createWorkspace(name, password)
      if (result.workspaceId) {
        store.setCurrentWorkspace(result.workspaceId, name)
        return { success: true, workspaceId: result.workspaceId }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  const createLocalWorkspace = async (name = null) => {
    store.setLoading(true)
    try {
      const result = workspaceService.createLocalWorkspace(name)
      if (result.workspaceId) {
        store.setCurrentWorkspace(result.workspaceId, null)
        return { success: true, workspaceId: result.workspaceId }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  const switchWorkspace = async (workspaceId) => {
    console.log('[switchWorkspace] Called with workspaceId:', workspaceId)
    if (!workspaceId || workspaceId === store.currentWorkspaceId) {
      console.log('[switchWorkspace] Early return - no workspaceId or same as current')
      return
    }
    
    store.setLoading(true)
    try {
      // Try to get metadata to check if workspace exists
      const metadata = await workspaceService.getWorkspaceMetadata(workspaceId)
      console.log('[switchWorkspace] Metadata:', metadata)
      if (!metadata) {
        // Workspace doesn't exist - show join modal
        console.log('[switchWorkspace] Workspace not found, showing join modal')
        store.isWorkspaceSwitcherOpen = false
        store.isWorkspaceModalOpen = true
        store.workspaceModalTab = 'join'
        return { success: false, error: 'Workspace not found' }
      }
      
      // Check if we have a stored password hash for this specific workspace
      let savedPasswordHash = workspaceService.getWorkspacePasswordHash(workspaceId)
      console.log('[switchWorkspace] Per-workspace password hash:', savedPasswordHash ? 'Found' : 'Not found')
      
      // If not found in per-workspace storage, check legacy storage
      if (!savedPasswordHash) {
        const currentWorkspaceId = workspaceService.getCurrentWorkspaceId()
        const legacyPasswordHash = workspaceService.getSavedWorkspacePasswordHash()
        console.log('[switchWorkspace] Legacy password hash:', legacyPasswordHash ? 'Found' : 'Not found')
        
        // If legacy password matches this workspace, use it and migrate
        if (currentWorkspaceId === workspaceId && legacyPasswordHash) {
          savedPasswordHash = legacyPasswordHash
          console.log('[switchWorkspace] Using legacy password hash')
          // Migrate to new storage
          workspaceService.saveWorkspacePasswordHash(workspaceId, savedPasswordHash)
        }
      }
      
      console.log('[switchWorkspace] Metadata password hash:', metadata.passwordHash ? 'Exists' : 'Missing')
      
      // If we have a stored password hash, try auto-join
      if (savedPasswordHash) {
        // Verify the stored password hash is still valid
        if (metadata.passwordHash === savedPasswordHash) {
          console.log('[switchWorkspace] Password hash matches! Auto-joining...')
          // Ensure user is authenticated
          const { authService } = await import('@/services/firebase/auth')
          if (!authService.isAuthenticated()) {
            const result = await authService.signInAnonymously()
            if (!result.user) {
              throw new Error('Failed to authenticate: ' + (result.error || 'Unknown error'))
            }
          }
          
          // Update current workspace ID and load the workspace
          workspaceService.setCurrentWorkspaceId(workspaceId, savedPasswordHash)
          await store.loadWorkspace(workspaceId)
          store.isWorkspaceSwitcherOpen = false
          console.log('[switchWorkspace] Successfully switched to workspace:', workspaceId)
          return { success: true }
        } else {
          console.log('[switchWorkspace] Password hash does not match')
        }
      }
      
      // No stored credentials or they don't match - show join modal
      console.log('[switchWorkspace] No valid credentials, showing join modal')
      store.isWorkspaceSwitcherOpen = false
      store.isWorkspaceModalOpen = true
      store.workspaceModalTab = 'join'
      return { success: false, error: 'Password required' }
    } catch (error) {
      console.error('[switchWorkspace] Error:', error)
      // On error, show join modal
      store.isWorkspaceSwitcherOpen = false
      store.isWorkspaceModalOpen = true
      store.workspaceModalTab = 'join'
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  const updateWorkspaceSettings = async (updates) => {
    if (!store.currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    return await workspaceService.updateWorkspaceSettings(store.currentWorkspaceId, updates)
  }

  return {
    // State
    currentWorkspaceId: computed(() => store.currentWorkspaceId),
    currentWorkspaceName: computed(() => store.currentWorkspaceName),
    hasWorkspace: computed(() => store.hasWorkspace),
    isLocalWorkspace: computed(() => store.isLocalWorkspace),
    isLoading: computed(() => store.isLoading),
    // Actions
    joinWorkspace,
    createWorkspace,
    createLocalWorkspace,
    switchWorkspace,
    updateWorkspaceSettings,
    loadRecentWorkspaces: store.loadRecentWorkspaces
  }
}

