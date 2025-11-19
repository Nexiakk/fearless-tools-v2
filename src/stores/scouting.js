import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore'
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
      error.value = 'Failed to add player'
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
      error.value = 'Failed to update player'
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
      const playerRef = getScoutingDoc('players', playerId)
      await deleteDoc(playerRef)
      
      // Remove from local state
      players.value = players.value.filter(p => p.id !== playerId)
      
      // Remove scouting data if exists
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
      const dataRef = getScoutingDoc('data', playerId)
      const dataSnap = await dataRef.get()
      
      if (dataSnap.exists()) {
        scoutingData.value[playerId] = dataSnap.data()
      }
    } catch (err) {
      console.error('Error loading scouting data:', err)
      throw err
    }
  }
  
  async function saveScoutingData(playerId, data) {
    try {
      const dataRef = getScoutingDoc('data', playerId)
      await updateDoc(dataRef, {
        ...data,
        lastUpdated: serverTimestamp()
      }, { merge: true })
      
      scoutingData.value[playerId] = {
        ...scoutingData.value[playerId],
        ...data,
        lastUpdated: new Date()
      }
    } catch (err) {
      // If document doesn't exist, create it
      if (err.code === 'not-found' || err.message?.includes('not found')) {
        const dataRef = doc(db, getScoutingPath('data'), playerId)
        await updateDoc(dataRef, {
          ...data,
          lastUpdated: serverTimestamp()
        }, { merge: true })
        
        scoutingData.value[playerId] = {
          ...data,
          lastUpdated: new Date()
        }
      } else {
        console.error('Error saving scouting data:', err)
        throw err
      }
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
    
    // Getters
    ownTeamPlayers,
    enemyTeamPlayers,
    playersByRole,
    allScoutedChampions,
    
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
    getPlayerChampions,
    getOverlappingChampions
  }
})

