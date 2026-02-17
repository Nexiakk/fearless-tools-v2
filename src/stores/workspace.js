import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import { workspaceService } from '@/services/workspace'
import { useChampionsStore } from './champions'
import { useDraftStore } from './draft'
import { fetchDraftDataFromFirestore, setupDraftRealtimeSync } from '@/services/firebase/firestore'

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const currentWorkspaceId = ref(null)
  const currentWorkspaceName = ref(null)
  const isLoading = ref(false)
  const isWorkspaceModalOpen = ref(false)
  const isWorkspaceSwitcherOpen = ref(false)
  const isWorkspaceSettingsOpen = ref(false)
  const workspaceModalTab = ref('join')
  const recentWorkspaces = ref([])
  const isSyncing = ref(false)
  const lastSyncTime = ref(null)
  const activeUsers = ref(0)
  const isOnline = ref(navigator.onLine)
  const networkError = ref(null)
  const isInitializing = ref(true) // Track if app is still initializing
  let unsubscribeRealtimeSync = null
  
  // Getters
  const hasWorkspace = computed(() => !!currentWorkspaceId.value)
  const isLocalWorkspace = computed(() => 
    currentWorkspaceId.value?.startsWith('local_')
  )
  
  // Actions
  function setCurrentWorkspace(id, name = null) {
    currentWorkspaceId.value = id
    currentWorkspaceName.value = name || id
    workspaceService.setCurrentWorkspaceId(id)
  }
  
  function setLoading(value) {
    isLoading.value = value
  }
  
  function setSyncing(value) {
    isSyncing.value = value
    if (!value) {
      lastSyncTime.value = new Date()
    }
  }
  
  function openWorkspaceSettings() {
    isWorkspaceSettingsOpen.value = true
  }

  async function loadWorkspace(workspaceId) {
    if (!workspaceId) {
      console.error('loadWorkspace called with no workspaceId!')
      return
    }

    isLoading.value = true
    try {
      currentWorkspaceId.value = workspaceId
      workspaceService.setCurrentWorkspaceId(workspaceId)
      
      // Load champions (global - same for all workspaces)
      const championsStore = useChampionsStore()
      await championsStore.loadChampions()
      
      // Load workspace data
      if (workspaceId.startsWith('local_')) {
        await loadLocalWorkspace(workspaceId)
      } else {
        await loadFirestoreWorkspace(workspaceId)
      }
      
      // Set up real-time sync for Firestore workspaces
      if (!isLocalWorkspace.value) {
        setupRealtimeSync(workspaceId)
        // Add to recent workspaces history
        addToRecentWorkspaces(workspaceId, currentWorkspaceName.value)
      }
    } catch (error) {
      console.error('Error loading workspace:', error)
      networkError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function loadLocalWorkspace(workspaceId) {
    const localData = workspaceService.getLocalWorkspaceData(workspaceId)
    const draftStore = useDraftStore()
    
    if (localData) {
      // Local workspaces don't have names
      currentWorkspaceName.value = null
      
      if (localData.draftData) {
        draftStore.loadDraftData(localData.draftData)
      } else {
        // No draft data - ensure loading state is false
        draftStore.isLoading = false
      }
    } else {
      // No local data - ensure loading state is false
      draftStore.isLoading = false
    }
  }

  async function loadFirestoreWorkspace(workspaceId) {
    const metadata = await workspaceService.getWorkspaceMetadata(workspaceId)
    if (metadata) {
      currentWorkspaceName.value = metadata.name
    }
    
    const draftStore = useDraftStore()
    await draftStore.loadWorkspaceData(workspaceId)
  }

  function setupRealtimeSync(workspaceId) {
    // Clean up existing listener
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }

    const draftStore = useDraftStore()
    
    // Set up Firestore listener
    unsubscribeRealtimeSync = setupDraftRealtimeSync(workspaceId, (data) => {
      // Prevent remote updates from overwriting local changes that are waiting to be saved
      if (draftStore._isSaving) {
        console.log('Ignoring snapshot due to pending local save.')
        return
      }

      // Update draft store with remote changes using new data structure
      if (JSON.stringify(draftStore.pickedChampions) !== JSON.stringify(data.pickedChampions)) {
        draftStore.pickedChampions = data.pickedChampions || []
      }

      const bannedChampionsSet = new Set(data.bannedChampions || [])
      if (JSON.stringify(Array.from(draftStore.bannedChampions)) !== JSON.stringify(data.bannedChampions || [])) {
        draftStore.bannedChampions = bannedChampionsSet
      }

      if (JSON.stringify(draftStore.eventContext) !== JSON.stringify(data.eventContext)) {
        draftStore.eventContext = data.eventContext || []
      }

      setSyncing(false)
    })
  }

  // Add workspace to recent history
  function addToRecentWorkspaces(workspaceId, workspaceName = null) {
    if (!workspaceId || workspaceId.startsWith('local_')) return
    
    try {
      const stored = localStorage.getItem('recentWorkspaces')
      let recent = stored ? JSON.parse(stored) : []
      
      // Remove if already exists
      recent = recent.filter(w => w.id !== workspaceId)
      
      // Add to beginning with timestamp
      recent.unshift({
        id: workspaceId,
        name: workspaceName || workspaceId,
        lastVisited: new Date().toISOString()
      })
      
      // Keep only last 10
      recent = recent.slice(0, 10)
      
      localStorage.setItem('recentWorkspaces', JSON.stringify(recent))
    } catch (error) {
      console.error('Error saving recent workspace:', error)
    }
  }
  
  async function loadRecentWorkspaces() {
    try {
      const recent = []
      const currentId = currentWorkspaceId.value
      
      // Get current workspace
      if (currentId && !currentId.startsWith('local_')) {
        const metadata = await workspaceService.getWorkspaceMetadata(currentId)
        if (metadata) {
          recent.push({ 
            id: currentId, 
            name: metadata.name || currentId, 
            isCurrent: true 
          })
        }
      }
      
      // Get recent workspaces from localStorage
      const stored = localStorage.getItem('recentWorkspaces')
      if (stored) {
        const history = JSON.parse(stored)
        for (const item of history) {
          // Skip if it's the current workspace (already added above)
          if (item.id === currentId) continue
          
          // Verify workspace still exists
          const metadata = await workspaceService.getWorkspaceMetadata(item.id)
          if (metadata) {
            recent.push({
              id: item.id,
              name: metadata.name || item.id,
              isCurrent: false
            })
          }
        }
      }
      
      recentWorkspaces.value = recent
    } catch (error) {
      console.error('Error loading recent workspaces:', error)
      recentWorkspaces.value = []
    }
  }

  // Network monitoring
  function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      isOnline.value = true
      networkError.value = null
      console.log('Network connection restored')
    })
    
    window.addEventListener('offline', () => {
      isOnline.value = false
      networkError.value = 'You are currently offline. Some features may not work.'
      console.warn('Network connection lost')
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }
  })

  // Initialize network monitoring
  if (typeof window !== 'undefined') {
    setupNetworkMonitoring()
  }
  
  return {
    // State
    currentWorkspaceId,
    currentWorkspaceName,
    isLoading,
    isWorkspaceModalOpen,
    isWorkspaceSwitcherOpen,
    isWorkspaceSettingsOpen,
    workspaceModalTab,
    recentWorkspaces,
    isSyncing,
    lastSyncTime,
    activeUsers,
    isOnline,
    networkError,
    // Getters
    hasWorkspace,
    isLocalWorkspace,
    isInitializing,
    // Actions
    setCurrentWorkspace,
    setLoading,
    setSyncing,
    openWorkspaceSettings,
    loadRecentWorkspaces,
    addToRecentWorkspaces,
    loadWorkspace,
    setInitializing: (value) => { isInitializing.value = value }
  }
})
