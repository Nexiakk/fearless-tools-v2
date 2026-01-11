import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDraftDataFromFirestore, saveDraftDataToFirestore, fetchLcuDraftsFromFirestore, setupLcuDraftsRealtimeSync, deleteAllLcuDrafts } from '@/services/firebase/firestore'
import { workspaceService } from '@/services/workspace'
import { useWorkspaceStore } from './workspace'
import { useChampionsStore } from './champions'
import { useSettingsStore } from './settings'

export const useDraftStore = defineStore('draft', () => {
  // State
  const draftSeries = ref([])
  const highlightedChampions = ref({})
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
    // Combine manually selected and LCU unavailable champions
    const combined = new Set(draftSeries.value)
    lcuUnavailableChampions.value.forEach(champ => combined.add(champ))
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
              
              if (isBanned || isUnavailable || isOp || isHighlighted) {
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
          const getPriority = (champ) => {
            // Banned and unavailable have same priority (3)
            if (isBannedChampion(champ.name) || unavailableChampions.value.has(champ.name)) return 3
            if (championsStore.isOpForRole(champ.name, role)) return 2
            if (isHighlightedForRole(champ.name, role)) return 1
            return 0
          }
          const priorityA = getPriority(a)
          const priorityB = getPriority(b)
          if (priorityA !== priorityB) return priorityB - priorityA
          return a.name.localeCompare(b.name)
        })
        grouped[role].scrollable.sort((a, b) => a.name.localeCompare(b.name))
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
          const getPriority = (champ) => {
            // Banned and unavailable have same priority (3)
            if (isBannedChampion(champ.name) || unavailableChampions.value.has(champ.name)) return 3
            if (championsStore.isOpForRole(champ.name, role)) return 2
            if (isHighlightedForRole(champ.name, role)) return 1
            return 0
          }
          const priorityA = getPriority(a)
          const priorityB = getPriority(b)
          if (priorityA !== priorityB) return priorityB - priorityA
          return a.name.localeCompare(b.name)
        })
      })

      return grouped
    }
  })
  
  // Helper function
  function isHighlightedForRole(championName, role) {
    return isHighlighted(championName, role)
  }
  
  // Helper function to convert champion IDs to names
  function convertChampionIdsToNames(championIds, championsStore) {
    const names = new Set()
    championIds.forEach(id => {
      // Champion IDs are stored as strings in LCU drafts
      const idNum = parseInt(id, 10)
      const champion = championsStore.allChampions.find(c => c.id === idNum)
      if (champion && champion.name) {
        names.add(champion.name)
      }
    })
    return names
  }
  
  // Extract picked champions from LCU drafts and convert to names
  function extractLcuUnavailableChampions(lcuDrafts, championsStore) {
    const pickedChampionIds = new Set()
    
    lcuDrafts.forEach(draft => {
      // Extract picks from both sides
      const bluePicks = draft.blueSide?.picks || []
      const redPicks = draft.redSide?.picks || []
      
      bluePicks.forEach(id => {
        if (id && id !== '0') {
          pickedChampionIds.add(String(id))
        }
      })
      
      redPicks.forEach(id => {
        if (id && id !== '0') {
          pickedChampionIds.add(String(id))
        }
      })
    })
    
    return convertChampionIdsToNames(pickedChampionIds, championsStore)
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
    
    // Extract bans from the latest draft only
    const bannedChampionIds = new Set()
    const blueBans = latestDraft.blueSide?.bans || []
    const redBans = latestDraft.redSide?.bans || []
    
    blueBans.forEach(id => {
      if (id && id !== '0') {
        bannedChampionIds.add(String(id))
      }
    })
    
    redBans.forEach(id => {
      if (id && id !== '0') {
        bannedChampionIds.add(String(id))
      }
    })
    
    return convertChampionIdsToNames(bannedChampionIds, championsStore)
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
      
      // Helper to convert ID to name
      const getIdToName = (id) => {
        if (!id || id === '0') return 'Unknown'
        const idNum = parseInt(id, 10)
        const champion = championsStore.allChampions.find(c => c.id === idNum)
        return champion ? champion.name : `ID:${id} (not found)`
      }
      
      // Blue side picks
      const bluePicks = draft.blueSide?.picks || []
      if (bluePicks.length > 0) {
        console.log('\n🔵 BLUE SIDE PICKS:')
        bluePicks.forEach((id, idx) => {
          const name = getIdToName(id)
          console.log(`  ${idx + 1}. ${name} (ID: ${id})`)
        })
      }
      
      // Blue side bans
      const blueBans = draft.blueSide?.bans || []
      if (blueBans.length > 0) {
        console.log('\n🚫 BLUE SIDE BANS:')
        blueBans.forEach((id, idx) => {
          const name = getIdToName(id)
          console.log(`  ${idx + 1}. ${name} (ID: ${id})`)
        })
      }
      
      // Red side picks
      const redPicks = draft.redSide?.picks || []
      if (redPicks.length > 0) {
        console.log('\n🔴 RED SIDE PICKS:')
        redPicks.forEach((id, idx) => {
          const name = getIdToName(id)
          console.log(`  ${idx + 1}. ${name} (ID: ${id})`)
        })
      }
      
      // Red side bans
      const redBans = draft.redSide?.bans || []
      if (redBans.length > 0) {
        console.log('\n🚫 RED SIDE BANS:')
        redBans.forEach((id, idx) => {
          const name = getIdToName(id)
          console.log(`  ${idx + 1}. ${name} (ID: ${id})`)
        })
      }
      
      // Summary of unavailable champions (picks only)
      const allPickedIds = new Set([...bluePicks, ...redPicks])
      const unavailableNames = []
      allPickedIds.forEach(id => {
        if (id && id !== '0') {
          const name = getIdToName(id)
          if (name && !name.startsWith('ID:')) {
            unavailableNames.push(name)
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
      ;[...bluePicks, ...redPicks].forEach(id => {
        if (id && id !== '0') {
          const idNum = parseInt(id, 10)
          const champion = championsStore.allChampions.find(c => c.id === idNum)
          if (champion && champion.name) {
            allUnavailable.add(champion.name)
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
    return lcuUnavailableChampions.value.has(championName)
  }
  
  function isBannedChampion(championName) {
    // Check both manually banned and LCU banned champions
    return bannedChampions.value.has(championName) || lcuBannedChampions.value.has(championName)
  }
  
  function isLcuBanned(championName) {
    return lcuBannedChampions.value.has(championName)
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
  
  function isHighlighted(championName, role = null) {
    if (!championName || !highlightedChampions.value[championName]) return false
    const roles = highlightedChampions.value[championName]
    return role ? roles.includes(role) : true
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
  
  function toggleHighlight(championName, role = null) {
    // Don't allow highlighting banned or unavailable champions (they're in same section)
    if (!championName || isUnavailable(championName) || isBannedChampion(championName)) return
    
    if (role) {
      const currentHighlights = highlightedChampions.value[championName] || []
      const roleIndex = currentHighlights.indexOf(role)
      
      if (roleIndex === -1) {
        highlightedChampions.value[championName] = [...currentHighlights, role]
      } else {
        const updated = [...currentHighlights]
        updated.splice(roleIndex, 1)
        if (updated.length > 0) {
          highlightedChampions.value[championName] = updated
        } else {
          delete highlightedChampions.value[championName]
        }
      }
    } else {
      // Toggle all roles
      if (highlightedChampions.value[championName]) {
        delete highlightedChampions.value[championName]
      } else {
        const championsStore = useChampionsStore()
        const champ = championsStore.allChampions.find(c => c.name === championName)
        highlightedChampions.value[championName] = champ?.mainRole ? [champ.mainRole] : []
      }
    }
    
    queueSave()
  }
  
  function resetHighlighted() {
    highlightedChampions.value = {}
    queueSave()
  }
  
  async function resetUnavailable() {
    draftSeries.value = []
    pickContext.value = []
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
            highlightedChampions: highlightedChampions.value,
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
            highlightedChampions: highlightedChampions.value,
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
        highlightedChampions.value = data.highlightedChampions || {}
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
      highlightedChampions.value = data.highlightedChampions || {}
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
    const roles = ['top', 'jungle', 'middle', 'bottom', 'support']
    
    // Clear all current placements
    roles.forEach(role => {
      unavailablePanelState.value[role] = Array(10).fill(null)
    })
    
    const bannedChamps = draftSeries.value
    if (bannedChamps.length === 0) {
      queueSave()
      return
    }
    
    console.log('Balancing champions:', bannedChamps.length, 'champions')
    
    // Get champion metadata
    const champData = {}
    bannedChamps.forEach(champName => {
      const champion = championsStore.allChampions.find(c => c.name === champName)
      if (champion) {
        const possibleRoles = new Set()
        if (champion.mainRole && roles.includes(champion.mainRole)) {
          possibleRoles.add(champion.mainRole)
        }
        if (champion.roles && Array.isArray(champion.roles)) {
          champion.roles.forEach(r => {
            if (r && roles.includes(r)) {
              possibleRoles.add(r)
            }
          })
        }
        champData[champName] = {
          mainRole: champion.mainRole && roles.includes(champion.mainRole) ? champion.mainRole : null,
          possibleRoles: Array.from(possibleRoles)
        }
      } else {
        // Champion not found in store - use all roles as fallback
        champData[champName] = {
          mainRole: null,
          possibleRoles: [...roles]
        }
      }
    })
    
    // === INFERENCE STEP ===
    // Define forward and reverse sequences
    const forwardSequence = roles
    const reverseSequence = [...roles].reverse()
    
    // Count matches for each sequence
    let forwardMatches = 0
    let reverseMatches = 0
    
    bannedChamps.forEach((champName, index) => {
      const champ = champData[champName]
      if (!champ) return
      
      const forwardRole = forwardSequence[index % forwardSequence.length]
      const reverseRole = reverseSequence[index % reverseSequence.length]
      
      if (champ.possibleRoles.includes(forwardRole)) {
        forwardMatches++
      }
      if (champ.possibleRoles.includes(reverseRole)) {
        reverseMatches++
      }
    })
    
    // Choose the sequence with more matches
    const probableSequence = forwardMatches >= reverseMatches ? forwardSequence : reverseSequence
    const probableRoles = {}
    bannedChamps.forEach((champName, index) => {
      probableRoles[champName] = probableSequence[index % probableSequence.length]
    })
    
    // === PREFERENCE BUILDING ===
    const championsWithPreferences = bannedChamps.map(champName => {
      const champ = champData[champName]
      if (!champ || champ.possibleRoles.length === 0) {
        // If no metadata or no possible roles, assign to all roles as fallback
        return {
          name: champName,
          preferences: [...roles],
          possibleRolesCount: roles.length
        }
      }
      
      const preferences = []
      
      // 1. Add inferred probable role if possible
      const inferredRole = probableRoles[champName]
      if (inferredRole && champ.possibleRoles.includes(inferredRole) && !preferences.includes(inferredRole)) {
        preferences.push(inferredRole)
      }
      
      // 2. Add mainRole if not already included
      if (champ.mainRole && champ.possibleRoles.includes(champ.mainRole) && !preferences.includes(champ.mainRole)) {
        preferences.push(champ.mainRole)
      }
      
      // 3. Add remaining possibleRoles
      champ.possibleRoles.forEach(role => {
        if (!preferences.includes(role)) {
          preferences.push(role)
        }
      })
      
      return {
        name: champName,
        preferences,
        possibleRolesCount: champ.possibleRoles.length
          }
        })
    
    // Sort by number of possibleRoles (fewest first) to assign restricted champions first
    championsWithPreferences.sort((a, b) => a.possibleRolesCount - b.possibleRolesCount)
    
    // Calculate target count per role (scale for <10 bans)
    const totalBans = bannedChamps.length
    const targetCount = totalBans >= 10 ? 2 : Math.ceil(totalBans / roles.length)
    
    // === GREEDY ASSIGNMENT ===
    const assignments = {}
    const counts = {}
    roles.forEach(role => {
      assignments[role] = []
      counts[role] = 0
    })
    
    const placementOrder = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9]
    
    championsWithPreferences.forEach(champ => {
      let assigned = false
      
      // Try first preference where count < targetCount
      for (const preferredRole of champ.preferences) {
        if (counts[preferredRole] < targetCount) {
          assignments[preferredRole].push(champ.name)
          counts[preferredRole]++
          assigned = true
            break
          }
      }
      
      // If no preference available, try any possible role with space
      if (!assigned) {
        for (const role of champ.preferences) {
          if (counts[role] < targetCount) {
            assignments[role].push(champ.name)
            counts[role]++
            assigned = true
              break
          }
        }
      }
      
      // Final fallback: assign to role with fewest champions
      if (!assigned) {
        let bestRole = null
        let minCount = Infinity
        for (const role of champ.preferences) {
          if (counts[role] < minCount) {
            minCount = counts[role]
            bestRole = role
          }
        }
        if (bestRole) {
          assignments[bestRole].push(champ.name)
          counts[bestRole]++
        } else if (champ.preferences.length > 0) {
          // Last resort: use first preference
          assignments[champ.preferences[0]].push(champ.name)
          counts[champ.preferences[0]]++
        }
      }
    })
    
    // === BALANCE ADJUSTMENT ===
    const overfilled = []
    const underfilled = []
    
    roles.forEach(role => {
      if (counts[role] > targetCount) {
        overfilled.push(role)
      } else if (counts[role] < targetCount) {
        underfilled.push(role)
      }
    })
    
    // Move champions from overfilled to underfilled roles
    overfilled.forEach(overRole => {
      const champsToMove = [...assignments[overRole]]
      
      for (const champName of champsToMove) {
        if (counts[overRole] <= targetCount) break
        
        const champ = champData[champName]
        if (!champ) continue
        
        // Try to move to an underfilled role
        for (const underRole of underfilled) {
          if (champ.possibleRoles.includes(underRole) && counts[underRole] < targetCount) {
            // Move champion
            assignments[overRole] = assignments[overRole].filter(n => n !== champName)
            assignments[underRole].push(champName)
            counts[overRole]--
            counts[underRole]++
            
            // Update underfilled list
            if (counts[underRole] >= targetCount) {
              underfilled.splice(underfilled.indexOf(underRole), 1)
            }
              break
            }
          }
        }
    })
    
    // === ROUND-ROBIN FALLBACK ===
    // For extreme cases, redistribute via round-robin
    const hasExtremeImbalance = roles.some(role => counts[role] === 0 || counts[role] > 3)
    
    if (hasExtremeImbalance) {
      // Clear and redistribute
      roles.forEach(role => {
        assignments[role] = []
        counts[role] = 0
      })
      
      let roleIndex = 0
      championsWithPreferences.forEach(champ => {
        let assigned = false
        
        // Try round-robin through roles
        for (let i = 0; i < roles.length; i++) {
          const role = roles[(roleIndex + i) % roles.length]
          if (champ.preferences.includes(role) && counts[role] < 3) {
            assignments[role].push(champ.name)
            counts[role]++
            roleIndex = (roleIndex + i + 1) % roles.length
            assigned = true
            break
          }
        }
        
        // If still not assigned, use any possible role
        if (!assigned) {
          for (let i = 0; i < roles.length; i++) {
            const role = roles[(roleIndex + i) % roles.length]
            if (champ.preferences.includes(role)) {
              assignments[role].push(champ.name)
              counts[role]++
              roleIndex = (roleIndex + i + 1) % roles.length
              break
            }
          }
        }
      })
    }
    
    // === PLACE CHAMPIONS IN PANEL ===
    let totalPlaced = 0
    roles.forEach(role => {
      assignments[role].forEach((champName, idx) => {
        if (idx < placementOrder.length) {
          unavailablePanelState.value[role][placementOrder[idx]] = champName
          totalPlaced++
      }
    })
    })
    
    console.log('Placed champions:', totalPlaced, 'out of', bannedChamps.length)
    if (totalPlaced !== bannedChamps.length) {
      console.warn('Not all champions were placed!', {
        total: bannedChamps.length,
        placed: totalPlaced,
        assignments
      })
    }
    
    queueSave()
  }
  
  return {
    // State
    draftSeries,
    highlightedChampions,
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
    toggleHighlight,
    toggleBan,
    isUnavailable,
    isLcuUnavailable,
    isBannedChampion,
    isLcuBanned,
    isHighlighted,
    resetHighlighted,
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
