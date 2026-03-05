// Champion Data Service using Turso (replaces Firebase version)
import { createClient } from '@libsql/client'

// Use readonly token from env, or connect directly if allowed
const dbUrl = import.meta.env.VITE_TURSO_DB_URL || 'https://lol-champion-data-mietek.aws-eu-west-1.turso.io'
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN_RO || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3NzI3MzcwMzksImlkIjoiMDE5Y2JmNWItNmIwMS03YWVmLWJlOTktM2ZjZmVmNjg1NTA4IiwicmlkIjoiM2M5MTMyMGEtZWU2YS00ZGNlLWFiYjItMDU1NWRiOTdmYzBiIn0.3WEZhuu5mn9TYMvDnvBpN2Uef8tfRp_Yz7uIiDUtPQ0Z6KbvAgwdAsOlY68GRyOo8wA9yCf9K7U_QXtqOH5VAg'

const turso = createClient({
  url: dbUrl,
  authToken: authToken,
})

/**
 * Fetch champion data from Turso
 */
export async function fetchChampionDataFromFirestore(workspaceId) {
  try {
    console.log(`Fetching all champions from Turso`)
    
    // We only need basic champion info here, not full json payloads 
    // depending on where this is used. For now, fetch all.
    const rs = await turso.execute('SELECT * FROM champions')
    
    const champions = rs.rows.map(row => {
      const roles = row.roles_json ? JSON.parse(row.roles_json) : {}
      const roleKeys = Object.keys(roles)
      
      const normalized = {
        id: row.id,
        name: row.name,
        imageName: row.image_name,
        patch: row.patch,
        roles: roleKeys, // map object keys to array for basic display
        mainRole: roleKeys.length > 0 ? roleKeys[0] : null,
      }
      return normalized
    })

    console.log(`Fetched ${champions.length} champions from Turso database`)

    // Get current version/info
    const infoRs = await turso.execute("SELECT abilities_last_updated FROM global_info WHERE id = 'data'")
    let lastUpdated = Date.now()
    if (infoRs.rows.length > 0 && infoRs.rows[0].abilities_last_updated) {
       lastUpdated = new Date(infoRs.rows[0].abilities_last_updated).getTime()
    }

    return {
      allChampions: champions,
      opTierChampions: {},
      version: lastUpdated,
      lastUpdated: new Date(lastUpdated)
    }
  } catch (error) {
    console.error('Error fetching champion data from Turso:', error)
    return null
  }
}

/**
 * Dummy function since frontend shouldn't save globally anymore directly
 */
export async function saveChampionDataToFirestore(workspaceId, allChampions, opTierChampions) {
  console.warn("Saving champion data from frontend is disabled. Use Python scraper.")
  return { success: false, error: 'Disabled in Turso migration' }
}

/**
 * Dummy function for migration
 */
export async function migrateChampionDataToFirestore(workspaceId, allChampions, opTierChampions) {
  console.warn("Migration from frontend is disabled.")
  return { success: false, error: 'Disabled in Turso migration' }
}

