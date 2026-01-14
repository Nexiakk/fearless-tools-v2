// Riot Data Dragon API Service
const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const CHAMPION_DATA_BASE_URL = 'https://ddragon.leagueoflegends.com/cdn'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second base delay

// Global cache for Riot API data
const riotDataCache = {
  patchVersion: null,
  championData: null,
  lastFetched: null,
  isLoading: false
}

export const riotApiService = {
  /**
   * Fetch latest patch version from Riot API
   */
  async getLatestPatchVersion() {
    try {
      const response = await fetch(VERSIONS_URL)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const versions = await response.json()
      if (!Array.isArray(versions) || versions.length === 0) {
        throw new Error('Invalid versions response from API')
      }
      return versions[0] // First version is the latest
    } catch (error) {
      console.error('Error fetching latest patch version:', error)
      throw error
    }
  },

  /**
   * Fetch latest patch version with retry logic
   */
  async getLatestPatchVersionWithRetry(retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.getLatestPatchVersion()
      } catch (error) {
        if (i === retries - 1) {
          throw error // Last retry failed
        }
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, i)
        console.warn(`Retry ${i + 1}/${retries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  },

  /**
   * Fetch champion data for a specific patch version
   */
  async getChampionData(patchVersion) {
    if (!patchVersion) {
      throw new Error('Patch version is required')
    }

    try {
      const url = `${CHAMPION_DATA_BASE_URL}/${patchVersion}/data/en_US/champion.json`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data || !data.data || typeof data.data !== 'object') {
        throw new Error('Invalid champion data response from API')
      }

      // Transform Riot API format to our format
      return this.transformChampionData(data.data)
    } catch (error) {
      console.error(`Error fetching champion data for patch ${patchVersion}:`, error)
      throw error
    }
  },

  /**
   * Fetch champion data with retry logic
   */
  async getChampionDataWithRetry(patchVersion, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.getChampionData(patchVersion)
      } catch (error) {
        if (i === retries - 1) {
          throw error // Last retry failed
        }
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, i)
        console.warn(`Retry ${i + 1}/${retries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  },

  /**
   * Transform Riot API champion data to our internal format
   */
  transformChampionData(riotChampions) {
    const champions = []

    for (const [championId, championData] of Object.entries(riotChampions)) {
      try {
        // Extract image name (remove .png extension)
        const imageName = championData.image?.full?.replace('.png', '') || championId

        // Parse key as integer ID
        const id = parseInt(championData.key, 10) || null

        // Create champion object in our format
        const champion = {
          id: id,
          name: championData.name || championId,
          imageName: imageName,
          // roles and mainRole will be merged from database
          roles: [],
          mainRole: null
        }

        champions.push(champion)
      } catch (error) {
        console.warn(`Error transforming champion ${championId}:`, error)
      }
    }

    // Sort by name for consistency
    champions.sort((a, b) => a.name.localeCompare(b.name))

    return champions
  },

  /**
   * Get champion icon URL
   */
  getChampionIconUrl(imageName, patchVersion) {
    if (!imageName || !patchVersion) {
      return null
    }
    return `${CHAMPION_DATA_BASE_URL}/${patchVersion}/img/champion/${imageName}.png`
  },

  /**
   * Validate patch version format
   */
  isValidPatchVersion(version) {
    if (!version || typeof version !== 'string') {
      return false
    }
    // Format: X.Y.Z (e.g., "15.22.1")
    const pattern = /^\d+\.\d+\.\d+$/
    return pattern.test(version)
  },

  /**
   * Fetch specific champions by their IDs (uses cached data)
   */
  async getChampionsByIds(championIds, patchVersion) {
    if (!Array.isArray(championIds) || championIds.length === 0) {
      return {}
    }

    if (!patchVersion) {
      throw new Error('Patch version is required')
    }

    try {
      // Get champion data from cache (will fetch if not cached)
      const allChampions = await this.getChampionDataCached(patchVersion)

      // Filter to only the requested champion IDs
      const championMap = {}
      allChampions.forEach(champion => {
        if (championIds.includes(champion.id)) {
          championMap[champion.id] = champion
        }
      })

      return championMap
    } catch (error) {
      console.error('Error fetching champions by IDs:', error)
      throw error
    }
  },

  /**
   * Get champion icon URL with fallback
   */
  getChampionIconUrl(imageName, patchVersion) {
    if (!imageName || !patchVersion) {
      return '/assets/icons/no_champion.png' // Fallback to local placeholder
    }
    return `${CHAMPION_DATA_BASE_URL}/${patchVersion}/img/champion/${imageName}.png`
  },

  /**
   * Compare two patch versions
   */
  compareVersions(version1, version2) {
    if (!this.isValidPatchVersion(version1) || !this.isValidPatchVersion(version2)) {
      return 0 // Invalid versions, consider equal
    }

    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0

      if (v1Part < v2Part) return -1
      if (v1Part > v2Part) return 1
    }

    return 0 // Versions are equal
  },

  /**
   * Check if cached data is valid for a patch version
   */
  isCacheValid(patchVersion) {
    if (!riotDataCache.championData ||
        !riotDataCache.patchVersion ||
        !riotDataCache.lastFetched) {
      return false
    }

    // Check if patch version matches
    if (riotDataCache.patchVersion !== patchVersion) {
      return false
    }

    // Check if cache is older than 7 days
    const cacheAge = Date.now() - riotDataCache.lastFetched
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

    return cacheAge < maxAge
  },

  /**
   * Get cached champion data for a patch version
   */
  getCachedChampionData(patchVersion) {
    if (this.isCacheValid(patchVersion)) {
      console.log(`✅ Using cached Riot API data for patch ${patchVersion}`)
      return riotDataCache.championData
    }

    console.log(`⚠️ Cache miss for patch ${patchVersion}`)
    return null
  },

  /**
   * Cache champion data for a patch version
   */
  setCachedChampionData(patchVersion, championData) {
    riotDataCache.patchVersion = patchVersion
    riotDataCache.championData = championData
    riotDataCache.lastFetched = Date.now()
    console.log(`💾 Cached Riot API data for patch ${patchVersion}`)
  },

  /**
   * Clear the cache
   */
  clearCache() {
    riotDataCache.patchVersion = null
    riotDataCache.championData = null
    riotDataCache.lastFetched = null
    riotDataCache.isLoading = false
    console.log('🗑️ Cleared Riot API cache')
  },

  /**
   * Pre-load and cache champion data for the current patch
   */
  async preloadChampionData(patchVersion) {
    if (!patchVersion) {
      throw new Error('Patch version is required for preloading')
    }

    // Check if already cached and valid
    if (this.isCacheValid(patchVersion)) {
      console.log(`✅ Champion data already cached for patch ${patchVersion}`)
      return riotDataCache.championData
    }

    // Check if already loading
    if (riotDataCache.isLoading) {
      console.log('⏳ Champion data already loading, waiting...')
      // Wait for loading to complete (simple polling)
      let attempts = 0
      while (riotDataCache.isLoading && attempts < 50) { // Max 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (this.isCacheValid(patchVersion)) {
        return riotDataCache.championData
      }
    }

    // Start loading
    riotDataCache.isLoading = true

    try {
      console.log(`🌐 Pre-loading champion data for patch ${patchVersion}...`)
      const championData = await this.getChampionDataWithRetry(patchVersion)
      this.setCachedChampionData(patchVersion, championData)
      return championData
    } catch (error) {
      console.error('❌ Failed to preload champion data:', error)
      throw error
    } finally {
      riotDataCache.isLoading = false
    }
  },

  /**
   * Get champion data with caching (preferred method)
   */
  async getChampionDataCached(patchVersion) {
    if (!patchVersion) {
      throw new Error('Patch version is required')
    }

    // Try cache first
    const cached = this.getCachedChampionData(patchVersion)
    if (cached) {
      return cached
    }

    // Cache miss - fetch and cache
    console.log(`🌐 Fetching fresh champion data for patch ${patchVersion}...`)
    const championData = await this.getChampionDataWithRetry(patchVersion)
    this.setCachedChampionData(patchVersion, championData)
    return championData
  }
}
