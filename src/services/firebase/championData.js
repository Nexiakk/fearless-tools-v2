// Champion Data Service (v9+ modular API)
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
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

/**
 * NEW SYSTEM: Fetch champions from individual documents using role containers
 */
export async function fetchChampionsFromIndividualDocs() {
  try {
    console.log('🔄 Fetching champions from individual documents...')

    // First, get role containers to know which champions exist
    const roleData = await fetchChampionRolesFromContainers()

    // Flatten all champion IDs
    const allChampionIds = new Set()
    Object.values(roleData).forEach(ids => {
      ids.forEach(id => allChampionIds.add(id))
    })

    console.log(`📋 Found ${allChampionIds.size} champions across all roles`)

    if (allChampionIds.size === 0) {
      console.warn('⚠️ No champions found in role containers, falling back to global data')
      return await fetchChampionDataFromFirestore('global')
    }

    // Fetch all champion documents in batches to avoid overwhelming Firestore
    const champions = await fetchChampionsInBatches(Array.from(allChampionIds))

    // Normalize champions for frontend compatibility
    const normalizedChampions = champions.map(champion => {
      const normalized = { ...champion }

      // Extract roles from the roles object and convert to array
      if (normalized.roles && typeof normalized.roles === 'object') {
        normalized.roles = Object.keys(normalized.roles)
      } else if (!Array.isArray(normalized.roles)) {
        normalized.roles = []
      }

      // Set mainRole to first role if not set
      if (!normalized.mainRole && normalized.roles.length > 0) {
        normalized.mainRole = normalized.roles[0]
      }

      return normalized
    })

    console.log(`✅ Successfully fetched ${normalizedChampions.length} champions from individual documents`)

    return {
      allChampions: normalizedChampions,
      opTierChampions: {}, // TODO: Implement OP tier detection from new data
      version: Date.now(), // Use current timestamp as version
      lastUpdated: new Date()
    }

  } catch (error) {
    console.error('❌ Error fetching champions from individual docs:', error)
    // Fallback to old system
    console.log('🔄 Falling back to global champion data...')
    return await fetchChampionDataFromFirestore('global')
  }
}

/**
 * Fetch role containers to get champion IDs per role
 */
export async function fetchChampionRolesFromContainers() {
  const roles = ['top', 'jungle', 'middle', 'bottom', 'support']
  const roleData = {}

  // Fetch all role containers in parallel
  const rolePromises = roles.map(async (role) => {
    try {
      const roleRef = doc(db, 'champions', 'roles', role)
      const roleSnap = await getDoc(roleRef)

      if (roleSnap.exists()) {
        const data = roleSnap.data()
        return { role, champions: data.champions || [] }
      }
      return { role, champions: [] }
    } catch (error) {
      console.warn(`⚠️ Error fetching role container ${role}:`, error)
      return { role, champions: [] }
    }
  })

  const results = await Promise.all(rolePromises)

  // Build role -> champion IDs mapping and normalize role names
  results.forEach(({ role, champions }) => {
    let displayRole = role

    // Normalize role names for frontend (already standardized)
    const roleMapping = {
      'top': 'top',
      'jungle': 'jungle',
      'middle': 'middle',
      'bottom': 'bottom',
      'support': 'support'
    }

    displayRole = roleMapping[role] || role
    roleData[displayRole] = champions
  })

  console.log('📊 Role containers fetched:', Object.keys(roleData).map(role =>
    `${role}: ${roleData[role].length} champions`
  ).join(', '))

  return roleData
}

/**
 * Fetch champion documents in batches to avoid overwhelming Firestore
 */
async function fetchChampionsInBatches(championIds, batchSize = 10) {
  const batches = []
  for (let i = 0; i < championIds.length; i += batchSize) {
    batches.push(championIds.slice(i, i + batchSize))
  }

  const results = []
  for (const batch of batches) {
    const batchPromises = batch.map(async (championId) => {
      try {
        const docRef = doc(db, 'champions', `all/${championId}`)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          return docSnap.data()
        } else {
          console.warn(`⚠️ Champion document ${championId} not found`)
          return null
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching champion ${championId}:`, error)
        return null
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.filter(Boolean))
  }

  return results
}

/**
 * Check for data updates by monitoring role containers
 */
export async function checkForDataUpdates() {
  try {
    // Check if any role container has been updated recently
    const roleData = await fetchChampionRolesFromContainers()

    // Get the latest update timestamp from role containers
    let latestUpdate = 0
    for (const role of ['top', 'jungle', 'middle', 'bottom', 'support']) {
      try {
        const roleRef = doc(db, 'champions', 'roles', role)
        const roleSnap = await getDoc(roleRef)

        if (roleSnap.exists()) {
          const data = roleSnap.data()
          if (data.lastUpdated) {
            const timestamp = data.lastUpdated.toMillis ? data.lastUpdated.toMillis() : data.lastUpdated
            latestUpdate = Math.max(latestUpdate, timestamp)
          }
        }
      } catch (error) {
        console.warn(`Error checking role ${role} update time:`, error)
      }
    }

    return {
      hasNewData: latestUpdate > 0,
      lastUpdated: latestUpdate,
      roleData
    }
  } catch (error) {
    console.error('Error checking for data updates:', error)
    return { hasNewData: false, lastUpdated: 0, roleData: {} }
  }
}