export async function fetchChampionDetailsFromTurso(championId) {
  try {
    const rs = await turso.execute({
      sql: 'SELECT roles_json, abilities_json FROM champions WHERE id = ?',
      args: [championId]
    })
    
    if (rs.rows.length > 0) {
      const row = rs.rows[0]
      return {
        roles: row.roles_json ? JSON.parse(row.roles_json) : null,
        abilities: row.abilities_json ? JSON.parse(row.abilities_json) : null
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching champion details from Turso:', error)
    return null
  }
}

/**
 * EFFICIENT SYSTEM: Fetch champions using role containers only
 */
export async function fetchChampionsFromIndividualDocs() {
  try {
    console.log('🔄 Fetching champions from role containers (Turso)...')

    // Import Riot API service dynamically to avoid circular dependency
    const { riotApiService } = await import('@/services/riotApi')

    // Get role containers to know which champions exist and their roles
    const roleData = await fetchChampionRolesFromContainers()

    // Flatten all champion IDs and create role mappings
    const championRoleMap = new Map()
    Object.entries(roleData).forEach(([role, championIds]) => {
      championIds.forEach(championId => {
        if (!championRoleMap.has(championId)) {
          championRoleMap.set(championId, [])
        }
        championRoleMap.get(championId).push(role)
      })
    })

    const allChampionIds = Array.from(championRoleMap.keys())

    console.log(`📋 Found ${allChampionIds.length} champions across all roles`)

    if (allChampionIds.length === 0) {
      console.error('❌ No champions found in role containers - database may be empty or corrupted')
      throw new Error('No champions found in role containers')
    }

    // Get current patch version first
    console.log('🌐 Getting current patch version...')
    const currentPatchVersion = await riotApiService.getLatestPatchVersionWithRetry()

    // Get Riot API data to merge image information
    console.log(`🌐 Fetching Riot API data for patch ${currentPatchVersion}...`)
    const riotChampions = await riotApiService.getChampionDataCached(currentPatchVersion)

    // Create a map of imageName -> riot data for quick lookup
    const riotDataMap = {}
    riotChampions.forEach(champion => {
      if (champion.imageName) {
        riotDataMap[champion.imageName] = champion
      }
    })

    // Create champion objects directly from role data and merge with Riot API data
    const normalizedChampions = allChampionIds.map(championId => {
      const roles = championRoleMap.get(championId) || []
      const mainRole = roles.length > 0 ? roles[0] : null

      // Merge with Riot API data for image information
      const riotData = riotDataMap[championId] // championId is the internal name like "KSante"
      if (riotData) {
        return {
          id: championId,
          name: riotData.name, // Use proper display name
          imageName: riotData.imageName,
          roles: roles,
          mainRole: mainRole
        }
      } else {
        console.warn(`⚠️ No Riot API data found for champion ${championId}`)
        // Fallback values
        return {
          id: championId,
          name: championId, // Fallback to ID as name
          imageName: championId, // Fallback to ID as imageName
          roles: roles,
          mainRole: mainRole
        }
      }
    })

    console.log(`✅ Successfully fetched ${normalizedChampions.length} champions from role containers`)

    return {
      allChampions: normalizedChampions,
      opTierChampions: {}, // OP tier detection not implemented yet mapping
      version: Date.now(), // Use current timestamp as version
      lastUpdated: new Date()
    }

  } catch (error) {
    console.error('❌ Error fetching champions from role containers:', error)
    throw error 
  }
}

/**
 * Fetch role data from Turso role_containers table
 */
export async function fetchChampionRolesFromContainers() {
  try {
    const rs = await turso.execute("SELECT role, champion_ids_json FROM role_containers")
    
    if (rs.rows.length > 0) {
      const roleData = {
        top: [], jungle: [], middle: [], bottom: [], support: []
      }
      
      rs.rows.forEach(row => {
        const role = row.role
        const championIds = row.champion_ids_json ? JSON.parse(row.champion_ids_json) : []
        if (roleData[role] !== undefined) {
           roleData[role] = championIds
        }
      })

      console.log('📊 Role containers fetched:', Object.keys(roleData).map(role =>
        `${role}: ${roleData[role].length} champions`
      ).join(', '))

      return roleData
    } else {
      console.warn('⚠️ No data found in role_containers')
      return {
        top: [], jungle: [], middle: [], bottom: [], support: []
      }
    }
  } catch (error) {
    console.warn('⚠️ Error fetching role containers:', error)
    return {
      top: [], jungle: [], middle: [], bottom: [], support: []
    }
  }
}

/**
 * Wait for batching logic. In Turso, we can just fetch all in one query.
 */
async function fetchChampionsInBatches(championIds, batchSize = 10) {
    console.warn("fetchChampionsInBatches is deprecated with Turso. Use direct query.")
    return []
}

/**
 * Check for data updates by monitoring global_info
 */
export async function checkForDataUpdates() {
  try {
    const roleData = await fetchChampionRolesFromContainers()

    let latestUpdate = 0
    try {
      const infoRs = await turso.execute("SELECT abilities_last_updated FROM global_info WHERE id = 'data'")
      if (infoRs.rows.length > 0 && infoRs.rows[0].abilities_last_updated) {
         latestUpdate = new Date(infoRs.rows[0].abilities_last_updated).getTime()
      }
    } catch (error) {
      console.warn('Error checking data update time:', error)
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
