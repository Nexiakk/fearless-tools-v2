import { useDraftStore } from '@/stores/draft'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftingStore } from '@/stores/drafting'
import { fetchLcuDraftsFromFirestore, setupLcuDraftsRealtimeSync } from './firebase/firestore'

let seriesStore = null

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
      if (draftingMode === 'fearless-sync') {
        await this.startSync()
      } else {
        this.stopSync()
      }
    })

    this.isInitialized = true

    // Initial sync if conditions are met
    if (this.workspaceStore.hasWorkspace &&
        !this.workspaceStore.isLocalWorkspace &&
        this.draftingStore.draftingMode === 'fearless-sync') {
      await this.startSync()
    }
  }

  async startSync() {
    if (!this.workspaceStore.hasWorkspace || this.workspaceStore.isLocalWorkspace) return
    if (this.draftingStore.draftingMode !== 'fearless-sync') return

    try {
      console.log('[LCU Sync] Starting Fearless Sync mode')

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
    console.log('[LCU Sync] Stopped Fearless Sync mode')
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

    // Populate blue side
    if (latestDraft.blueSide) {
      // Bans (first 5 positions) - skip empty bans but maintain positions
      if (latestDraft.blueSide.bans) {
        let actualBanIndex = 0
        latestDraft.blueSide.bans.forEach((banId) => {
          if (actualBanIndex < 5 && banId !== 'None') {
            const championName = championIdToName(banId)
            if (championName) {
              this.draftStore.updateCurrentDraftSlot('blue', 'bans', actualBanIndex, championName)
              actualBanIndex++
            }
          } else if (banId === 'None') {
            // Empty ban - just increment the index to skip this slot
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
              this.draftStore.updateCurrentDraftSlot('blue', 'picks', index, championName)
            }
          }
        })
      }
    }

    // Populate red side
    if (latestDraft.redSide) {
      // Bans (first 5 positions) - skip empty bans but maintain positions
      if (latestDraft.redSide.bans) {
        let actualBanIndex = 0
        latestDraft.redSide.bans.forEach((banId) => {
          if (actualBanIndex < 5 && banId !== 'None') {
            const championName = championIdToName(banId)
            if (championName) {
              this.draftStore.updateCurrentDraftSlot('red', 'bans', actualBanIndex, championName)
              actualBanIndex++
            }
          } else if (banId === 'None') {
            // Empty ban - just increment the index to skip this slot
            actualBanIndex++
          }
        })
      }

      // Picks (positions 5-9, but mapped to 0-4 in our system)
      if (latestDraft.redSide.picks) {
        latestDraft.redSide.picks.forEach((pickId, index) => {
          if (index < 5) {
            const championName = championIdToName(pickId)
            if (championName) {
              this.draftStore.updateCurrentDraftSlot('red', 'picks', index, championName)
            }
          }
        })
      }
    }
  }

  async checkForGameSwitch(lcuDrafts) {
    if (!lcuDrafts || lcuDrafts.length === 0) return false

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

    if (!latestDraft) return false

    // Check if latest draft has any bans or picks (indicating active game data)
    const blueBans = latestDraft.blueSide?.bans || []
    const redBans = latestDraft.redSide?.bans || []
    const bluePicks = latestDraft.blueSide?.picks || []
    const redPicks = latestDraft.redSide?.picks || []

    const hasBans = blueBans.some(id => id && id !== 'None') || redBans.some(id => id && id !== 'None')
    const hasPicks = bluePicks.some(id => id && id !== 'None') || redPicks.some(id => id && id !== 'None')

    if (!hasBans && !hasPicks) return false // No active game data

    // Check if current game has completed drafts
    const seriesStore = useDraftStore().$pinia._s.get('series')
    const currentGame = seriesStore.currentGame

    if (!currentGame || !currentGame.drafts) return false

    // Check if any draft in current game is complete (10 bans + 10 picks)
    const hasCompletedDraft = currentGame.drafts.some(draft => {
      const draftBlueBans = draft.blueBans || []
      const draftRedBans = draft.redBans || []
      const draftBluePicks = draft.bluePicks || []
      const draftRedPicks = draft.redPicks || []

      const draftTotalBans = draftBlueBans.filter(slot => slot?.champion).length +
                             draftRedBans.filter(slot => slot?.champion).length
      const draftTotalPicks = draftBluePicks.filter(slot => slot?.champion).length +
                              draftRedPicks.filter(slot => slot?.champion).length

      return draftTotalBans >= 10 && draftTotalPicks >= 10
    })

    if (!hasCompletedDraft) return false // Current game not complete yet

    // Current game is complete and we have new game data - switch to next game
    const nextGameNumber = currentGame.gameNumber + 1
    if (nextGameNumber <= 5) {
      console.log(`[LCU Sync] Switching to Game ${nextGameNumber} - current game completed and new data detected`)
      seriesStore.setCurrentGame(nextGameNumber)
      return true
    }

    return false
  }

  async handleRealtimeUpdate(updatedDrafts) {
    console.log('[LCU Sync] Real-time update received')
    await this.checkForGameSwitch(updatedDrafts)
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
      console.log('[LCU Sync] All picks completed! Banned champions will be cleared from pool')
      // Note: Ban clearing is now handled automatically by extractLcuBannedChampions() in draft store
      // when it detects 10+ picks in the latest draft
    }
  }



  triggerBanCleanup(completedDraft) {
    // Extract all banned champion IDs from the completed draft
    const bannedIds = new Set()

    if (completedDraft.blueSide?.bans) {
      completedDraft.blueSide.bans.forEach(id => {
        if (id && id !== 'None') bannedIds.add(id)
      })
    }

    if (completedDraft.redSide?.bans) {
      completedDraft.redSide.bans.forEach(id => {
        if (id && id !== 'None') bannedIds.add(id)
      })
    }

    // Convert IDs to champion names
    const championsStore = useDraftStore().$pinia._s.get('champions')
    const bannedChampionNames = Array.from(bannedIds).map(id => {
      const idNum = parseInt(id, 10)
      const champion = championsStore.allChampions.find(c => c.id === idNum)
      return champion ? champion.name : null
    }).filter(name => name !== null)

    if (bannedChampionNames.length > 0) {
      console.log('[LCU Sync] Adding banned champions to pool:', bannedChampionNames)
      // Add to draft store's banned champions (this will hide them from the pool)
      bannedChampionNames.forEach(name => {
        if (!this.draftStore.bannedChampions.has(name)) {
          this.draftStore.bannedChampions.add(name)
        }
      })

      // Save the updated banned champions
      this.draftStore.queueSave()
    }
  }

  // Utility method to check if we're in sync mode
  isInSyncMode() {
    return this.draftingStore.draftingMode === 'fearless-sync'
  }

  // Cleanup method
  destroy() {
    this.stopSync()
    this.isInitialized = false
  }
}

// Export the class
export { LcuSyncService }
export default LcuSyncService

// Note: Singleton instance is created in main.js after Pinia initialization
// Components should access it via global reference or through a different pattern
