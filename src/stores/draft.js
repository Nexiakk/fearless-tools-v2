import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDraftDataFromFirestore, saveDraftDataToFirestore } from '@/services/firebase/firestore'
import { workspaceService } from '@/services/workspace'
import { useWorkspaceStore } from './workspace'
import { useChampionsStore } from './champions'
import { useSettingsStore } from './settings'

export const useDraftStore = defineStore('draft', () => {
  // State
  const draftSeries = ref([])
  const highlightedChampions = ref({})
  const unavailablePanelState = ref({
    Top: Array(10).fill(null),
    Jungle: Array(10).fill(null),
    Mid: Array(10).fill(null),
    Bot: Array(10).fill(null),
    Support: Array(10).fill(null)
  })
  const pickContext = ref([])
  let saveTimeout = null
  let isSaving = ref(false)
  
  // Getters
  const unavailableChampions = computed(() => new Set(draftSeries.value))
  
  const championsByRoleForCompactView = computed(() => {
    const championsStore = useChampionsStore()
    const settingsStore = useSettingsStore()
    const frozenChampions = settingsStore.settings.pool.frozenChampions
    
    if (frozenChampions) {
      const grouped = {
        Top: { sticky: [], scrollable: [] },
        Jungle: { sticky: [], scrollable: [] },
        Mid: { sticky: [], scrollable: [] },
        Bot: { sticky: [], scrollable: [] },
        Support: { sticky: [], scrollable: [] }
      }
      
      championsStore.allChampions.forEach(champ => {
        if (Array.isArray(champ.roles)) {
          champ.roles.forEach(role => {
            if (grouped[role]) {
              const isUnavailable = unavailableChampions.value.has(champ.name)
              const isOp = championsStore.isOpForRole(champ.name, role)
              const isHighlighted = isHighlightedForRole(champ.name, role)
              
              if (isUnavailable || isOp || isHighlighted) {
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
            if (unavailableChampions.value.has(champ.name)) return 3
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
      const grouped = { Top: [], Jungle: [], Mid: [], Bot: [], Support: [] }
      
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
            if (unavailableChampions.value.has(champ.name)) return 3
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
  
  // Actions
  function isUnavailable(championName) {
    return unavailableChampions.value.has(championName)
  }
  
  function isHighlighted(championName, role = null) {
    if (!championName || !highlightedChampions.value[championName]) return false
    const roles = highlightedChampions.value[championName]
    return role ? roles.includes(role) : true
  }
  
  function togglePick(championName, pickedFromRole = null) {
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
    const validRoles = new Set(['Top', 'Jungle', 'Mid', 'Bot', 'Support'])
    
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
    if (!championName || isUnavailable(championName)) return
    
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
  
  function resetUnavailable() {
    draftSeries.value = []
    pickContext.value = []
    unavailablePanelState.value = {
      Top: Array(10).fill(null),
      Jungle: Array(10).fill(null),
      Mid: Array(10).fill(null),
      Bot: Array(10).fill(null),
      Support: Array(10).fill(null)
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
            pickContext: pickContext.value
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
            pickContext: pickContext.value
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
    try {
      const data = await fetchDraftDataFromFirestore(workspaceId)
      if (data) {
        draftSeries.value = data.draftSeries || []
        highlightedChampions.value = data.highlightedChampions || {}
        unavailablePanelState.value = data.unavailablePanelState || {
          Top: Array(10).fill(null),
          Jungle: Array(10).fill(null),
          Mid: Array(10).fill(null),
          Bot: Array(10).fill(null),
          Support: Array(10).fill(null)
        }
        pickContext.value = data.pickContext || []
        
        // Reconstruct pickContext if missing (migration)
        if (pickContext.value.length === 0 && draftSeries.value.length > 0) {
          reconstructPickContext()
        }
      }
    } catch (error) {
      console.error('Error loading workspace data:', error)
    }
  }
  
  function loadDraftData(data) {
    draftSeries.value = data.draftSeries || []
    highlightedChampions.value = data.highlightedChampions || {}
    unavailablePanelState.value = data.unavailablePanelState || {
      Top: Array(10).fill(null),
      Jungle: Array(10).fill(null),
      Mid: Array(10).fill(null),
      Bot: Array(10).fill(null),
      Support: Array(10).fill(null)
    }
    pickContext.value = data.pickContext || []
    
    // Reconstruct pickContext if missing
    if (pickContext.value.length === 0 && draftSeries.value.length > 0) {
      reconstructPickContext()
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
      for (const role of ['Top', 'Jungle', 'Mid', 'Bot', 'Support']) {
        if (unavailablePanelState.value[role] && unavailablePanelState.value[role].includes(championName)) {
          foundRole = role
          break
        }
      }
      
      // If not found in panel, use mainRole or first role
      if (!foundRole) {
        foundRole = champion.mainRole && ['Top', 'Jungle', 'Mid', 'Bot', 'Support'].includes(champion.mainRole)
          ? champion.mainRole
          : (champion.roles && champion.roles.length > 0 && ['Top', 'Jungle', 'Mid', 'Bot', 'Support'].includes(champion.roles[0])
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
    const validRoles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    
    // Clear all current placements
    validRoles.forEach(role => {
      unavailablePanelState.value[role] = Array(10).fill(null)
    })
    
    // Calculate target count per role
    const totalChampions = draftSeries.value.length
    const targetPerRole = Math.floor(totalChampions / validRoles.length)
    const remainder = totalChampions % validRoles.length
    
    // Sort pick context by pick order
    const sortedPicks = [...pickContext.value].sort((a, b) => a.pickOrder - b.pickOrder)
    
    // Track role counts
    const roleCounts = {}
    validRoles.forEach(role => {
      roleCounts[role] = 0
    })
    
    const placementOrder = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9]
    
    // Place champions
    sortedPicks.forEach(pick => {
      const champion = championsStore.allChampions.find(c => c.name === pick.championName)
      if (!champion) return
      
      // Get all roles this champion can play
      const allChampionRoles = new Set()
      if (champion.mainRole && validRoles.includes(champion.mainRole)) {
        allChampionRoles.add(champion.mainRole)
      }
      if (champion.roles) {
        champion.roles.forEach(r => {
          if (r && validRoles.includes(r)) {
            allChampionRoles.add(r)
          }
        })
      }
      
      // Calculate target for each role
      const roleTargets = {}
      validRoles.forEach((role, idx) => {
        roleTargets[role] = targetPerRole + (idx < remainder ? 1 : 0)
      })
      
      // Priority 1: Use the role from pick context if champion can play it and role is below target
      let placed = false
      if (pick.role && allChampionRoles.has(pick.role) && roleCounts[pick.role] < roleTargets[pick.role]) {
        for (const slotIndex of placementOrder) {
          if (unavailablePanelState.value[pick.role][slotIndex] === null) {
            unavailablePanelState.value[pick.role][slotIndex] = pick.championName
            roleCounts[pick.role]++
            placed = true
            break
          }
        }
      }
      
      // Priority 2: Find role that's below target and champion can play
      if (!placed) {
        let bestRole = null
        let bestDeficit = -Infinity
        
        validRoles.forEach(role => {
          if (allChampionRoles.has(role)) {
            const deficit = roleTargets[role] - roleCounts[role]
            if (deficit > bestDeficit) {
              bestDeficit = deficit
              bestRole = role
            }
          }
        })
        
        if (bestRole && bestDeficit > 0) {
          for (const slotIndex of placementOrder) {
            if (unavailablePanelState.value[bestRole][slotIndex] === null) {
              unavailablePanelState.value[bestRole][slotIndex] = pick.championName
              roleCounts[bestRole]++
              placed = true
              break
            }
          }
        }
      }
      
      // Priority 3: Find any role champion can play with fewest champions
      if (!placed) {
        let bestRole = null
        let minCount = Infinity
        
        validRoles.forEach(role => {
          if (allChampionRoles.has(role) && roleCounts[role] < minCount) {
            minCount = roleCounts[role]
            bestRole = role
          }
        })
        
        if (bestRole) {
          for (const slotIndex of placementOrder) {
            if (unavailablePanelState.value[bestRole][slotIndex] === null) {
              unavailablePanelState.value[bestRole][slotIndex] = pick.championName
              roleCounts[bestRole]++
              placed = true
              break
            }
          }
        }
      }
      
      // Priority 4: Find any role with fewest champions (fallback)
      if (!placed) {
        let bestRole = null
        let minCount = Infinity
        
        validRoles.forEach(role => {
          if (roleCounts[role] < minCount) {
            minCount = roleCounts[role]
            bestRole = role
          }
        })
        
        if (bestRole) {
          for (const slotIndex of placementOrder) {
            if (unavailablePanelState.value[bestRole][slotIndex] === null) {
              unavailablePanelState.value[bestRole][slotIndex] = pick.championName
              roleCounts[bestRole]++
              break
            }
          }
        }
      }
    })
    
    queueSave()
  }
  
  return {
    // State
    draftSeries,
    highlightedChampions,
    unavailablePanelState,
    pickContext,
    isSaving,
    // Getters
    unavailableChampions,
    championsByRoleForCompactView,
    // Actions
    togglePick,
    toggleHighlight,
    isUnavailable,
    isHighlighted,
    resetHighlighted,
    resetUnavailable,
    loadWorkspaceData,
    loadDraftData,
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
    queueSave
  }
})
