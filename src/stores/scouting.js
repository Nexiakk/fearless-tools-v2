import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { useWorkspaceStore } from './workspace'
import { useAuthStore } from './auth'

export const useScoutingStore = defineStore('scouting', () => {
  // State
  const players = ref([])
  const scoutingData = ref({}) // playerId -> ScoutingData
  const isLoading = ref(false)
  const isScouting = ref(false) // Currently scraping/fetching data
  const selectedPlayer = ref(null)
  const error = ref('')
  
  // Team names
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
  
  // Players organized by team and role
  const playersByTeamAndRole = computed(() => {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    const result = {
      own: {},
      enemy: {}
    }
    
    roles.forEach(role => {
      result.own[role] = null
      result.enemy[role] = null
    })
    
    players.value.forEach(player => {
      if (player.role && (player.team === 'own' || player.team === 'enemy')) {
        if (roles.includes(player.role)) {
          result[player.team][player.role] = player
        }
      }
    })
    
    return result
  })
  
  // Team completeness
  const teamCompleteness = computed(() => {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    const result = {
      own: { complete: false, missingRoles: [] },
      enemy: { complete: false, missingRoles: [] }
    }
    
    ;['own', 'enemy'].forEach(team => {
      roles.forEach(role => {
        if (!playersByTeamAndRole.value[team][role]) {
          result[team].missingRoles.push(role)
        }
      })
      result[team].complete = result[team].missingRoles.length === 0
    })
    
    return result
  })
  
  // Helper to get workspace scouting collection reference
  // Structure: workspaces/{workspaceId}/scoutingPlayers/{playerId}
  // Direct collection under workspace (like drafts)
  function getScoutingCollection(subcollection) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    // Use direct collection path like drafts: workspaces/{workspaceId}/scoutingPlayers
    const collectionName = subcollection === 'players' ? 'scoutingPlayers' : `scouting${subcollection.charAt(0).toUpperCase() + subcollection.slice(1)}`
    return collection(db, 'workspaces', workspaceStore.currentWorkspaceId, collectionName)
  }
  
  // Helper to get workspace scouting document reference
  function getScoutingDoc(subcollection, docId) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    const collectionName = subcollection === 'players' ? 'scoutingPlayers' : `scouting${subcollection.charAt(0).toUpperCase() + subcollection.slice(1)}`
    return doc(db, 'workspaces', workspaceStore.currentWorkspaceId, collectionName, docId)
  }
  
  // Helper to get scouting settings document reference
  function getScoutingSettingsDoc() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId) {
      throw new Error('No workspace selected')
    }
    return doc(db, 'workspaces', workspaceStore.currentWorkspaceId, 'scoutingSettings', 'teamNames')
  }
  
  // Validation helpers
  function getPlayerByTeamAndRole(team, role) {
    return playersByTeamAndRole.value[team]?.[role] || null
  }
  
  function isRoleTaken(team, role) {
    return getPlayerByTeamAndRole(team, role) !== null
  }
  
  function getAvailableRoles(team) {
    const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
    return roles.filter(role => !isRoleTaken(team, role))
  }
  
  function canAddPlayer(playerData) {
    // Check required fields
    if (!playerData.name || !playerData.opggUrl || !playerData.team) {
      return { valid: false, error: 'Name, op.gg URL, and team are required' }
    }
    
    // Check team limit (max 5 per team)
    const teamPlayers = players.value.filter(p => p.team === playerData.team)
    if (teamPlayers.length >= 5) {
      return { valid: false, error: `Team already has 5 players (max allowed)` }
    }
    
    // Check role uniqueness per team
    if (playerData.role && isRoleTaken(playerData.team, playerData.role)) {
      const existingPlayer = getPlayerByTeamAndRole(playerData.team, playerData.role)
      return { valid: false, error: `Role ${playerData.role} is already taken by ${existingPlayer?.name || 'another player'}` }
    }
    
    // Check total limit (max 10 players)
    if (players.value.length >= 10) {
      return { valid: false, error: 'Maximum of 10 players allowed (5 per team)' }
    }
    
    return { valid: true }
  }
  
  // Actions
  async function loadPlayers() {
    isLoading.value = true
    error.value = ''
    try {
      const playersRef = getScoutingCollection('players')
      const snapshot = await getDocs(playersRef)
      
      players.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error loading players:', err)
      error.value = 'Failed to load players'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function addPlayer(playerData) {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    // Validate before adding
    const validation = canAddPlayer(playerData)
    if (!validation.valid) {
      error.value = validation.error
      throw new Error(validation.error)
    }
    
    isLoading.value = true
    error.value = ''
    try {
      const playersRef = getScoutingCollection('players')
      const newPlayer = {
        name: playerData.name,
        opggUrl: playerData.opggUrl,
        team: playerData.team, // 'own' or 'enemy'
        role: playerData.role || null,
        leaguepediaUrl: playerData.leaguepediaUrl || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: authStore.user?.uid || 'unknown'
      }
      
      const docRef = await addDoc(playersRef, newPlayer)
      
      players.value.push({
        id: docRef.id,
        ...newPlayer
      })
      
      return docRef.id
    } catch (err) {
      console.error('Error adding player:', err)
      error.value = err.message || 'Failed to add player'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  async function updatePlayer(playerId, updates) {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    const currentPlayer = players.value.find(p => p.id === playerId)
    if (!currentPlayer) {
      throw new Error('Player not found')
    }
    
    // If role or team is being changed, validate
    if (updates.role !== undefined || updates.team !== undefined) {
      const updatedData = {
        ...currentPlayer,
        ...updates
      }
      // Check if the new role/team combination is valid
      if (updates.team && updates.role) {
        const existingPlayer = getPlayerByTeamAndRole(updates.team, updates.role)
        if (existingPlayer && existingPlayer.id !== playerId) {
          error.value = `Role ${updates.role} is already taken by ${existingPlayer.name}`
          throw new Error(error.value)
        }
      }
    }
    
    isLoading.value = true
    error.value = ''
    try {
      const playerRef = getScoutingDoc('players', playerId)
      await updateDoc(playerRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
      
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
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      throw new Error('Admin access required')
    }
    
    isLoading.value = true
    error.value = ''
    try {
      // Delete player document
      const playerRef = getScoutingDoc('players', playerId)
      await deleteDoc(playerRef)
      console.log(`[ScoutingStore] Deleted player document: ${playerId}`)
      
      // Delete scouting data document if it exists
      try {
        const dataRef = getScoutingDoc('data', playerId)
        const dataSnap = await getDoc(dataRef)
        if (dataSnap.exists()) {
          await deleteDoc(dataRef)
          console.log(`[ScoutingStore] Deleted scouting data document: ${playerId}`)
        } else {
          console.log(`[ScoutingStore] No scouting data document found for player: ${playerId}`)
        }
      } catch (dataErr) {
        // Log but don't fail if scouting data deletion fails
        console.warn(`[ScoutingStore] Error deleting scouting data for player ${playerId}:`, dataErr)
      }
      
      // Remove from local state
      players.value = players.value.filter(p => p.id !== playerId)
      
      // Remove scouting data from local state if exists
      if (scoutingData.value[playerId]) {
        delete scoutingData.value[playerId]
        console.log(`[ScoutingStore] Removed scouting data from local state: ${playerId}`)
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
      const dataRef = getScoutingDoc('data', playerId)
      const dataSnap = await getDoc(dataRef)
      
      if (dataSnap.exists()) {
        const loadedData = dataSnap.data()
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
      
      const dataRef = getScoutingDoc('data', playerId)
      
      // Prepare data for Firestore (convert Date objects to timestamps)
      const firestoreData = {
        ...data,
        lastUpdated: serverTimestamp()
      }
      
      // Handle nested Date objects
      if (data.soloq?.lastUpdated) {
        firestoreData.soloq = {
          ...data.soloq,
          lastUpdated: serverTimestamp()
        }
      }
      if (data.proplay?.lastUpdated) {
        firestoreData.proplay = {
          ...data.proplay,
          lastUpdated: serverTimestamp()
        }
      }
      
      console.log('[ScoutingStore] Firestore data to save:', firestoreData)
      console.log('[ScoutingStore] SoloQ champions in Firestore data:', firestoreData.soloq?.currentSeason?.champions)
      
      await setDoc(dataRef, firestoreData, { merge: true })
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
    isScouting.value = false
    selectedPlayer.value = null
    error.value = ''
  }
  
  // Team names management
  async function loadTeamNames() {
    try {
      const settingsRef = getScoutingSettingsDoc()
      const settingsSnap = await getDoc(settingsRef)
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data()
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
      const settingsRef = getScoutingSettingsDoc()
      const updateData = team === 'own' 
        ? { ownTeamName: name.trim() }
        : { enemyTeamName: name.trim() }
      
      await setDoc(settingsRef, updateData, { merge: true })
      
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
  
  // Get overlapping champions between teams
  function getOverlappingChampions(team) {
    const teamPlayers = team === 'own' ? ownTeamPlayers.value : enemyTeamPlayers.value
    const otherTeamPlayers = team === 'own' ? enemyTeamPlayers.value : ownTeamPlayers.value
    
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
    scoutingData,
    isLoading,
    isScouting,
    selectedPlayer,
    error,
    ownTeamName,
    enemyTeamName,
    
    // Getters
    ownTeamPlayers,
    enemyTeamPlayers,
    playersByRole,
    allScoutedChampions,
    playersByTeamAndRole,
    teamCompleteness,
    
    // Actions
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
    getPlayerChampions,
    getOverlappingChampions,
    
    // Team names
    loadTeamNames,
    updateTeamName,
    
    // Validation helpers
    getPlayerByTeamAndRole,
    isRoleTaken,
    getAvailableRoles,
    canAddPlayer
  }
})

