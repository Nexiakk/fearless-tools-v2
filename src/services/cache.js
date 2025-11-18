// IndexedDB Caching Service using localForage
import localforage from 'localforage'

// Initialize localForage instance
const cacheInstance = localforage.createInstance({
  name: 'fearless-tools',
  storeName: 'champion-cache',
  description: 'Champion data cache for fearless-tools'
})

export const cacheService = {
  // Check if cache is available
  isAvailable() {
    return cacheInstance !== null
  },

  // Get cache key for workspace
  getCacheKey(workspaceId, version = null) {
    if (version) {
      return `champions_${workspaceId}_v${version}`
    }
    return `champions_${workspaceId}`
  },

  // Get cached champion data
  async getCachedChampions(workspaceId) {
    if (!workspaceId) {
      return null
    }

    try {
      // Try to find the latest version
      const keys = await cacheInstance.keys()
      const workspaceKeys = keys.filter(key => key.startsWith(`champions_${workspaceId}_v`))

      if (workspaceKeys.length === 0) {
        return null
      }

      // Get the most recent version (highest version number)
      const versions = workspaceKeys
        .map(key => {
          const match = key.match(/champions_\w+_v(\d+)/)
          return match ? parseInt(match[1], 10) : 0
        })
        .sort((a, b) => b - a)

      if (versions.length === 0) {
        return null
      }

      const latestVersion = versions[0]
      const cacheKey = this.getCacheKey(workspaceId, latestVersion)
      const cached = await cacheInstance.getItem(cacheKey)

      if (cached && cached.data && cached.version) {
        // Check if cache is still valid (24 hours)
        const cacheAge = Date.now() - cached.version
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (cacheAge < maxAge) {
          return cached.data
        } else {
          console.log('Cache expired, will refresh from Firestore')
          return cached.data
        }
      }

      return null
    } catch (error) {
      console.error('Error reading from cache:', error)
      return null
    }
  },

  // Cache champion data
  async cacheChampions(workspaceId, championData, version) {
    if (!workspaceId || !championData) {
      return false
    }

    try {
      const cacheKey = this.getCacheKey(workspaceId, version)
      const cacheData = {
        data: championData,
        version: version || Date.now(),
        workspaceId: workspaceId,
        cachedAt: Date.now()
      }

      await cacheInstance.setItem(cacheKey, cacheData)

      // Clean up old versions (keep only the latest 3 versions)
      const keys = await cacheInstance.keys()
      const workspaceKeys = keys.filter(key => key.startsWith(`champions_${workspaceId}_v`))

      if (workspaceKeys.length > 3) {
        const versions = workspaceKeys
          .map(key => {
            const match = key.match(/champions_\w+_v(\d+)/)
            return { key, version: match ? parseInt(match[1], 10) : 0 }
          })
          .sort((a, b) => b.version - a.version)

        // Delete all but the latest 3
        for (let i = 3; i < versions.length; i++) {
          await cacheInstance.removeItem(versions[i].key)
        }
      }

      return true
    } catch (error) {
      console.error('Error caching champions:', error)
      return false
    }
  },

  // Invalidate cache for a workspace
  async invalidateCache(workspaceId) {
    if (!workspaceId) {
      return
    }

    try {
      const keys = await cacheInstance.keys()
      const workspaceKeys = keys.filter(key => key.startsWith(`champions_${workspaceId}`))

      for (const key of workspaceKeys) {
        await cacheInstance.removeItem(key)
      }
    } catch (error) {
      console.error('Error invalidating cache:', error)
    }
  },

  // Clear all cache
  async clearAllCache() {
    try {
      console.log('Clearing all IndexedDB cache...')
      await cacheInstance.clear()
      console.log('✓ All IndexedDB cache cleared')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  },

  // Get cached metadata
  async getCachedMetadata(key) {
    if (!key) {
      return null
    }

    try {
      const cached = await cacheInstance.getItem(key)
      if (cached && cached.data) {
        return cached.data
      }
      return null
    } catch (error) {
      console.error('Error reading metadata from cache:', error)
      return null
    }
  },

  // Cache metadata
  async cacheMetadata(key, metadata) {
    if (!key || !metadata) {
      return false
    }

    try {
      const cacheData = {
        data: metadata,
        cachedAt: Date.now()
      }
      await cacheInstance.setItem(key, cacheData)
      return true
    } catch (error) {
      console.error('Error caching metadata:', error)
      return false
    }
  },

  // Remove cached metadata
  async removeMetadata(key) {
    if (!key) {
      return
    }

    try {
      await cacheInstance.removeItem(key)
    } catch (error) {
      console.error('Error removing metadata:', error)
    }
  }
}

