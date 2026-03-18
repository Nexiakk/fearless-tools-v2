import { defineStore } from 'pinia'
import { ref, computed, onUnmounted, watch } from 'vue'
import { useWorkspaceStore } from './workspace'
import { useChampionsStore } from './champions'
import { useDraftStore } from './draft'
import { canWrite } from '@/composables/usePermissions'
import {
  createSeriesInFirestore,
  saveSeriesToFirestore,
  loadSeriesFromFirestore,
  getAllSeriesForWorkspace,
  deleteSeriesFromFirestore,
  setupSeriesRealtimeSync
} from '@/services/firebase/firestore'

export const useSeriesStore = defineStore('series', () => {
  // State
  const currentSeries = ref(null)
  const savedSeries = ref([])
  const isLoadingSeries = ref(false)
  const isSaving = ref(false)
  let saveTimeout = null
  let unsubscribeRealtimeSync = null
  const originalSeriesState = ref(null) // Store original state for change detection

  // Watch for champions being loaded and re-hydrate LCU drafts if needed
  let championsStoreInstance = null
  let draftStoreInstance = null
  watch(() => {
    // Lazy init stores to avoid circular dependency
    if (!championsStoreInstance) championsStoreInstance = useChampionsStore()
    if (!draftStoreInstance) draftStoreInstance = useDraftStore()
    return championsStoreInstance?.allChampions?.length || 0
  }, (newLength, oldLength) => {
    if (newLength > 0 && oldLength === 0 && draftStoreInstance?.lcuDraftsRaw?.length > 0) {
      console.log('[SeriesStore] Champions loaded, re-hydrating LCU drafts...')
      hydrateLcuDraftsInSeries(draftStoreInstance.lcuDraftsRaw)
    }
  })

  // Getters
  const hasSeries = computed(() => !!currentSeries.value)
  
  const currentGameNumber = computed(() => {
    if (!currentSeries.value) return null
    const gameIndex = currentSeries.value.currentGameIndex ?? 0
    return currentSeries.value.games?.[gameIndex]?.gameNumber || null
  })

  const currentGame = computed(() => {
    if (!currentSeries.value) return null
    const gameIndex = currentSeries.value.currentGameIndex ?? 0
    return currentSeries.value.games?.[gameIndex] || null
  })
  
  const currentDraft = computed(() => {
    const game = currentGame.value
    if (!game) return null
    const draftIndex = game.currentDraftIndex ?? 0
    return game.drafts?.[draftIndex] || null
  })
  
  const canAddGame = computed(() => {
    if (!currentSeries.value) return false
    return (currentSeries.value.games?.length || 0) < 5
  })

  // Helper: Create default draft
  function createDefaultDraft() {
    return {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Draft 1',
      bluePicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      blueBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      redPicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      redBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      generalNotes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      hasChanges: false,
      source: 'manual', // 'manual' or 'lcu'
      isReadOnly: false,
      isCompleted: false
    }
  }

  // Helper: Create default game
  function createDefaultGame(gameNumber) {
    return {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gameNumber,
      drafts: [createDefaultDraft()],
      currentDraftIndex: 0,
      createdAt: new Date(),
      hasChanges: false
    }
  }

  // Helper: Create default series
  function createDefaultSeries(name = 'New Series') {
    const games = []
    for (let i = 1; i <= 5; i++) {
      games.push(createDefaultGame(i))
    }
    
    return {
      name,
      workspaceId: null,
      games,
      currentGameIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  // Initialize default series
  function initializeDefaultSeries() {
    if (currentSeries.value) return

    const workspaceStore = useWorkspaceStore()
    const defaultSeries = createDefaultSeries('New Series')
    defaultSeries.workspaceId = workspaceStore.currentWorkspaceId
    currentSeries.value = defaultSeries

    // Hydrate any existing LCU drafts into the newly created series
    const draftStore = useDraftStore()
    if (draftStore.lcuDraftsRaw && draftStore.lcuDraftsRaw.length > 0) {
      hydrateLcuDraftsInSeries(draftStore.lcuDraftsRaw)
    }
  }

  // Create new series
  async function createNewSeries(name = 'New Series') {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] createNewSeries blocked: User is in view-only mode')
      return null
    }

    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      // Local workspace - just create in memory
      const newSeries = createDefaultSeries(name)
      newSeries.workspaceId = workspaceStore.currentWorkspaceId
      currentSeries.value = newSeries
      return newSeries
    }

    try {
      const newSeries = createDefaultSeries(name)
      newSeries.workspaceId = workspaceStore.currentWorkspaceId
      const created = await createSeriesInFirestore(workspaceStore.currentWorkspaceId, newSeries)
      currentSeries.value = { ...newSeries, id: created.id }
      setupRealtimeSync()
      return currentSeries.value
    } catch (error) {
      console.error('Error creating series:', error)
      throw error
    }
  }

  // Reset series
  function resetSeries() {
    const workspaceStore = useWorkspaceStore()
    const defaultSeries = createDefaultSeries('New Series')
    defaultSeries.workspaceId = workspaceStore.currentWorkspaceId
    if (currentSeries.value?.id) {
      defaultSeries.id = currentSeries.value.id
    }
    currentSeries.value = defaultSeries
    queueSave()
  }

  // Load series
  async function loadSeries(seriesId, gameNumber = null) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      console.warn('Cannot load series in local workspace')
      return
    }

    isLoadingSeries.value = true
    try {
      const series = await loadSeriesFromFirestore(workspaceStore.currentWorkspaceId, seriesId)
      if (series) {
        // Ensure series has 5 games
        if (!series.games || series.games.length < 5) {
          const existingGames = series.games || []
          for (let i = existingGames.length + 1; i <= 5; i++) {
            existingGames.push(createDefaultGame(i))
          }
          series.games = existingGames
        }

        // Set current game index before storing original state
        if (gameNumber !== null) {
          const gameIndex = series.games?.findIndex(g => g.gameNumber === gameNumber)
          if (gameIndex !== -1) {
            series.currentGameIndex = gameIndex
          }
        }

        // Store the original state for change detection
        originalSeriesState.value = JSON.parse(JSON.stringify(series))

        currentSeries.value = series
        
        const draftStore = useDraftStore()
        if (draftStore.lcuDraftsRaw && draftStore.lcuDraftsRaw.length > 0) {
          hydrateLcuDraftsInSeries(draftStore.lcuDraftsRaw)
        }
        
        setupRealtimeSync()
      }
    } catch (error) {
      console.error('Error loading series:', error)
      throw error
    } finally {
      isLoadingSeries.value = false
    }
  }

  // Refresh saved series list
  async function refreshSavedSeries() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      savedSeries.value = []
      return
    }

    isLoadingSeries.value = true
    try {
      const series = await getAllSeriesForWorkspace(workspaceStore.currentWorkspaceId)
      savedSeries.value = series
    } catch (error) {
      console.error('Error refreshing saved series:', error)
    } finally {
      isLoadingSeries.value = false
    }
  }

  // Delete series
  async function deleteSeries(seriesId) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] deleteSeries blocked: User is in view-only mode')
      return
    }

    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      console.warn('Cannot delete series in local workspace')
      return
    }

    try {
      await deleteSeriesFromFirestore(workspaceStore.currentWorkspaceId, seriesId)
      if (currentSeries.value?.id === seriesId) {
        currentSeries.value = null
        cleanupRealtimeSync()
      }
      await refreshSavedSeries()
    } catch (error) {
      console.error('Error deleting series:', error)
      throw error
    }
  }

  // Add game
  function addGame() {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] addGame blocked: User is in view-only mode')
      return
    }

    if (!currentSeries.value || !canAddGame.value) return
    
    const gameNumber = (currentSeries.value.games?.length || 0) + 1
    const newGame = createDefaultGame(gameNumber)
    currentSeries.value.games.push(newGame)
    queueSave()
  }

  // Remove game
  function removeGame(gameNumber) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] removeGame blocked: User is in view-only mode')
      return
    }

    if (!currentSeries.value) return
    
    currentSeries.value.games = currentSeries.value.games.filter(g => g.gameNumber !== gameNumber)
    // Renumber games
    currentSeries.value.games.forEach((game, index) => {
      game.gameNumber = index + 1
    })
    
    // Adjust current game index if needed
    if (currentSeries.value.currentGameIndex >= currentSeries.value.games.length) {
      currentSeries.value.currentGameIndex = currentSeries.value.games.length - 1
    }
    
    queueSave()
  }

  // Add draft iteration
  function addDraftIteration() {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] addDraftIteration blocked: User is in view-only mode')
      return
    }

    const game = currentGame.value
    if (!game) return
    
    const newDraft = createDefaultDraft()
    newDraft.name = `Draft ${(game.drafts?.length || 0) + 1}`
    if (!game.drafts) game.drafts = []
    
    // Add to end of drafts
    game.drafts.push(newDraft)
    game.currentDraftIndex = game.drafts.length - 1
    game.hasChanges = true
    queueSave()
  }

  // Create LCU draft iteration
  function createLcuDraftIteration() {
    if (!canWrite()) {
      console.log('[SeriesStore] createLcuDraftIteration blocked: User is in view-only mode')
      return
    }

    const game = currentGame.value
    if (!game) return
    
    // Check if an LCU draft already exists for this game and is not completed
    if (game.drafts && game.drafts.length > 0) {
      const existingLcuDraft = game.drafts.find(d => d.source === 'lcu' && !d.isCompleted)
      if (existingLcuDraft) {
        // Just switch to it
        game.currentDraftIndex = game.drafts.indexOf(existingLcuDraft)
        return
      }
    }

    const newDraft = createDefaultDraft()
    newDraft.name = 'LCU Draft'
    newDraft.source = 'lcu'
    newDraft.isReadOnly = true
    
    if (!game.drafts) game.drafts = []
    
    // Check if there's already an LCU draft at index 0
    if (game.drafts.length > 0 && game.drafts[0].source === 'lcu') {
      // Overwrite the existing completed LCU draft if a new one starts for the same game
      game.drafts[0] = newDraft
      game.currentDraftIndex = 0
    } else {
      // Insert at the beginning
      game.drafts.unshift(newDraft)
      game.currentDraftIndex = 0
    }
    
    game.hasChanges = true
    queueSave()
  }

  // Remove draft iteration
  function removeDraftIteration(draftIndex) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] removeDraftIteration blocked: User is in view-only mode')
      return
    }

    const game = currentGame.value
    if (!game || !game.drafts || game.drafts.length <= 1) return
    
    const draftToRemove = game.drafts[draftIndex]
    if (draftToRemove && draftToRemove.isReadOnly) {
      console.log('[SeriesStore] removeDraftIteration blocked: Cannot delete read-only iteration')
      return
    }
    
    game.drafts.splice(draftIndex, 1)
    if (game.currentDraftIndex >= game.drafts.length) {
      game.currentDraftIndex = game.drafts.length - 1
    }
    game.hasChanges = true
    queueSave()
  }

  // Set current game
  function setCurrentGame(gameNumber) {
    if (!currentSeries.value) return
    
    const gameIndex = currentSeries.value.games?.findIndex(g => g.gameNumber === gameNumber)
    if (gameIndex !== -1) {
      currentSeries.value.currentGameIndex = gameIndex
      queueSave()
    }
  }

  // Set current draft
  function setCurrentDraft(draftIndex) {
    const game = currentGame.value
    if (!game || !game.drafts) return
    
    if (draftIndex >= 0 && draftIndex < game.drafts.length) {
      game.currentDraftIndex = draftIndex
      queueSave()
    }
  }

  // Update current draft slot
  function updateCurrentDraftSlot(side, type, index, champion) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] updateCurrentDraftSlot blocked: User is in view-only mode')
      return
    }

    const draft = currentDraft.value
    if (!draft) return
    
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    if (draft[slotKey] && draft[slotKey][index]) {
      draft[slotKey][index].champion = champion
      draft.hasChanges = true
      draft.updatedAt = new Date()
      
      const game = currentGame.value
      if (game) {
        game.hasChanges = true
      }
      
      queueSave()
    }
  }

  // Update current draft slot notes
  function updateCurrentDraftSlotNotes(side, type, index, notes) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] updateCurrentDraftSlotNotes blocked: User is in view-only mode')
      return
    }

    const draft = currentDraft.value
    if (!draft) return
    
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    if (draft[slotKey] && draft[slotKey][index]) {
      draft[slotKey][index].notes = notes
      draft.hasChanges = true
      draft.updatedAt = new Date()
      
      const game = currentGame.value
      if (game) {
        game.hasChanges = true
      }
      
      queueSave()
    }
  }

  // Update current draft general notes
  function updateCurrentDraftGeneralNotes(notes) {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] updateCurrentDraftGeneralNotes blocked: User is in view-only mode')
      return
    }

    const draft = currentDraft.value
    if (!draft) return
    
    draft.generalNotes = notes
    draft.hasChanges = true
    draft.updatedAt = new Date()
    
    const game = currentGame.value
    if (game) {
      game.hasChanges = true
    }
    
    queueSave()
  }

  // Complete LCU draft and auto-advance
  function completeLcuDraft() {
    if (!canWrite()) {
      console.log('[SeriesStore] completeLcuDraft blocked: User is in view-only mode')
      return
    }

    const game = currentGame.value
    if (!game || !game.drafts) return
    
    const lcuDraftIndex = game.drafts.findIndex(d => d.source === 'lcu' && !d.isCompleted)
    if (lcuDraftIndex !== -1) {
      game.drafts[lcuDraftIndex].isCompleted = true
      game.hasChanges = true
      queueSave()
      
      // Auto advance to next game if possible and if this game is full (has picks)
      if (canAddGame.value) {
        addGame()
        // Switching game is handled by LcuSyncService or component reacting to addGame
      } else if (currentSeries.value && currentSeries.value.currentGameIndex < currentSeries.value.games.length - 1) {
         setCurrentGame(currentSeries.value.games[currentSeries.value.currentGameIndex + 1].gameNumber)
      }
    }
  }

  // Automatically hydrate LCU read-only iterations into their respective games
  function hydrateLcuDraftsInSeries(lcuDrafts) {
    if (!currentSeries.value || !currentSeries.value.games) return

    const championsStore = useChampionsStore()

    // Don't hydrate if champions aren't loaded yet - will be retried when they load
    if (!championsStore.allChampions || championsStore.allChampions.length === 0) {
      console.log('[SeriesStore] hydrateLcuDraftsInSeries: Champions not loaded yet, skipping hydration')
      return
    }

    let hasChanges = false;

    const championIdToName = (id) => {
      if (!id || id === 'None') return null
      const idNum = parseInt(id, 10)
      const champion = championsStore.allChampions.find(c => c.id === idNum)
      return champion ? champion.name : null
    }

    lcuDrafts.forEach(rawDraft => {
      try {
        if (!rawDraft.id) return
        const parts = rawDraft.id.split('_')
        const gameNumber = parseInt(parts[parts.length - 1], 10)
        if (isNaN(gameNumber)) return
        
        const game = currentSeries.value.games.find(g => g.gameNumber === gameNumber)
        if (!game) return
        
        if (!game.drafts) game.drafts = []
        
        const existingLcuIndex = game.drafts.findIndex(d => d.source === 'lcu' || d.isReadOnly)
        let draftToUpdate = null
        
        if (existingLcuIndex === -1) {
          // Hydrate missing
          const newDraft = createDefaultDraft()
          newDraft.name = 'LCU Draft'
          newDraft.source = 'lcu'
          newDraft.isReadOnly = true
          
          let totalPicks = 0
          if (rawDraft.blueSide?.picks) totalPicks += rawDraft.blueSide.picks.filter(id => id && id !== 'None').length
          if (rawDraft.redSide?.picks) totalPicks += rawDraft.redSide.picks.filter(id => id && id !== 'None').length
          newDraft.isCompleted = totalPicks >= 10
          
          game.drafts.unshift(newDraft)
          
          // Adjust current draft index since we unshifted
          if (game.currentDraftIndex !== undefined) {
            game.currentDraftIndex++
          } else {
            game.currentDraftIndex = 0
          }
          
          draftToUpdate = newDraft
          hasChanges = true
          game.hasChanges = true // Force database sync
        } else {
          draftToUpdate = game.drafts[existingLcuIndex]
        }
        
        // Auto-update slots for the draft just in case it's empty
        if (draftToUpdate) {
          // Helper to update slots manually
          const updateSlot = (side, type, index, champName) => {
              const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
              if (draftToUpdate[slotKey] && draftToUpdate[slotKey][index] && draftToUpdate[slotKey][index].champion !== champName) {
                  draftToUpdate[slotKey][index].champion = champName
                  hasChanges = true
                  game.hasChanges = true // Force database sync
              }
          }
          
          if (rawDraft.blueSide) {
             if (rawDraft.blueSide.bans) {
               let actualBanIndex = 0
               rawDraft.blueSide.bans.forEach(banId => {
                 if (actualBanIndex < 5 && banId !== 'None') {
                    const champName = championIdToName(banId)
                    if (champName) { updateSlot('blue', 'bans', actualBanIndex, champName); actualBanIndex++ }
                 } else if (banId === 'None') { actualBanIndex++ }
               })
             }
             if (rawDraft.blueSide.picks) {
               rawDraft.blueSide.picks.forEach((pickId, index) => {
                 if (index < 5) {
                    const champName = championIdToName(pickId)
                    if (champName) updateSlot('blue', 'picks', index, champName)
                 }
               })
             }
          }
          if (rawDraft.redSide) {
             if (rawDraft.redSide.bans) {
               let actualBanIndex = 0
               rawDraft.redSide.bans.forEach(banId => {
                 if (actualBanIndex < 5 && banId !== 'None') {
                    const champName = championIdToName(banId)
                    if (champName) { updateSlot('red', 'bans', actualBanIndex, champName); actualBanIndex++ }
                 } else if (banId === 'None') { actualBanIndex++ }
               })
             }
             if (rawDraft.redSide.picks) {
               rawDraft.redSide.picks.forEach((pickId, index) => {
                 if (index < 5) {
                    const champName = championIdToName(pickId)
                    if (champName) updateSlot('red', 'picks', index, champName)
                 }
               })
             }
          }
        }
      } catch (err) {
        console.error("Hydration error for draft:", rawDraft.id, err)
      }
    })
    
    if (hasChanges && canWrite()) {
      queueSave()
    }
  }

  // Update specific LCU draft slot (avoids permission checks for automated updates)
  function updateLcuDraftSlot(side, type, index, champion) {
    const game = currentGame.value
    if (!game || !game.drafts) return
    
    const lcuDraftIndex = game.drafts.findIndex(d => d.source === 'lcu' && !d.isCompleted)
    if (lcuDraftIndex === -1) return
    
    const draft = game.drafts[lcuDraftIndex]
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    
    if (draft[slotKey] && draft[slotKey][index]) {
      draft[slotKey][index].champion = champion
      draft.updatedAt = new Date()
      game.hasChanges = true
      queueSave()
    }
  }

  // Get unavailable champions for a game
  function getUnavailableChampionsForGame(gameNumber) {
    if (!currentSeries.value) return new Set()
    
    const unavailable = new Set()
    
    // Get champions from all previous games
    for (const game of currentSeries.value.games || []) {
      if (game.gameNumber >= gameNumber) break
      
      // Collect champions from all drafts in this game
      for (const draft of game.drafts || []) {
        const allSlots = [
          ...(draft.bluePicks || []),
          ...(draft.blueBans || []),
          ...(draft.redPicks || []),
          ...(draft.redBans || [])
        ]
        
        allSlots.forEach(slot => {
          if (slot?.champion) {
            unavailable.add(slot.champion)
          }
        })
      }
    }
    
    return unavailable
  }

  // Check if game has changes
  function gameHasChanges(game) {
    if (!game) return false

    // Check if any draft has changes (defined as having at least one champion in slots)
    for (const draft of game.drafts || []) {
      // Check if any slot has a champion
      const allSlots = [
        ...(draft.bluePicks || []),
        ...(draft.blueBans || []),
        ...(draft.redPicks || []),
        ...(draft.redBans || [])
      ]

      if (allSlots.some(slot => slot?.champion)) return true
    }

    return false
  }

  // Get games with changes
  function getGamesWithChanges() {
    if (!currentSeries.value) return []

    return (currentSeries.value.games || []).filter(game => gameHasChanges(game))
  }

  // Check if current series has unsaved changes
  // A draft has changes if it has any champions in its slots
  function hasUnsavedChanges() {
    if (!currentSeries.value) return false

    // Check if any game has drafts with actual content (champions in slots)
    const gamesWithContent = (currentSeries.value.games || []).filter(game => {
      // Skip games that didn't exist before (are newly created defaults)
      if (!originalSeriesState.value) return true

      const originalGame = originalSeriesState.value.games?.find(
        g => g.gameNumber === game.gameNumber
      )

      // If this game didn't exist in original state, it's a new game, not an unsaved change
      if (!originalGame) return false

      // Check if this game has any draft with champions
      return gameHasChanges(game)
    })

    return gamesWithContent.length > 0
  }

  // Queue save (debounced) - DISABLED: Manual save only
  function queueSave() {
    // Auto-save disabled - users must manually click Save button
    return
  }

  // Save series
  async function saveSeries() {
    // Check permissions - block if in view-only mode
    if (!canWrite()) {
      console.log('[SeriesStore] saveSeries blocked: User is in view-only mode')
      return
    }

    if (!currentSeries.value) return
    
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      return // Don't save in local workspace
    }

    // Only save games with changes
    const gamesWithChanges = getGamesWithChanges()
    if (gamesWithChanges.length === 0) {
      return // Nothing to save
    }

    // If it's a new series (no id), prompt for name
    if (!currentSeries.value.id) {
      const name = prompt('Enter series name:', currentSeries.value.name || 'New Series')
      if (!name) return // User cancelled
      currentSeries.value.name = name
    }

    isSaving.value = true
    try {
      const seriesData = {
        name: currentSeries.value.name,
        workspaceId: workspaceStore.currentWorkspaceId,
        games: gamesWithChanges,
        currentGameIndex: currentSeries.value.currentGameIndex,
        updatedAt: new Date()
      }

      if (currentSeries.value.id) {
        // Update existing
        await saveSeriesToFirestore(workspaceStore.currentWorkspaceId, currentSeries.value.id, seriesData)
        currentSeries.value.updatedAt = new Date()
      } else {
        // Create new
        const created = await createSeriesInFirestore(workspaceStore.currentWorkspaceId, seriesData)
        currentSeries.value.id = created.id
        currentSeries.value.createdAt = new Date()
        currentSeries.value.updatedAt = new Date()
        setupRealtimeSync()
      }

      // Update original state after successful save
      originalSeriesState.value = JSON.parse(JSON.stringify(currentSeries.value))

      await refreshSavedSeries()
    } catch (error) {
      console.error('Error saving series:', error)
      throw error
    } finally {
      isSaving.value = false
    }
  }

  // Setup real-time sync
  function setupRealtimeSync() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || !currentSeries.value?.id || workspaceStore.isLocalWorkspace) {
      return
    }

    cleanupRealtimeSync()

    unsubscribeRealtimeSync = setupSeriesRealtimeSync(
      workspaceStore.currentWorkspaceId,
      currentSeries.value.id,
      (series) => {
        if (series) {
          // Preserve currentGameIndex if already set (user selected a game)
          const savedGameIndex = currentSeries.value?.currentGameIndex ?? 0

          // Ensure series has 5 games
          if (!series.games || series.games.length < 5) {
            const existingGames = series.games || []
            for (let i = existingGames.length + 1; i <= 5; i++) {
              existingGames.push(createDefaultGame(i))
            }
            series.games = existingGames
          }

          // Restore the current game index to preserve user's selection
          series.currentGameIndex = savedGameIndex

          currentSeries.value = series
          
          const draftStore = useDraftStore()
          if (draftStore.lcuDraftsRaw && draftStore.lcuDraftsRaw.length > 0) {
            hydrateLcuDraftsInSeries(draftStore.lcuDraftsRaw)
          }
        }
      }
    )
  }

  // Cleanup real-time sync
  function cleanupRealtimeSync() {
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    cleanupRealtimeSync()
  })

  return {
    // State
    currentSeries,
    savedSeries,
    isLoadingSeries,
    isSaving,
    // Getters
    hasSeries,
    currentGameNumber,
    currentGame,
    currentDraft,
    canAddGame,
    // Actions
    createDefaultDraft,
    createDefaultSeries,
    initializeDefaultSeries,
    createNewSeries,
    resetSeries,
    loadSeries,
    refreshSavedSeries,
    deleteSeries,
    addGame,
    removeGame,
    addDraftIteration,
    createLcuDraftIteration,
    removeDraftIteration,
    setCurrentGame,
    setCurrentDraft,
    updateCurrentDraftSlot,
    updateCurrentDraftSlotNotes,
    updateCurrentDraftGeneralNotes,
    updateLcuDraftSlot,
    hydrateLcuDraftsInSeries, // Added to exports
    completeLcuDraft,
    getUnavailableChampionsForGame,
    gameHasChanges,
    getGamesWithChanges,
    hasUnsavedChanges,
    queueSave,
    saveSeries,
    setupRealtimeSync,
    cleanupRealtimeSync
  }
 })
