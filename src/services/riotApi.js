// Riot Data Dragon API Service
const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const CHAMPION_DATA_BASE_URL = 'https://ddragon.leagueoflegends.com/cdn'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second base delay

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
  }
}

