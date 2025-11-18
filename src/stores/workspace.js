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
    if (localData) {
      currentWorkspaceName.value = localData.name
      
      const draftStore = useDraftStore()
      if (localData.draftData) {
        draftStore.loadDraftData(localData.draftData)
      }
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

      // Update draft store with remote changes
      if (JSON.stringify(draftStore.draftSeries) !== JSON.stringify(data.draftSeries)) {
        draftStore.draftSeries = data.draftSeries
      }
      if (JSON.stringify(draftStore.highlightedChampions) !== JSON.stringify(data.highlightedChampions)) {
        draftStore.highlightedChampions = data.highlightedChampions
      }
      if (JSON.stringify(draftStore.unavailablePanelState) !== JSON.stringify(data.unavailablePanelState)) {
        draftStore.unavailablePanelState = data.unavailablePanelState
      }
      if (JSON.stringify(draftStore.pickContext) !== JSON.stringify(data.pickContext)) {
        draftStore.pickContext = data.pickContext
      }

      setSyncing(false)
    })
  }

  async function loadRecentWorkspaces() {
    try {
      const recent = []
      const currentId = currentWorkspaceId.value
      
      // Get current workspace
      if (currentId) {
        if (currentId.startsWith('local_')) {
          const localData = workspaceService.getLocalWorkspaceData(currentId)
          if (localData) {
            recent.push({ 
              id: currentId, 
              name: localData.name || currentId, 
              isCurrent: true,
              isLocal: true
            })
          }
        } else {
          const metadata = await workspaceService.getWorkspaceMetadata(currentId)
          if (metadata) {
            recent.push({ 
              id: currentId, 
              name: metadata.name || currentId, 
              isCurrent: true 
            })
          }
        }
      }
      
      // Get local workspaces
      const localWorkspaces = workspaceService.getLocalWorkspaces()
      Object.keys(localWorkspaces).forEach(id => {
        if (id !== currentId) {
          recent.push({ 
            id, 
            name: localWorkspaces[id].name || id, 
            isLocal: true 
          })
        }
      })
      
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
    // Actions
    setCurrentWorkspace,
    setLoading,
    setSyncing,
    openWorkspaceSettings,
    loadRecentWorkspaces,
    loadWorkspace
  }
})
