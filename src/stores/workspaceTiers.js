import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { workspaceService } from '@/services/workspace'
import { useWorkspaceStore } from './workspace'
import { useChampionsStore } from './champions'
import { useSettingsStore } from './settings'
import { authService } from '@/services/firebase/auth'
import { canWrite } from '@/composables/usePermissions'

export const useWorkspaceTiersStore = defineStore('workspaceTiers', () => {
  // State
  const tiers = ref([])
  const selectedTierId = ref(null)
  const isLoading = ref(false)
  const error = ref('')
  const isInitialized = ref(false)
  let unsubscribeRealtimeSync = null
  let saveTimeout = null
  let isSaving = ref(false)

  // Default tiers (stored in global champions data)
  const defaultTiers = ref([
    {
      id: 'op',
      name: 'OP',
      order: 0,
      style: 'border',
      color: '#d97706', // Orange color to match existing OP tier
      champions: [],
      isDefault: true
    },
    {
      id: 'highlight',
      name: 'Highlight',
      order: 1,
      style: 'highlight', // Special style that combines border + shadow like manually-marked
      color: '#3b82f6', // Blue color to match existing highlights
      champions: [],
      isDefault: true
    }
  ])

  // Computed
  const currentTiers = computed(() => {
    // Return workspace tiers if they exist, otherwise default tiers
    return tiers.value.length > 0 ? tiers.value : defaultTiers.value
  })

  const sortedTiers = computed(() => {
    return [...currentTiers.value].sort((a, b) => a.order - b.order)
  })

  const selectedTier = computed(() => {
    return sortedTiers.value.find(tier => tier.id === selectedTierId.value)
  })

  const hasWorkspaceTiers = computed(() => {
    return tiers.value.length > 0
  })

  // Helper functions
  function getTierForChampion(championName, role = null) {
    for (const tier of sortedTiers.value) {
      const championRoles = tier.champions[championName]
      if (championRoles && Array.isArray(championRoles)) {
        if (role === null || championRoles.includes(role)) {
          return tier
        }
      }
    }
    return null
  }

  function isChampionInTier(championName, tierId, role = null) {
    const tier = currentTiers.value.find(t => t.id === tierId)
    if (!tier) return false

    const championRoles = tier.champions[championName]
    if (!championRoles || !Array.isArray(championRoles)) return false

    return role === null || championRoles.includes(role)
  }

  function getChampionTierRoles(championName, tierId) {
    const tier = currentTiers.value.find(t => t.id === tierId)
    if (!tier) return []

    const championRoles = tier.champions[championName]
    return championRoles && Array.isArray(championRoles) ? championRoles : []
  }

  // Actions
  async function initialize() {
    if (isInitialized.value) return

    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) {
      console.log('No workspace loaded, skipping tier initialization')
      return
    }

    await loadTiers()
    isInitialized.value = true

    // Set up real-time sync for non-local workspaces
    if (!workspaceStore.isLocalWorkspace) {
      setupRealtimeSync()
    }
  }

  async function loadTiers() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) return

    isLoading.value = true
    error.value = ''

    try {
      // Load default tiers from champions data first
      const championsStore = useChampionsStore()
      await championsStore.loadChampions()

      // Update default tiers with champion data
      updateDefaultTiersFromChampions()

      // Try to load workspace-specific tiers first (prioritize workspace over global)
      let loadedWorkspaceTiers = false
      if (!workspaceStore.isLocalWorkspace) {
        const workspaceRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId)
        const tiersRef = doc(workspaceRef, 'tiers', 'current')
        const docSnap = await getDoc(tiersRef)

        if (docSnap.exists() && docSnap.data().tiers && docSnap.data().tiers.length > 0) {
          const data = docSnap.data()
          tiers.value = data.tiers
          console.log(`Loaded ${tiers.value.length} workspace tiers`)
          loadedWorkspaceTiers = true
        } else {
          // No workspace tiers or empty tiers, will use default tiers
          tiers.value = []
        }
      } else {
        // Local workspace - no persistence
        tiers.value = []
        selectedTierId.value = null
      }

      // Always load global defaults so `defaultTiers` represents true user-defined global defaults
      const globalDefaults = await loadGlobalDefaults()
      if (globalDefaults && globalDefaults.length > 0) {
        // Merge global defaults with champion data
        defaultTiers.value = globalDefaults.map(tier => ({
          ...tier,
          champions: tier.champions || {}
        }))
        console.log(`Loaded ${globalDefaults.length} global default tiers`)
      }
    } catch (error) {
      console.error('Error loading tiers:', error)
      error.value = 'Failed to load tiers'
      tiers.value = []
      selectedTierId.value = null
    } finally {
      isLoading.value = false
    }
  }

  function updateDefaultTiersFromChampions() {
    const championsStore = useChampionsStore()

    // Update OP tier with current OP champions - new per-role structure
    const opChampions = {}
    const highlightChampions = {}

    // Get all champions and check their OP/highlight status per role
    championsStore.allChampions.forEach(champion => {
      // Check each role the champion can play
      const roles = champion.roles || ['top', 'jungle', 'middle', 'bottom', 'support']

      roles.forEach(role => {
        if (championsStore.isOpForRole(champion.name, role)) {
          if (!opChampions[champion.name]) {
            opChampions[champion.name] = []
          }
          opChampions[champion.name].push(role)
        }
      })

      // Highlight champions would be populated from draft store highlights
      // For now, leave empty as they'll be managed separately
    })

    defaultTiers.value[0].champions = opChampions
    defaultTiers.value[1].champions = highlightChampions
  }

  function setupRealtimeSync() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) return

    // Clean up existing listener
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }

    const workspaceRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId)
    const tiersRef = doc(workspaceRef, 'tiers', 'current')

    unsubscribeRealtimeSync = onSnapshot(
      tiersRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          tiers.value = data.tiers || []
        } else {
          tiers.value = []
        }
      },
      (error) => {
        console.error('Error listening to tier updates:', error)
      }
    )
  }

  function selectTier(tierId) {
    selectedTierId.value = tierId
    queueSave()
  }

  function assignChampionToTier(championName, tierId, role = null) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[WorkspaceTiersStore] assignChampionToTier blocked: User is in view-only mode')
      return
    }

    // If we don't have workspace tiers yet, copy defaults to workspace tiers
    if (!hasWorkspaceTiers.value) {
      tiers.value = [...defaultTiers.value.map(t => ({ ...t, isDefault: false }))]
    }

    // If role is not specified, assign to all roles the champion can play
    const championsStore = useChampionsStore()
    const champion = championsStore.allChampions.find(c => c.name === championName)
    const rolesToAssign = role ? [role] : (champion?.roles || ['top', 'jungle', 'middle', 'bottom', 'support'])

    // Remove champion+role from all current tiers first
    tiers.value.forEach(tier => {
      if (tier.champions[championName]) {
        // Filter out the roles we're assigning
        tier.champions[championName] = tier.champions[championName].filter(r => !rolesToAssign.includes(r))
        // Remove champion entirely if no roles left
        if (tier.champions[championName].length === 0) {
          delete tier.champions[championName]
        }
      }
    })

    // Add to new tier if specified
    if (tierId) {
      const tier = tiers.value.find(t => t.id === tierId)
      if (tier) {
        if (!tier.champions[championName]) {
          tier.champions[championName] = []
        }
        // Add roles that aren't already there
        rolesToAssign.forEach(r => {
          if (!tier.champions[championName].includes(r)) {
            tier.champions[championName].push(r)
          }
        })
      }
    }

    queueSave()
  }

  function removeChampionFromTier(championName, tierId, role = null) {
    // If we don't have workspace tiers yet, copy defaults to workspace tiers
    if (!hasWorkspaceTiers.value) {
      tiers.value = [...defaultTiers.value.map(t => ({ ...t, isDefault: false }))]
    }

    const tier = tiers.value.find(t => t.id === tierId)
    if (tier && tier.champions[championName]) {
      if (role === null) {
        // Remove champion entirely from this tier
        delete tier.champions[championName]
      } else {
        // Remove specific role
        tier.champions[championName] = tier.champions[championName].filter(r => r !== role)
        // Remove champion entirely if no roles left
        if (tier.champions[championName].length === 0) {
          delete tier.champions[championName]
        }
      }
      queueSave()
    }
  }

  async function createTier(tierData) {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to manage tiers'
        return null
      }
    }

    const newTier = {
      id: `tier_${Date.now()}`,
      name: tierData.name,
      order: tierData.order || sortedTiers.value.length,
      style: tierData.style || 'border',
      color: tierData.color || 'gray',
      champions: {}, // Changed from array to object: { championName: [roles] }
      isDefault: false
    }

    // Ensure we have workspace tiers (copy defaults if needed)
    if (!hasWorkspaceTiers.value) {
      tiers.value = [...defaultTiers.value.map(t => ({ ...t, isDefault: false }))]
    }

    tiers.value.push(newTier)

    // Initialize tier card size in settings
    const settingsStore = useSettingsStore()
    settingsStore.initializeTierCardSize(newTier.id)

    queueSave()
    return newTier
  }

  async function updateTier(tierId, updates) {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to manage tiers'
        return false
      }
    }

    const tier = tiers.value.find(t => t.id === tierId)
    if (tier) {
      Object.assign(tier, updates)
      queueSave()
      return true
    }
    return false
  }

  async function deleteTier(tierId) {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to manage tiers'
        return false
      }
    }

    const index = tiers.value.findIndex(t => t.id === tierId)
    if (index > -1) {
      tiers.value.splice(index, 1)

      // Remove tier card size from settings
      const settingsStore = useSettingsStore()
      settingsStore.removeTierCardSize(tierId)

      queueSave()
      return true
    }
    return false
  }

  async function reorderTiers(newOrder) {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to manage tiers'
        return false
      }
    }

    // Update order property for each tier
    newOrder.forEach((tierId, index) => {
      const tier = tiers.value.find(t => t.id === tierId)
      if (tier) {
        tier.order = index
      }
    })

    queueSave()
    return true
  }

  async function resetToDefaults() {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to reset tiers'
        return false
      }
    }

    // Delete workspace tiers document to use defaults
    if (!workspaceStore.isLocalWorkspace) {
      try {
        const workspaceRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId)
        const tiersRef = doc(workspaceRef, 'tiers', 'current')
        await deleteDoc(tiersRef)
      } catch (error) {
        console.error('Error deleting workspace tiers:', error)
      }
    }

    // Reset workspace tiers and ensure default tiers are fresh
    tiers.value = []

    // Reload default tiers from champions data to ensure clean state
    const championsStore = useChampionsStore()
    await championsStore.loadChampions()
    updateDefaultTiersFromChampions()

    // Try to load global default tiers
    const globalDefaults = await loadGlobalDefaults()
    if (globalDefaults && globalDefaults.length > 0) {
      defaultTiers.value = globalDefaults.map(tier => ({
        ...tier,
        champions: tier.champions || {}
      }))
    }

    selectedTierId.value = null
    return true
  }

  async function fullReset() {
    const workspaceStore = useWorkspaceStore()

    // Check permissions
    if (!workspaceStore.isLocalWorkspace) {
      const isAdmin = await authService.isAdmin()
      if (!isAdmin) {
        error.value = 'Admin access required to reset tiers'
        return false
      }
    }

    // Create workspace tiers with default structure but empty champions
    const emptyDefaultTiers = defaultTiers.value.map(tier => ({
      ...tier,
      isDefault: false,
      champions: {} // Empty champions object
    }))

    tiers.value = emptyDefaultTiers
    selectedTierId.value = null

    // Save immediately to persist
    await saveTiers()

    return true
  }

  async function saveAsGlobalDefaults() {
    const workspaceStore = useWorkspaceStore()

    // Check admin permissions
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw new Error('Admin access required to save global defaults')
    }

    if (!hasWorkspaceTiers.value) {
      throw new Error('No custom tiers to save')
    }

    try {
      const globalDefaultsRef = doc(db, 'tiers', 'default')
      await setDoc(globalDefaultsRef, {
        tiers: tiers.value,
        lastUpdated: serverTimestamp(),
        updatedBy: authService.getUserId()
      })
      console.log('Global default tiers saved successfully')
    } catch (error) {
      console.error('Error saving global default tiers:', error)
      throw new Error('Failed to save global default tiers')
    }
  }

  async function resetGlobalDefaults() {
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw new Error('Admin access required to reset global defaults')
    }

    try {
      const globalDefaultsRef = doc(db, 'tiers', 'default')
      await deleteDoc(globalDefaultsRef)
      console.log('Global default tiers reset successfully')
    } catch (error) {
      console.error('Error resetting global default tiers:', error)
      throw new Error('Failed to reset global default tiers')
    }
  }

  async function loadGlobalDefaults() {
    try {
      const globalDefaultsRef = doc(db, 'tiers', 'default')
      const docSnap = await getDoc(globalDefaultsRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return data.tiers || []
      }
    } catch (error) {
      console.error('Error loading global default tiers:', error)
    }
    return null
  }

  function queueSave() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) {
      console.warn('Cannot save: No workspace selected')
      return
    }

    workspaceStore.setSyncing(true)
    isSaving.value = true

    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      try {
        if (workspaceStore.isLocalWorkspace) {
          // Save to localStorage
          workspaceService.saveLocalWorkspaceData(workspaceStore.currentWorkspaceId, {
            tiers: tiers.value
          })
          console.log('Saved local workspace tiers to localStorage')
          workspaceStore.setSyncing(false)
          isSaving.value = false
        } else {
          // Save to Firestore
          await saveTiers()
          workspaceStore.setSyncing(false)
          isSaving.value = false
        }
      } catch (error) {
        console.error('Error saving tier data:', error)
        workspaceStore.setSyncing(false)
        isSaving.value = false
        workspaceStore.networkError = error.message
      } finally {
        saveTimeout = null
      }
    }, 3000)
  }

  async function saveTiers() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) return

    try {
      const workspaceRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId)
      const tiersRef = doc(workspaceRef, 'tiers', 'current')

      const dataToSave = {
        tiers: tiers.value,
        lastUpdated: serverTimestamp(),
        updatedBy: authService.getUserId()
      }

      await setDoc(tiersRef, dataToSave)
      console.log('Tiers saved successfully')
    } catch (error) {
      console.error('Error saving tiers:', error)
      error.value = 'Failed to save tiers'
    }
  }

  // Reset store state for workspace switch
  function reset() {
    // Clean up real-time sync
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }
    // Reset state
    tiers.value = []
    selectedTierId.value = null
    isInitialized.value = false
    error.value = ''
    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    isSaving.value = false
  }

  // Cleanup
  function cleanup() {
    reset()
  }

  // Watch for workspace changes and reload tiers
  let workspaceWatcherUnsubscribe = null
  function setupWorkspaceWatcher() {
    // Clean up existing watcher if any
    if (workspaceWatcherUnsubscribe) {
      workspaceWatcherUnsubscribe()
      workspaceWatcherUnsubscribe = null
    }

    const workspaceStore = useWorkspaceStore()
    
    workspaceWatcherUnsubscribe = watch(
      () => workspaceStore.currentWorkspaceId,
      async (newWorkspaceId, oldWorkspaceId) => {
        if (newWorkspaceId && newWorkspaceId !== oldWorkspaceId) {
          console.log(`Workspace changed from ${oldWorkspaceId} to ${newWorkspaceId}, reloading tiers...`)
          // Reset and reinitialize for the new workspace
          reset()
          await initialize()
        } else if (!newWorkspaceId) {
          // No workspace selected, clean up
          reset()
        }
      },
      { immediate: false }
    )
  }

  // Initialize the workspace watcher immediately
  setupWorkspaceWatcher()

  return {
    // State
    tiers,
    selectedTierId,
    isLoading,
    error,
    defaultTiers,
    isSaving,
    // Computed
    currentTiers,
    sortedTiers,
    selectedTier,
    hasWorkspaceTiers,
    // Actions
    initialize,
    loadTiers,
    selectTier,
    assignChampionToTier,
    removeChampionFromTier,
    createTier,
    updateTier,
    deleteTier,
    reorderTiers,
    resetToDefaults,
    fullReset,
    saveTiers,
    queueSave,
    cleanup,
    saveAsGlobalDefaults,
    resetGlobalDefaults,
    loadGlobalDefaults,
    // Helpers
    getTierForChampion,
    isChampionInTier,
    getChampionTierRoles
  }
})
