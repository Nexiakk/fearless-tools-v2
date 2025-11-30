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
    if (!workspaceId || workspaceId === store.currentWorkspaceId) return
    
    store.setLoading(true)
    try {
      // If it's a local workspace, just load it
      if (workspaceId.startsWith('local_')) {
        await store.loadWorkspace(workspaceId)
        store.isWorkspaceSwitcherOpen = false
        return
      }
      
      // For Firestore workspaces, need password - show join modal
      store.isWorkspaceSwitcherOpen = false
      store.isWorkspaceModalOpen = true
      store.workspaceModalTab = 'join'
      // Pre-fill workspace ID
      // Note: Password will need to be entered
    } catch (error) {
      console.error('Error switching workspace:', error)
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

