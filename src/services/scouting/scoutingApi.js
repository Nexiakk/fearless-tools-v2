import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'

const getCollectionName = (subcollection) => {
  if (subcollection === 'players') return 'scoutingPlayers'
  if (subcollection === 'teams') return 'scoutingTeams'
  return `scouting${subcollection.charAt(0).toUpperCase() + subcollection.slice(1)}`
}

const getCollectionRef = (workspaceId, subcollection) => {
  if (!workspaceId) {
    throw new Error('No workspace selected')
  }
  return collection(db, 'workspaces', workspaceId, getCollectionName(subcollection))
}

const getDocRef = (workspaceId, subcollection, docId) => {
  if (!workspaceId) {
    throw new Error('No workspace selected')
  }
  return doc(db, 'workspaces', workspaceId, getCollectionName(subcollection), docId)
}

const getSettingsDocRef = (workspaceId) => {
  if (!workspaceId) {
    throw new Error('No workspace selected')
  }
  return doc(db, 'workspaces', workspaceId, 'scoutingSettings', 'teamNames')
}

export const scoutingApi = {
  async fetchTeams(workspaceId) {
    const snapshot = await getDocs(getCollectionRef(workspaceId, 'teams'))
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  },

  async createTeam(workspaceId, teamData) {
    const payload = {
      ...teamData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    const docRef = await addDoc(getCollectionRef(workspaceId, 'teams'), payload)
    return { id: docRef.id, data: payload }
  },

  async updateTeam(workspaceId, teamId, updates) {
    const teamRef = getDocRef(workspaceId, 'teams', teamId)
    await updateDoc(teamRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  },

  async deleteTeam(workspaceId, teamId) {
    await deleteDoc(getDocRef(workspaceId, 'teams', teamId))
  },

  async fetchPlayers(workspaceId) {
    const snapshot = await getDocs(getCollectionRef(workspaceId, 'players'))
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
  },

  async createPlayer(workspaceId, playerData) {
    const payload = {
      ...playerData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    const docRef = await addDoc(getCollectionRef(workspaceId, 'players'), payload)
    return { id: docRef.id, data: payload }
  },

  async updatePlayer(workspaceId, playerId, updates) {
    const playerRef = getDocRef(workspaceId, 'players', playerId)
    await updateDoc(playerRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  },

  async deletePlayer(workspaceId, playerId) {
    await deleteDoc(getDocRef(workspaceId, 'players', playerId))
  },

  async deletePlayerDataIfExists(workspaceId, playerId) {
    const dataRef = getDocRef(workspaceId, 'data', playerId)
    const dataSnap = await getDoc(dataRef)
    if (dataSnap.exists()) {
      await deleteDoc(dataRef)
      return true
    }
    return false
  },

  async fetchScoutingData(workspaceId, playerId) {
    const dataRef = getDocRef(workspaceId, 'data', playerId)
    const dataSnap = await getDoc(dataRef)
    if (dataSnap.exists()) {
      return dataSnap.data()
    }
    return null
  },

  async saveScoutingData(workspaceId, playerId, data) {
    const dataRef = getDocRef(workspaceId, 'data', playerId)
    const firestoreData = {
      ...data,
      lastUpdated: serverTimestamp()
    }

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

    await setDoc(dataRef, firestoreData, { merge: true })
  },

  async fetchTeamNames(workspaceId) {
    const settingsRef = getSettingsDocRef(workspaceId)
    const settingsSnap = await getDoc(settingsRef)
    if (settingsSnap.exists()) {
      return settingsSnap.data()
    }
    return null
  },

  async saveTeamNames(workspaceId, updateData) {
    const settingsRef = getSettingsDocRef(workspaceId)
    await setDoc(settingsRef, updateData, { merge: true })
  }
}

