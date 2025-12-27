import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWorkspaceStore } from './workspace'
import { useAuthStore } from './auth'
import { scoutingApi } from '@/services/scouting/scoutingApi'

export const useScoutingStore = defineStore('scouting', () => {
  const workspaceStore = useWorkspaceStore()
  const authStore = useAuthStore()
  // State
  const players = ref([])
  const teams = ref([]) // Array of team objects: { id, name, createdAt, updatedAt }
  const scoutingData = ref({}) // playerId -> ScoutingData
  const isLoading = ref(false)
  const isScouting = ref(false) // Currently scraping/fetching data
  const selectedPlayer = ref(null)
  const selectedTeamId = ref(null) // Currently selected team ID
  const error = ref('')
  const isLoadingTeams = ref(false) // Prevent concurrent team loads
  const teamsLoadedForWorkspace = ref(null) // Track which workspace teams were loaded for
  
  // Legacy team names (for backward compatibility during migration)
  const ownTeamName = ref('Your Team')
  const enemyTeamName = ref('Enemy Team')
  
  // Getters
  const ownTeamPlayers = computed(() => 
    players.value.filter(p => p.team === 'own')
  )
  
  const enemyTeamPlayers = computed(() => 
    players.value.filter(p => p.team === 'enemy')
  )
  
  const playersByRole = computed(() => {
    const grouped = {
      Top: [],
      Jungle: [],
      Mid: [],
      Bot: [],
      Support: [],
      Unknown: []
    }
    
    players.value.forEach(player => {
      const role = player.role || 'Unknown'
      if (grouped[role]) {
        grouped[role].push(player)
      } else {
        grouped.Unknown.push(player)
      }
    })
    
    return grouped
  })
  
  const allScoutedChampions = computed(() => {
    const champions = new Set()
    Object.values(scoutingData.value).forEach(data => {
      if (data.soloq?.currentSeason?.champions) {
        data.soloq.currentSeason.champions.forEach(champ => {
          champions.add(champ.championName)
        })
      }
      if (data.proplay?.championPool) {
        data.proplay.championPool.forEach(champ => {
          champions.add(champ.championName)
        })
      }
    })
    return Array.from(champions)
  })
  
  // Team completeness (for selected team)
  const teamCompleteness = computed(() => {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    if (!selectedTeamId.value) {
      return { complete: false, missingRoles: roles }
    }
    
    const missingRoles = []
    roles.forEach(role => {
      const player = players.value.find(p => p.teamId === selectedTeamId.value && p.role === role)
      if (!player) {
        missingRoles.push(role)
      }
    })
    
    return {
      complete: missingRoles.length === 0,
      missingRoles
    }
  })
  
  // Team-related getters
  const selectedTeam = computed(() => {
    if (!selectedTeamId.value) return null
    return teams.value.find(t => t.id === selectedTeamId.value) || null
  })
  
  const selectedTeamPlayers = computed(() => {
    if (!selectedTeamId.value) return []
    return players.value.filter(p => p.teamId === selectedTeamId.value)
  })
  
  // Players organized by team and role (for selected team)
  const playersByTeamAndRole = computed(() => {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    const result = {}
    
    if (!selectedTeamId.value) return result
    
    roles.forEach(role => {
      result[role] = null
    })
    
    players.value.forEach(player => {
      if (player.role && player.teamId === selectedTeamId.value) {
        if (roles.includes(player.role)) {
          result[player.role] = player
        }
      }
    })
    
    return result
  })
  
  // Legacy support: getPlayerByTeamAndRole for backward compatibility
  // Now works with selectedTeamId
  function getPlayerByTeamAndRole(teamOrRole, roleOrNull) {
    // If called with (team, role) - legacy format
    if (roleOrNull && (teamOrRole === 'own' || teamOrRole === 'enemy')) {
      // Legacy support: try to find team by name
      const teamName = teamOrRole === 'own' ? ownTeamName.value : enemyTeamName.value
      const team = teams.value.find(t => t.name === teamName)
      if (team) {
        return players.value.find(p => p.teamId === team.id && p.role === roleOrNull) || null
      }
      return null
    }
    // If called with just role (new format)
    const role = teamOrRole
    return playersByTeamAndRole.value[role] || null
  }
  
  function isRoleTaken(teamId, role) {
    return players.value.some(p => p.teamId === teamId && p.role === role)
  }
  
  function getAvailableRoles(teamId) {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    return roles.filter(role => !isRoleTaken(teamId, role))
  }
  
  function canAddPlayer(playerData) {
    // Check required fields
    if (!playerData.name || !playerData.opggUrl || !playerData.teamId) {
      return { valid: false, error: 'Name, op.gg URL, and team are required' }
    }
    
    // Check team exists
    const team = teams.value.find(t => t.id === playerData.teamId)
    if (!team) {
      return { valid: false, error: 'Team not found' }
    }
    
    // Check team limit (max 5 per team)
    const teamPlayers = players.value.filter(p => p.teamId === playerData.teamId)
    if (teamPlayers.length >= 5) {
      return { valid: false, error: `Team already has 5 players (max allowed)` }
    }
    
    // Check role uniqueness per team
    if (playerData.role && isRoleTaken(playerData.teamId, playerData.role)) {
      const existingPlayer = players.value.find(p => p.teamId === playerData.teamId && p.role === playerData.role)
      return { valid: false, error: `Role ${playerData.role} is already taken by ${existingPlayer?.name || 'another player'}` }
    }
    
    return { valid: true }
  }
  
  // Actions
  async function loadTeams() {
    // Prevent concurrent calls
    if (isLoadingTeams.value) {
      return
    }
    
    // Check if we've already loaded teams for the current workspace
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    
    if (!currentWorkspaceId) {
      return // No workspace selected
    }
    
    // If teams are already loaded for this workspace, skip reloading
    // This prevents infinite loops when components remount
    if (teamsLoadedForWorkspace.value === currentWorkspaceId) {
      return
    }
    
    isLoadingTeams.value = true
    isLoading.value = true
    error.value = ''
    try {
      const loadedTeams = await scoutingApi.fetchTeams(currentWorkspaceId)
      
      teams.value = loadedTeams.sort((a, b) => {
        // Sort by createdAt (newest first) or name
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toMillis() - a.createdAt.toMillis()
        }
        return (a.name || '').localeCompare(b.name || '')
      })
      
      // Mark teams as loaded for this workspace
      teamsLoadedForWorkspace.value = currentWorkspaceId
      
      // Auto-select first team if none selected
      if (!selectedTeamId.value && teams.value.length > 0) {
        selectedTeamId.value = teams.value[0].id
      }
    } catch (err) {
      console.error('Error loading teams:', err)
      error.value = 'Failed to load teams'
      // Don't throw - just log the error to prevent infinite loops
      // The component can check error.value to display a message
    } finally {
      isLoading.value = false
      isLoadingTeams.value = false
    }
  }
  
  async function loadPlayers() {
    isLoading.value = true
    error.value = ''
    try {
      const currentWorkspaceId = workspaceStore.currentWorkspaceId
      if (!currentWorkspaceId) {
        return
      }
      
      const loadedPlayers = await scoutingApi.fetchPlayers(currentWorkspaceId)
      players.value = loadedPlayers
    } catch (err) {
      console.error('Error loading players:', err)
      error.value = 'Failed to load players'
      // Don't throw - just log the error to prevent blocking UI
      // The component can check error.value to display a message
    } finally {
      isLoading.value = false
    }
  }
  
  async function addTeam(teamData) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    if (!teamData.name || teamData.name.trim() === '') {
      throw new Error('Team name is required')
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      const { id, data } = await scoutingApi.createTeam(currentWorkspaceId, {
        name: teamData.name.trim(),
        createdBy: authStore.user?.uid || 'unknown'
      })
      
      teams.value.push({
        id,
        ...data
      })
      
      // Auto-select newly created team
      selectedTeamId.value = id
      
      return id
    } catch (err) {
      console.error('Error adding team:', err)
      error.value = err.message || 'Failed to add team'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function updateTeam(teamId, updates) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    const currentTeam = teams.value.find(t => t.id === teamId)
    if (!currentTeam) {
      throw new Error('Team not found')
    }
    
    if (updates.name && updates.name.trim() === '') {
      throw new Error('Team name cannot be empty')
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      await scoutingApi.updateTeam(currentWorkspaceId, teamId, updates)
      
      // Update local state
      const index = teams.value.findIndex(t => t.id === teamId)
      if (index !== -1) {
        teams.value[index] = {
          ...teams.value[index],
          ...updates
        }
      }
    } catch (err) {
      console.error('Error updating team:', err)
      error.value = err.message || 'Failed to update team'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function deleteTeam(teamId) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    // Check if team has players
    const teamPlayers = players.value.filter(p => p.teamId === teamId)
    if (teamPlayers.length > 0) {
      throw new Error('Cannot delete team with players. Please remove all players first.')
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      await scoutingApi.deleteTeam(currentWorkspaceId, teamId)
      
      // Remove from local state
      teams.value = teams.value.filter(t => t.id !== teamId)
      
      // If deleted team was selected, select another team or clear selection
      if (selectedTeamId.value === teamId) {
        selectedTeamId.value = teams.value.length > 0 ? teams.value[0].id : null
      }
    } catch (err) {
      console.error('Error deleting team:', err)
      error.value = err.message || 'Failed to delete team'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  function setSelectedTeamId(teamId) {
    selectedTeamId.value = teamId
  }
  
  async function addPlayer(playerData) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    // Validate before adding
    const validation = canAddPlayer(playerData)
    if (!validation.valid) {
      error.value = validation.error
      throw new Error(validation.error)
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      const { id, data } = await scoutingApi.createPlayer(currentWorkspaceId, {
        name: playerData.name,
        opggUrl: playerData.opggUrl,
        teamId: playerData.teamId,
        role: playerData.role || null,
        leaguepediaUrl: playerData.leaguepediaUrl || null,
        golUrl: playerData.golUrl || null,
        createdBy: authStore.user?.uid || 'unknown'
      })
      
      players.value.push({
        id,
        ...data
      })
      
      return id
    } catch (err) {
      console.error('Error adding player:', err)
      error.value = err.message || 'Failed to add player'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function updatePlayer(playerId, updates) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    const currentPlayer = players.value.find(p => p.id === playerId)
    if (!currentPlayer) {
      throw new Error('Player not found')
    }
    
    // If role or teamId is being changed, validate
    if (updates.role !== undefined || updates.teamId !== undefined) {
      const updatedData = {
        ...currentPlayer,
        ...updates
      }
      // Check if the new role/teamId combination is valid
      if (updates.teamId && updates.role) {
        const existingPlayer = players.value.find(p => p.teamId === updates.teamId && p.role === updates.role)
        if (existingPlayer && existingPlayer.id !== playerId) {
          error.value = `Role ${updates.role} is already taken by ${existingPlayer.name}`
          throw new Error(error.value)
        }
      }
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      await scoutingApi.updatePlayer(currentWorkspaceId, playerId, updates)
      
      // Update local state
      const index = players.value.findIndex(p => p.id === playerId)
      if (index !== -1) {
        players.value[index] = {
          ...players.value[index],
          ...updates
        }
      }
    } catch (err) {
      console.error('Error updating player:', err)
      error.value = err.message || 'Failed to update player'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function deletePlayer(playerId) {
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    const currentWorkspaceId = workspaceStore.currentWorkspaceId
    if (!currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      await scoutingApi.deletePlayer(currentWorkspaceId, playerId)
      await scoutingApi.deletePlayerDataIfExists(currentWorkspaceId, playerId)
      
      // Remove from local state
      players.value = players.value.filter(p => p.id !== playerId)
      
      // Remove scouting data from local state if exists
      if (scoutingData.value[playerId]) {
        delete scoutingData.value[playerId]
      }
    } catch (err) {
      console.error('Error deleting player:', err)
      error.value = 'Failed to delete player'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function loadScoutingData(playerId) {
    try {
      console.log('[ScoutingStore] Loading scouting data for player:', playerId)
      const currentWorkspaceId = workspaceStore.currentWorkspaceId
      if (!currentWorkspaceId) {
        throw new Error('No workspace selected')
      }
      
      const loadedData = await scoutingApi.fetchScoutingData(currentWorkspaceId, playerId)
      
      if (loadedData) {
        console.log('[ScoutingStore] Loaded data from Firestore:', loadedData)
        console.log('[ScoutingStore] SoloQ champions in loaded data:', loadedData.soloq?.currentSeason?.champions)
        console.log('[ScoutingStore] SoloQ champions count:', loadedData.soloq?.currentSeason?.champions?.length || 0)
        scoutingData.value[playerId] = loadedData
        console.log('[ScoutingStore] Data loaded into local state')
      } else {
        console.log('[ScoutingStore] No data found in Firestore for player:', playerId)
      }
    } catch (err) {
      console.error('[ScoutingStore] Error loading scouting data:', err)
      console.error('[ScoutingStore] Error details:', err.message, err.stack)
      throw err
    }
  }
  
  async function saveScoutingData(playerId, data) {
    try {
      console.log('[ScoutingStore] Saving scouting data for player:', playerId)
      console.log('[ScoutingStore] Data to save:', data)
      console.log('[ScoutingStore] SoloQ champions in data:', data.soloq?.currentSeason?.champions)
      console.log('[ScoutingStore] SoloQ champions count:', data.soloq?.currentSeason?.champions?.length || 0)
      
      const currentWorkspaceId = workspaceStore.currentWorkspaceId
      if (!currentWorkspaceId) {
        throw new Error('No workspace selected')
      }
      
      console.log('[ScoutingStore] Firestore data to save:', data)
      console.log('[ScoutingStore] SoloQ champions in Firestore data:', data.soloq?.currentSeason?.champions)
      
      await scoutingApi.saveScoutingData(currentWorkspaceId, playerId, data)
      console.log('[ScoutingStore] Data saved to Firestore successfully')
      
      // Update local state
      scoutingData.value[playerId] = {
        ...scoutingData.value[playerId],
        ...data,
        lastUpdated: new Date()
      }
      console.log('[ScoutingStore] Local state updated')
      console.log('[ScoutingStore] Local state champions:', scoutingData.value[playerId].soloq?.currentSeason?.champions)
      console.log('[ScoutingStore] Local state champions count:', scoutingData.value[playerId].soloq?.currentSeason?.champions?.length || 0)
    } catch (err) {
      console.error('[ScoutingStore] Error saving scouting data:', err)
      console.error('[ScoutingStore] Error details:', err.message, err.stack)
      throw err
    }
  }
  
  function setSelectedPlayer(playerId) {
    selectedPlayer.value = playerId
  }
  
  function setScouting(value) {
    isScouting.value = value
  }
  
  function setError(message) {
    error.value = message
  }
  
  function clearError() {
    error.value = ''
  }
  
  function resetLoadingState() {
    isLoading.value = false
    isLoadingTeams.value = false
    isScouting.value = false
    selectedPlayer.value = null
    error.value = ''
    // Don't clear teamsLoadedForWorkspace here - it should persist across component remounts
    // Only clear it when workspace actually changes
  }
  
  // Reset teams when workspace changes
  function resetTeamsForWorkspaceChange() {
    teams.value = []
    players.value = []
    scoutingData.value = {}
    teamsLoadedForWorkspace.value = null
    selectedTeamId.value = null
    selectedPlayer.value = null
  }
  
  // Team names management
  async function loadTeamNames() {
    try {
      const currentWorkspaceId = workspaceStore.currentWorkspaceId
      if (!currentWorkspaceId) {
        throw new Error('No workspace selected')
      }
      
      const data = await scoutingApi.fetchTeamNames(currentWorkspaceId)
      
      if (data) {
        ownTeamName.value = data.ownTeamName || 'Your Team'
        enemyTeamName.value = data.enemyTeamName || 'Enemy Team'
      }
    } catch (err) {
      console.error('Error loading team names:', err)
      // Use defaults on error
    }
  }
  
  async function updateTeamName(team, name) {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    if (team !== 'own' && team !== 'enemy') {
      throw new Error('Team must be "own" or "enemy"')
    }
    
    if (!name || name.trim() === '') {
      throw new Error('Team name cannot be empty')
    }
    
    try {
      const currentWorkspaceId = workspaceStore.currentWorkspaceId
      if (!currentWorkspaceId) {
        throw new Error('No workspace selected')
      }
      
      const updateData = team === 'own' 
        ? { ownTeamName: name.trim() }
        : { enemyTeamName: name.trim() }
      
      await scoutingApi.saveTeamNames(currentWorkspaceId, updateData)
      
      // Update local state
      if (team === 'own') {
        ownTeamName.value = name.trim()
      } else {
        enemyTeamName.value = name.trim()
      }
    } catch (err) {
      console.error('Error updating team name:', err)
      throw err
    }
  }
  
  // Get player champions (from SoloQ or Pro play)
  function getPlayerChampions(playerId) {
    const data = scoutingData.value[playerId]
    if (!data) return []
    
    const champions = new Map()
    
    // Add SoloQ champions
    if (data.soloq?.currentSeason?.champions) {
      data.soloq.currentSeason.champions.forEach(champ => {
        if (!champions.has(champ.championName)) {
          champions.set(champ.championName, {
            ...champ,
            source: 'soloq'
          })
        }
      })
    }
    
    // Add Pro play champions
    if (data.proplay?.championPool) {
      data.proplay.championPool.forEach(champ => {
        if (champions.has(champ.championName)) {
          // Merge if exists
          const existing = champions.get(champ.championName)
          champions.set(champ.championName, {
            ...existing,
            ...champ,
            source: 'both'
          })
        } else {
          champions.set(champ.championName, {
            ...champ,
            source: 'proplay'
          })
        }
      })
    }
    
    return Array.from(champions.values())
  }
  
  // Get overlapping champions between selected team and another team
  function getOverlappingChampions(otherTeamId) {
    if (!selectedTeamId.value) return []
    
    const teamPlayers = selectedTeamPlayers.value
    const otherTeamPlayers = players.value.filter(p => p.teamId === otherTeamId)
    
    const teamChampions = new Set()
    const otherTeamChampions = new Set()
    
    teamPlayers.forEach(player => {
      const champs = getPlayerChampions(player.id)
      champs.forEach(champ => teamChampions.add(champ.championName))
    })
    
    otherTeamPlayers.forEach(player => {
      const champs = getPlayerChampions(player.id)
      champs.forEach(champ => otherTeamChampions.add(champ.championName))
    })
    
    // Find overlap
    const overlap = []
    teamChampions.forEach(champ => {
      if (otherTeamChampions.has(champ)) {
        overlap.push(champ)
      }
    })
    
    return overlap
  }
  
  return {
    // State
    players,
    teams,
    scoutingData,
    isLoading,
    isLoadingTeams,
    isScouting,
    selectedPlayer,
    selectedTeamId,
    error,
    ownTeamName, // Legacy
    enemyTeamName, // Legacy
    
    // Getters
    selectedTeam,
    selectedTeamPlayers,
    ownTeamPlayers, // Legacy
    enemyTeamPlayers, // Legacy
    playersByRole,
    allScoutedChampions,
    playersByTeamAndRole,
    teamCompleteness, // Legacy
    
    // Actions
    loadTeams,
    addTeam,
    updateTeam,
    deleteTeam,
    setSelectedTeamId,
    loadPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    loadScoutingData,
    saveScoutingData,
    setSelectedPlayer,
    setScouting,
    setError,
    clearError,
    resetLoadingState,
    resetTeamsForWorkspaceChange,
    getPlayerChampions,
    getOverlappingChampions,
    
    // Team names (Legacy)
    loadTeamNames,
    updateTeamName,
    
    // Validation helpers
    getPlayerByTeamAndRole,
    isRoleTaken,
    getAvailableRoles,
    canAddPlayer
  }
})

