import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDraftDataFromFirestore, saveDraftDataToFirestore, fetchLcuDraftsFromFirestore, setupLcuDraftsRealtimeSync, deleteAllLcuDrafts } from '@/services/firebase/firestore'
import { workspaceService } from '@/services/workspace'
import { ChampionBalancer } from '@/services/championBalancer'
import { useWorkspaceStore } from './workspace'
import { useChampionsStore } from './champions'
import { useSettingsStore } from './settings'
import { useWorkspaceTiersStore } from './workspaceTiers'

export const useDraftStore = defineStore('draft', () => {
  // State
  const draftSeries = ref([])
  const unavailablePanelState = ref({
    top: Array(10).fill(null),
    jungle: Array(10).fill(null),
    middle: Array(10).fill(null),
    bottom: Array(10).fill(null),
    support: Array(10).fill(null)
  })
  const pickContext = ref([])
  const bannedChampions = ref(new Set()) // Manually banned champions
  const lcuUnavailableChampions = ref(new Set()) // Champions from LCU drafts (non-toggleable)
  const lcuBannedChampions = ref(new Set()) // Banned champions from LCU drafts - latest game only (non-toggleable)
  let saveTimeout = null
  let isSaving = ref(false)
  const isLoading = ref(false)
  let lcuDraftsUnsubscribe = null
  
  // Getters
  const unavailableChampions = computed(() => {
    const championsStore = useChampionsStore()

    // Combine manually selected and LCU unavailable champions
    const combined = new Set(draftSeries.value) // draftSeries contains display names

    // Convert LCU unavailable champions (internal IDs) to display names
    lcuUnavailableChampions.value.forEach(internalId => {
      const champion = championsStore.allChampions.find(c => c.id === internalId)
      if (champion) {
        combined.add(champion.name)
      }
    })

    return combined
  })
  
  const championsByRoleForCompactView = computed(() => {
    const championsStore = useChampionsStore()
    const settingsStore = useSettingsStore()
    const frozenChampions = settingsStore.settings.pool.frozenChampions
    
    if (frozenChampions) {
      const grouped = {
        top: { sticky: [], scrollable: [] },
        jungle: { sticky: [], scrollable: [] },
        middle: { sticky: [], scrollable: [] },
        bottom: { sticky: [], scrollable: [] },
        support: { sticky: [], scrollable: [] }
      }
      
      championsStore.allChampions.forEach(champ => {
        if (Array.isArray(champ.roles)) {
          champ.roles.forEach(role => {
            if (grouped[role]) {
              const isBanned = isBannedChampion(champ.name)
              const isUnavailable = unavailableChampions.value.has(champ.name)
              const isOp = championsStore.isOpForRole(champ.name, role)
              // Don't count highlight if champion is banned or unavailable (they're in same section)
              const isHighlighted = !isBanned && !isUnavailable && isHighlightedForRole(champ.name, role)

              // Check if champion has a tier assigned for this role
              const workspaceTiersStore = useWorkspaceTiersStore()
              const hasTier = workspaceTiersStore.getTierForChampion(champ.name, role) !== null

              if (isBanned || isUnavailable || isOp || isHighlighted || hasTier) {
                grouped[role].sticky.push(champ)
              } else {
                grouped[role].scrollable.push(champ)
              }
            }
          })
        }
      })
      
      // Sort sticky champions by priority
      Object.keys(grouped).forEach(role => {
        grouped[role].sticky.sort((a, b) => {
          const priorityA = getChampionPriority(a, role, championsStore)
          const priorityB = getChampionPriority(b, role, championsStore)
          if (priorityA !== priorityB) return priorityB - priorityA
          return (a.name || '').localeCompare(b.name || '')
        })
        grouped[role].scrollable.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      })
      
      return grouped
    } else {
      const grouped = { top: [], jungle: [], middle: [], bottom: [], support: [] }

      championsStore.allChampions.forEach(champ => {
        if (Array.isArray(champ.roles)) {
          champ.roles.forEach(role => {
            if (grouped[role]) {
              grouped[role].push(champ)
            }
          })
        }
      })

      // Sort by priority
      Object.keys(grouped).forEach(role => {
        grouped[role].sort((a, b) => {
          const priorityA = getChampionPriority(a, role, championsStore)
          const priorityB = getChampionPriority(b, role, championsStore)
          if (priorityA !== priorityB) return priorityB - priorityA
          return (a.name || '').localeCompare(b.name || '')
        })
      })

      return grouped
    }
  })
  
  // Helper function
  function isHighlightedForRole(championName, role) {
    // Highlighting functionality removed - always return false
    return false
  }

  // Helper function to get champion priority for sorting
  function getChampionPriority(champion, role, championsStore) {
    // Banned and unavailable have same priority (4)
    if (isBannedChampion(champion.name) || unavailableChampions.value.has(champion.name)) return 4
    // Check for tier assignment (3)
    const workspaceTiersStore = useWorkspaceTiersStore()
    const tier = workspaceTiersStore.getTierForChampion(champion.name, role)
    if (tier) return 3 - (tier.order * 0.1) // Higher tiers get higher priority
    if (championsStore.isOpForRole(champion.name, role)) return 2
    if (isHighlightedForRole(champion.name, role)) return 1
    return 0
  }
  
  // Helper function to validate champion names exist in the champion store
  function validateChampionNames(championNames, championsStore) {
    const validNames = new Set()
    championNames.forEach(name => {
      // Champion names are stored as strings in LCU drafts (already converted from IDs by Python client)
      if (name && name !== '0' && typeof name === 'string') {
        // Validate that this champion exists in our store - use internal Riot ID (c.id) since LCU client sends internal names
        const champion = championsStore.allChampions.find(c => c.id === name)
        if (champion) {
          validNames.add(name)
        }
      }
    })
    return validNames
  }
  
  // Extract picked champions from LCU drafts (already as names)
  function extractLcuUnavailableChampions(lcuDrafts, championsStore) {
    const pickedChampionNames = new Set()

    lcuDrafts.forEach(draft => {
      // Extract picks from both sides (already champion names from Python client)
      const bluePicks = draft.blueSide?.picks || []
      const redPicks = draft.redSide?.picks || []

      bluePicks.forEach(name => {
        if (name && name !== '0' && typeof name === 'string') {
          pickedChampionNames.add(name)
        }
      })

      redPicks.forEach(name => {
        if (name && name !== '0' && typeof name === 'string') {
          pickedChampionNames.add(name)
        }
      })
    })

    return validateChampionNames(pickedChampionNames, championsStore)
  }
  
  // Extract banned champions from the latest LCU draft only
  // Latest draft is determined by highest number in '{sessionId}_{number}' format
  function extractLcuBannedChampions(lcuDrafts, championsStore) {
    if (!lcuDrafts || lcuDrafts.length === 0) {
      return new Set()
    }

    // Find the latest draft by parsing the ID format '{sessionId}_{number}'
    // and finding the one with the highest number
    let latestDraft = null
    let maxNumber = -1

    lcuDrafts.forEach(draft => {
      if (draft.id) {
        // Extract number from format '{sessionId}_{number}'
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

    // If no draft found with the expected format, use the first one (most recent by updatedAt)
    if (!latestDraft && lcuDrafts.length > 0) {
      latestDraft = lcuDrafts[0]
    }

    if (!latestDraft) {
      return new Set()
    }

    // Check if all picks are done (10 picks total) - if so, don't show bans in pool
    const bluePicks = latestDraft.blueSide?.picks || []
    const redPicks = latestDraft.redSide?.picks || []
    const totalPicks = bluePicks.filter(id => id && id !== '0').length +
                       redPicks.filter(id => id && id !== '0').length

    if (totalPicks >= 10) {
      // All picks are done - clear bans from pool view
      return new Set()
    }

    // Extract bans from the latest draft only (already champion names from Python client)
    const bannedChampionNames = new Set()
    const blueBans = latestDraft.blueSide?.bans || []
    const redBans = latestDraft.redSide?.bans || []

    blueBans.forEach(name => {
      if (name && name !== '0' && typeof name === 'string') {
        bannedChampionNames.add(name)
      }
    })

    redBans.forEach(name => {
      if (name && name !== '0' && typeof name === 'string') {
        bannedChampionNames.add(name)
      }
    })

    return validateChampionNames(bannedChampionNames, championsStore)
  }
  
  // Update LCU unavailable champions from drafts
  function updateLcuUnavailableChampions(lcuDrafts, championsStore) {
    lcuUnavailableChampions.value = extractLcuUnavailableChampions(lcuDrafts, championsStore)
    // Also update LCU banned champions (only from latest draft)
    lcuBannedChampions.value = extractLcuBannedChampions(lcuDrafts, championsStore)
  }
  
  // Debug function to print LCU draft champions with their names and sides
  async function debugPrintLcuDrafts() {
    const workspaceStore = useWorkspaceStore()
    const championsStore = useChampionsStore()

    if (!workspaceStore.currentWorkspaceId) {
      console.warn('❌ No workspace selected')
      return
    }

    console.log('🔍 Fetching LCU drafts...')
    const lcuDrafts = await fetchLcuDraftsFromFirestore(workspaceStore.currentWorkspaceId)

    if (lcuDrafts.length === 0) {
      console.log('ℹ️ No LCU drafts found')
      return
    }

    console.log(`\n📊 Found ${lcuDrafts.length} LCU draft(s):\n`)

    lcuDrafts.forEach((draft, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Draft #${index + 1} (Lobby: ${draft.lobbyId || 'N/A'}, Phase: ${draft.phase})`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

      // Helper to validate champion name exists
      const validateName = (name) => {
        if (!name || name === '0') return 'Unknown'
        const champion = championsStore.allChampions.find(c => c.name === name)
        return champion ? name : `${name} (not found)`
      }

      // Blue side picks
      const bluePicks = draft.blueSide?.picks || []
      if (bluePicks.length > 0) {
        console.log('\n🔵 BLUE SIDE PICKS:')
        bluePicks.forEach((name, idx) => {
          const validatedName = validateName(name)
          console.log(`  ${idx + 1}. ${validatedName}`)
        })
      }

      // Blue side bans
      const blueBans = draft.blueSide?.bans || []
      if (blueBans.length > 0) {
        console.log('\n🚫 BLUE SIDE BANS:')
        blueBans.forEach((name, idx) => {
          const validatedName = validateName(name)
          console.log(`  ${idx + 1}. ${validatedName}`)
        })
      }

      // Red side picks
      const redPicks = draft.redSide?.picks || []
      if (redPicks.length > 0) {
        console.log('\n🔴 RED SIDE PICKS:')
        redPicks.forEach((name, idx) => {
          const validatedName = validateName(name)
          console.log(`  ${idx + 1}. ${validatedName}`)
        })
      }

      // Red side bans
      const redBans = draft.redSide?.bans || []
      if (redBans.length > 0) {
        console.log('\n🚫 RED SIDE BANS:')
        redBans.forEach((name, idx) => {
          const validatedName = validateName(name)
          console.log(`  ${idx + 1}. ${validatedName}`)
        })
      }

      // Summary of unavailable champions (picks only)
      const allPickedNames = new Set([...bluePicks, ...redPicks])
      const unavailableNames = []
      allPickedNames.forEach(name => {
        if (name && name !== '0') {
          const validatedName = validateName(name)
          if (validatedName && !validatedName.includes('not found')) {
            unavailableNames.push(validatedName)
          }
        }
      })

      console.log('\n📋 SUMMARY - Unavailable Champions (from picks):')
      if (unavailableNames.length > 0) {
        unavailableNames.forEach((name, idx) => {
          console.log(`  ${idx + 1}. ${name}`)
        })
      } else {
        console.log('  (none)')
      }

      console.log('') // Empty line between drafts
    })

    // Final summary
    const allUnavailable = new Set()
    lcuDrafts.forEach(draft => {
      const bluePicks = draft.blueSide?.picks || []
      const redPicks = draft.redSide?.picks || []
      ;[...bluePicks, ...redPicks].forEach(name => {
        if (name && name !== '0' && typeof name === 'string') {
          const champion = championsStore.allChampions.find(c => c.id === name)
          if (champion) {
            allUnavailable.add(name)
          }
        }
      })
    })

    console.log(`\n✨ TOTAL UNIQUE UNAVAILABLE CHAMPIONS: ${allUnavailable.size}`)
    console.log('   ' + Array.from(allUnavailable).sort().join(', '))
    console.log('\n')
  }
  
  // Actions
  function isUnavailable(championName) {
    return unavailableChampions.value.has(championName)
  }
  
  function isLcuUnavailable(championName) {
    // Check if this display name corresponds to an unavailable internal ID
    const championsStore = useChampionsStore()
    const champion = championsStore.allChampions.find(c => c.name === championName)
    return champion && lcuUnavailableChampions.value.has(champion.id)
  }
  
  function isBannedChampion(championName) {
    // Check manually banned champions (stored as display names)
    if (bannedChampions.value.has(championName)) {
      return true
    }

    // Check LCU banned champions (stored as internal names)
    // Find the champion by display name and check if its internal ID is banned
    const championsStore = useChampionsStore()
    const champion = championsStore.allChampions.find(c => c.name === championName)
    if (champion && lcuBannedChampions.value.has(champion.id)) {
      return true
    }

    return false
  }
  
  function isLcuBanned(championName) {
    // Check if this display name corresponds to a banned internal ID
    const championsStore = useChampionsStore()
    const champion = championsStore.allChampions.find(c => c.name === championName)
    return champion && lcuBannedChampions.value.has(champion.id)
  }
  
  function toggleBan(championName) {
    // Prevent toggling LCU banned champions (they can't be reversed)
    if (isLcuBanned(championName)) {
      return
    }
    
    if (bannedChampions.value.has(championName)) {
      bannedChampions.value.delete(championName)
    } else {
      bannedChampions.value.add(championName)
    }
    
    queueSave()
  }
  

  
  function togglePick(championName, pickedFromRole = null) {
    // Prevent toggling LCU unavailable champions or banned champions (they can't be reversed)
    if (isLcuUnavailable(championName) || isBannedChampion(championName)) {
      return
    }
    
    const championsStore = useChampionsStore()
    const champion = championsStore.allChampions.find(c => c.name === championName)
    if (!champion) return
    
    const index = draftSeries.value.indexOf(championName)
    
    if (index === -1) {
      // Adding champion
      draftSeries.value.push(championName)
      
      // Track pick context
      const pickOrder = draftSeries.value.length
      const contextRole = pickedFromRole || champion.mainRole || champion.roles?.[0]
      
      pickContext.value.push({
        championName,
        role: contextRole,
        pickOrder
      })
      
      placeChampionInPanel(champion, contextRole)
      
      // Check milestone (every 10 champions)
      if (draftSeries.value.length % 10 === 0) {
        balanceChampionsAcrossRoles()
        // TODO: Trigger milestone modal
      }
    } else {
      // Removing champion
      draftSeries.value.splice(index, 1)
      pickContext.value = pickContext.value.filter(ctx => ctx.championName !== championName)
      removeChampionFromPanel(championName)
    }
    
    queueSave()
  }
  
  function placeChampionInPanel(champion, preferredRole = null) {
    const placementOrder = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9]
    const validRoles = new Set(['top', 'jungle', 'middle', 'bottom', 'support'])
    
    // Try preferred role first
    if (preferredRole && validRoles.has(preferredRole) && unavailablePanelState.value[preferredRole]) {
      for (const i of placementOrder) {
        if (unavailablePanelState.value[preferredRole][i] === null) {
          unavailablePanelState.value[preferredRole][i] = champion.name
          return
        }
      }
    }
    
    // Try champion's roles
    const championRoles = [champion.mainRole, ...(champion.roles || []).filter(r => r !== champion.mainRole)]
    const validChampionRoles = championRoles.filter(role => validRoles.has(role))
    
    for (const role of validChampionRoles) {
      if (unavailablePanelState.value[role]) {
        for (const i of placementOrder) {
          if (unavailablePanelState.value[role][i] === null) {
            unavailablePanelState.value[role][i] = champion.name
            return
          }
        }
      }
    }
  }
  
  function removeChampionFromPanel(championName) {
    for (const role in unavailablePanelState.value) {
      const index = unavailablePanelState.value[role].indexOf(championName)
      if (index !== -1) {
        unavailablePanelState.value[role][index] = null
        return
      }
    }
  }

  
  async function resetUnavailable() {
    draftSeries.value = []
    pickContext.value = []
    bannedChampions.value = new Set() // Reset manually banned champions
    unavailablePanelState.value = {
      top: Array(10).fill(null),
      jungle: Array(10).fill(null),
      middle: Array(10).fill(null),
      bottom: Array(10).fill(null),
      support: Array(10).fill(null)
    }

    // Also delete all lcuDrafts from Firestore
    const workspaceStore = useWorkspaceStore()
    if (workspaceStore.currentWorkspaceId && !workspaceStore.isLocalWorkspace) {
      try {
        await deleteAllLcuDrafts(workspaceStore.currentWorkspaceId)
        // Clear LCU unavailable and banned champions after deleting drafts
        lcuUnavailableChampions.value = new Set()
        lcuBannedChampions.value = new Set()
      } catch (error) {
        console.error('Error deleting LCU drafts:', error)
        // Continue with reset even if deletion fails
      }
    } else {
      // For local workspaces, just clear the state
      lcuUnavailableChampions.value = new Set()
      lcuBannedChampions.value = new Set()
    }

    queueSave()
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
            draftSeries: draftSeries.value,
            unavailablePanelState: unavailablePanelState.value,
            pickContext: pickContext.value,
            bannedChampions: Array.from(bannedChampions.value)
          })
          console.log('Saved local workspace data to localStorage')
          workspaceStore.setSyncing(false)
          isSaving.value = false
        } else {
          // Save to Firestore
          await saveDraftDataToFirestore(workspaceStore.currentWorkspaceId, {
            draftSeries: draftSeries.value,
            unavailablePanelState: unavailablePanelState.value,
            pickContext: pickContext.value,
            bannedChampions: Array.from(bannedChampions.value)
          })
          workspaceStore.setSyncing(false)
          isSaving.value = false
        }
      } catch (error) {
        console.error('Error saving draft data:', error)
        workspaceStore.setSyncing(false)
        isSaving.value = false
        workspaceStore.networkError = error.message
      } finally {
        saveTimeout = null
      }
    }, 3000)
  }
  
  async function loadWorkspaceData(workspaceId) {
    isLoading.value = true
    try {
      const data = await fetchDraftDataFromFirestore(workspaceId)
      if (data) {
        draftSeries.value = data.draftSeries || []
        unavailablePanelState.value = data.unavailablePanelState || {
          top: Array(10).fill(null),
          jungle: Array(10).fill(null),
          middle: Array(10).fill(null),
          bottom: Array(10).fill(null),
          support: Array(10).fill(null)
        }
        pickContext.value = data.pickContext || []
        bannedChampions.value = new Set(data.bannedChampions || [])

        // Reconstruct pickContext if missing (migration)
        if (pickContext.value.length === 0 && draftSeries.value.length > 0) {
          reconstructPickContext()
        }
      }
      
      // Load LCU drafts and update unavailable champions
      await loadLcuDrafts(workspaceId)
    } catch (error) {
      console.error('Error loading workspace data:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  async function loadLcuDrafts(workspaceId) {
    try {
      const championsStore = useChampionsStore()
      
      // Fetch initial LCU drafts
      const lcuDrafts = await fetchLcuDraftsFromFirestore(workspaceId)
      updateLcuUnavailableChampions(lcuDrafts, championsStore)
      
      // Set up real-time sync for LCU drafts
      if (lcuDraftsUnsubscribe) {
        lcuDraftsUnsubscribe()
      }
      
      lcuDraftsUnsubscribe = setupLcuDraftsRealtimeSync(workspaceId, (updatedDrafts) => {
        updateLcuUnavailableChampions(updatedDrafts, championsStore)
      })
    } catch (error) {
      console.error('Error loading LCU drafts:', error)
    }
  }
  
  function loadDraftData(data) {
    isLoading.value = true
    try {
      draftSeries.value = data.draftSeries || []
      unavailablePanelState.value = data.unavailablePanelState || {
        top: Array(10).fill(null),
        jungle: Array(10).fill(null),
        middle: Array(10).fill(null),
        bottom: Array(10).fill(null),
        support: Array(10).fill(null)
      }
      pickContext.value = data.pickContext || []
      bannedChampions.value = new Set(data.bannedChampions || [])

      // Reconstruct pickContext if missing
      if (pickContext.value.length === 0 && draftSeries.value.length > 0) {
        reconstructPickContext()
      }
    } finally {
      isLoading.value = false
    }
  }
  
  function reconstructPickContext() {
    const championsStore = useChampionsStore()
    pickContext.value = []
    
    draftSeries.value.forEach((championName, index) => {
      const champion = championsStore.allChampions.find(c => c.name === championName)
      if (!champion) return
      
      // Try to find which role the champion is currently placed in
      let foundRole = null
      for (const role of ['top', 'jungle', 'middle', 'bottom', 'support']) {
        if (unavailablePanelState.value[role] && unavailablePanelState.value[role].includes(championName)) {
          foundRole = role
          break
        }
      }

      // If not found in panel, use mainRole or first role
      if (!foundRole) {
        foundRole = champion.mainRole && ['top', 'jungle', 'middle', 'bottom', 'support'].includes(champion.mainRole)
          ? champion.mainRole
          : (champion.roles && champion.roles.length > 0 && ['top', 'jungle', 'middle', 'bottom', 'support'].includes(champion.roles[0])
            ? champion.roles[0]
            : null)
      }
      
      pickContext.value.push({
        championName,
        role: foundRole,
        pickOrder: index + 1
      })
    })
  }
  
  function balanceChampionsAcrossRoles() {
    const championsStore = useChampionsStore()
    const balancer = new ChampionBalancer(championsStore)
    balancer.balanceChampions(draftSeries.value, unavailablePanelState.value, queueSave)
  }
  
  return {
    // State
    draftSeries,
    unavailablePanelState,
    pickContext,
    bannedChampions,
    lcuUnavailableChampions,
    lcuBannedChampions,
    isSaving,
    isLoading,
    // Getters
    unavailableChampions,
    championsByRoleForCompactView,
    // Actions
    togglePick,
    toggleBan,
    isUnavailable,
    isLcuUnavailable,
    isBannedChampion,
    isLcuBanned,
    resetUnavailable,
    loadWorkspaceData,
    loadDraftData,
    loadLcuDrafts,
    balanceChampionsAcrossRoles,
    reconstructPickContext,
    // Internal state for save timeout checking
    get _saveTimeout() {
      return saveTimeout
    },
    get _isSaving() {
      return isSaving.value
    },
    // Expose queueSave for external use
    queueSave,
    // Debug function
    debugPrintLcuDrafts
  }
})
