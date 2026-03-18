import { useDraftStore } from '@/stores/draft'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftingStore } from '@/stores/drafting'
import { useSeriesStore } from '@/stores/series'
import { fetchLcuDraftsFromFirestore, setupLcuDraftsRealtimeSync } from './firebase/firestore'

// Reference to hold the cleanup function for the global listener
let globalLcuDraftsListener = null

class LcuSyncService {
  constructor() {
    this.unsubscribe = null
    this.isInitialized = false
  }

  // Lazy getters for stores to avoid Pinia initialization issues
  get draftStore() {
    return useDraftStore()
  }

  get settingsStore() {
    return useSettingsStore()
  }

  get draftingStore() {
    return useDraftingStore()
  }

  get workspaceStore() {
    return useWorkspaceStore()
  }

  async initialize() {
    if (this.isInitialized) return

    // Watch for workspace changes
    this.workspaceStore.$subscribe(async (mutation, state) => {
      if (state.hasWorkspace && !state.isLocalWorkspace) {
        await this.startSync()
      } else {
        this.stopSync()
      }
    })

    // Watch for mode changes
    this.draftingStore.$subscribe(async (mutation, state) => {
      const draftingMode = state.draftingMode
      if (draftingMode === 'lcu-sync') {
        this.draftingStore.lcuActivityDetected = false // Reset when entering LCU mode
        await this.startSync()
      } else {
        this.stopSync()
      }
    })

    this.isInitialized = true

    // Initial sync if conditions are met
    if (this.workspaceStore.hasWorkspace &&
        !this.workspaceStore.isLocalWorkspace) {
      // Start global listener for activity detection
      this.setupGlobalActivityListener()
      
      if (this.draftingStore.draftingMode === 'lcu-sync') {
        await this.startSync()
      }
    }
  }

  setupGlobalActivityListener() {
    if (globalLcuDraftsListener) {
      globalLcuDraftsListener()
    }
    
    globalLcuDraftsListener = setupLcuDraftsRealtimeSync(
      this.workspaceStore.currentWorkspaceId,
      (drafts) => {
        // Only trigger activity detection if not in LCU Sync mode and drafts exist
        if (this.draftingStore.draftingMode !== 'lcu-sync' && drafts && drafts.length > 0) {
          // Find if there's an active draft
          const hasActiveDraft = drafts.some(draft => {
            const hasBans = draft.blueSide?.bans?.some(id => id && id !== 'None') || draft.redSide?.bans?.some(id => id && id !== 'None')
            const hasPicks = draft.blueSide?.picks?.some(id => id && id !== 'None') || draft.redSide?.picks?.some(id => id && id !== 'None')
            return hasBans || hasPicks
          })
          
          if (hasActiveDraft) {
             this.draftingStore.lcuActivityDetected = true
          }
        }
      }
    )
  }

  async startSync() {
    if (!this.workspaceStore.hasWorkspace || this.workspaceStore.isLocalWorkspace) return
    if (this.draftingStore.draftingMode !== 'lcu-sync') return

    try {
      console.log('[LCU Sync] Starting LCU Sync mode')

      // Stop existing sync
      this.stopSync()

      // Load initial LCU drafts and populate slots
      await this.loadAndPopulateLcuDrafts()

      // Set up real-time sync
      this.unsubscribe = setupLcuDraftsRealtimeSync(
        this.workspaceStore.currentWorkspaceId,
        async (updatedDrafts) => {
          await this.handleRealtimeUpdate(updatedDrafts)
        }
      )

    } catch (error) {
      console.error('[LCU Sync] Error starting sync:', error)
    }
  }

  stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    console.log('[LCU Sync] Stopped LCU Sync mode')
  }

  async loadAndPopulateLcuDrafts() {
    try {
      const lcuDrafts = await fetchLcuDraftsFromFirestore(this.workspaceStore.currentWorkspaceId)
      await this.populateDraftSlotsFromLcuDrafts(lcuDrafts)
      this.checkForCompletedDrafts(lcuDrafts)
    } catch (error) {
      console.error('[LCU Sync] Error loading LCU drafts:', error)
    }
  }

  async populateDraftSlotsFromLcuDrafts(lcuDrafts) {
    if (!lcuDrafts || lcuDrafts.length === 0) return

    // Find the latest draft by highest sequential number
    let latestDraft = null
    let maxNumber = -1

    lcuDrafts.forEach(draft => {
      if (draft.id) {
        const parts = draft.id.split('_')
        if (parts.length >= 2) {
          const number = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number
            latestDraft = draft
          }
        }
      }
    })

    if (!latestDraft) return

    console.log(`[LCU Sync] Populating slots from latest draft: ${latestDraft.id}`)

    // Convert LCU champion IDs to names
    const championsStore = useDraftStore().$pinia._s.get('champions')
    const championIdToName = (id) => {
      if (!id || id === 'None') return null
      const idNum = parseInt(id, 10)
      const champion = championsStore.allChampions.find(c => c.id === idNum)
      return champion ? champion.name : null
    }

    // Ensure LCU iteration exists in the UI before populating
    const seriesStore = useSeriesStore()
    seriesStore.createLcuDraftIteration()

    // Populate blue side
    if (latestDraft.blueSide) {
      // Bans (first 5 positions)
      if (latestDraft.blueSide.bans) {
        let actualBanIndex = 0
        latestDraft.blueSide.bans.forEach((banId) => {
          if (actualBanIndex < 5 && banId !== 'None') {
            const championName = championIdToName(banId)
            if (championName) {
              seriesStore.updateLcuDraftSlot('blue', 'bans', actualBanIndex, championName)
              actualBanIndex++
            }
          } else if (banId === 'None') {
            actualBanIndex++
          }
        })
      }

      // Picks (positions 5-9)
      if (latestDraft.blueSide.picks) {
        latestDraft.blueSide.picks.forEach((pickId, index) => {
          if (index < 5) {
            const championName = championIdToName(pickId)
            if (championName) {
              seriesStore.updateLcuDraftSlot('blue', 'picks', index, championName)
            }
          }
        })
      }
    }

    // Populate red side
    if (latestDraft.redSide) {
      // Bans (first 5 positions)
      if (latestDraft.redSide.bans) {
        let actualBanIndex = 0
        latestDraft.redSide.bans.forEach((banId) => {
          if (actualBanIndex < 5 && banId !== 'None') {
            const championName = championIdToName(banId)
            if (championName) {
              seriesStore.updateLcuDraftSlot('red', 'bans', actualBanIndex, championName)
              actualBanIndex++
            }
          } else if (banId === 'None') {
            actualBanIndex++
          }
        })
      }

      // Picks (positions 5-9, mapped to 0-4)
      if (latestDraft.redSide.picks) {
        latestDraft.redSide.picks.forEach((pickId, index) => {
          if (index < 5) {
            const championName = championIdToName(pickId)
            if (championName) {
              seriesStore.updateLcuDraftSlot('red', 'picks', index, championName)
            }
          }
        })
      }
    }
  }

  async handleRealtimeUpdate(updatedDrafts) {
    console.log('[LCU Sync] Real-time update received')
    await this.populateDraftSlotsFromLcuDrafts(updatedDrafts)
    this.checkForCompletedDrafts(updatedDrafts)
  }

  checkForCompletedDrafts(lcuDrafts) {
    if (!lcuDrafts || lcuDrafts.length === 0) return

    // Find the latest draft
    let latestDraft = null
    let maxNumber = -1

    lcuDrafts.forEach(draft => {
      if (draft.id) {
        const parts = draft.id.split('_')
        if (parts.length >= 2) {
          const number = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number
            latestDraft = draft
          }
        }
      }
    })

    if (!latestDraft) return

    // Check if all picks are done (10 picks total)
    const bluePicks = latestDraft.blueSide?.picks || []
    const redPicks = latestDraft.redSide?.picks || []

    const totalPicks = bluePicks.filter(id => id && id !== 'None').length +
                       redPicks.filter(id => id && id !== 'None').length

    const allPicksDone = totalPicks >= 10

    if (allPicksDone) {
      console.log('[LCU Sync] All picks completed! Completing LCU draft iteration')
      const seriesStore = useSeriesStore()
      seriesStore.completeLcuDraft()
    }
  }

  // Utility method to check if we're in sync mode
  isInSyncMode() {
    return this.draftingStore.draftingMode === 'lcu-sync'
  }

  // Cleanup method
  destroy() {
    this.stopSync()
    if (globalLcuDraftsListener) {
      globalLcuDraftsListener()
      globalLcuDraftsListener = null
    }
    this.isInitialized = false
  }
}

// Export the class
export { LcuSyncService }
export default LcuSyncService

// Note: Singleton instance is created in main.js after Pinia initialization
// Components should access it via global reference or through a different pattern
