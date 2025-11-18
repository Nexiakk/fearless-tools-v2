// Champion Data Service (v9+ modular API)
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './config'
import { authService } from './auth'

/**
 * Fetch champion data from Firestore (GLOBAL - ignores workspaceId)
 */
export async function fetchChampionDataFromFirestore(workspaceId) {
  try {
    // Champion data is GLOBAL - always fetch from champions/global
    const championsRef = doc(db, 'champions', 'global')
    const docSnap = await getDoc(championsRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      let champions = Array.isArray(data.allChampions) ? data.allChampions : []

      console.log(`Fetched ${champions.length} champions from GLOBAL Firestore document`)

      // Normalize champions - ensure mainRole is set if missing
      champions = champions.map(champion => {
        const normalized = { ...champion }

        // If mainRole is missing but roles array exists, set mainRole to first role
        if (!normalized.mainRole && Array.isArray(normalized.roles) && normalized.roles.length > 0) {
          normalized.mainRole = normalized.roles[0]
        }

        // Ensure roles array exists
        if (!Array.isArray(normalized.roles)) {
          normalized.roles = []
        }

        return normalized
      })

      return {
        allChampions: champions,
        opTierChampions: typeof data.opTierChampions === 'object' && 
          data.opTierChampions !== null 
          ? data.opTierChampions 
          : {},
        version: data.version || (data.lastUpdated && data.lastUpdated.toMillis ? data.lastUpdated.toMillis() : Date.now()),
        lastUpdated: data.lastUpdated
      }
    } else {
      console.warn('No GLOBAL champion data document found at champions/global')
      return null
    }
  } catch (error) {
    console.error('Error fetching GLOBAL champion data from Firestore:', error)
    return null
  }
}

/**
 * Save champion data to Firestore (GLOBAL - Admin only)
 */
export async function saveChampionDataToFirestore(workspaceId, allChampions, opTierChampions) {
  if (!authService.isAuthenticated()) {
    return { success: false, error: 'Authentication required' }
  }

  // Check admin status (global)
  const isAdmin = await authService.isAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Admin access required' }
  }

  try {
    // Champion data is GLOBAL - always save to champions/global
    const championsRef = doc(db, 'champions', 'global')

    const version = Date.now()

    // Normalize champions array
    const normalizedChampions = Array.isArray(allChampions) ? allChampions.map(champion => {
      const normalized = { ...champion }

      // Convert roles array to plain array
      if (normalized.roles) {
        normalized.roles = Array.isArray(normalized.roles) ? [...normalized.roles] : []
      } else {
        normalized.roles = []
      }

      // Ensure mainRole is set
      if (!normalized.mainRole && normalized.roles.length > 0) {
        normalized.mainRole = normalized.roles[0]
      }

      // Ensure imageName is set
      if (!normalized.imageName || normalized.imageName.trim() === '') {
        const imageName = normalized.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .replace(/\s+/g, '')
        normalized.imageName = imageName
      }

      return normalized
    }) : []

    const dataToSave = {
      allChampions: normalizedChampions,
      opTierChampions: typeof opTierChampions === 'object' && opTierChampions !== null 
        ? opTierChampions 
        : {},
      version: version,
      lastUpdated: serverTimestamp()
    }

    console.log(`Saving ${dataToSave.allChampions.length} champions to GLOBAL Firestore`)

    await setDoc(championsRef, dataToSave)
    console.log('Champion data successfully written to Firestore')

    return { success: true, error: null, version: version }
  } catch (error) {
    console.error('Error saving champion data to Firestore:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Migrate champion data from champions.js to Firestore (GLOBAL)
 */
export async function migrateChampionDataToFirestore(workspaceId, allChampions, opTierChampions) {
  if (!authService.isAuthenticated()) {
    return { success: false, error: 'Authentication required for migration' }
  }

  // Check admin status
  const isAdmin = await authService.isAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Admin access required for migration' }
  }

  try {
    // Normalize champions
    const normalizedChampions = allChampions.map(champion => {
      const normalized = { ...champion }

      if (!normalized.mainRole && Array.isArray(normalized.roles) && normalized.roles.length > 0) {
        normalized.mainRole = normalized.roles[0]
      }

      if (!Array.isArray(normalized.roles)) {
        normalized.roles = []
      }

      if (!normalized.imageName || normalized.imageName.trim() === '') {
        const imageName = normalized.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .replace(/\s+/g, '')
        normalized.imageName = imageName
      }

      return normalized
    })

    console.log(`Migrating ${normalizedChampions.length} champions to GLOBAL Firestore`)

    // Save to GLOBAL location
    const result = await saveChampionDataToFirestore('global', normalizedChampions, opTierChampions)

    return result
  } catch (error) {
    console.error('Error migrating champion data:', error)
    return { success: false, error: error.message }
  }
}

