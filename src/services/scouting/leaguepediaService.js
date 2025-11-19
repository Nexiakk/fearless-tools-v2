/**
 * Frontend service for Leaguepedia API
 * Calls backend API endpoint (Netlify Function) to avoid CORS issues
 * 
 * For Netlify: Functions are at /.netlify/functions/
 * For local dev with Netlify CLI: use '/.netlify/functions'
 */
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/.netlify/functions'

export const leaguepediaService = {
  /**
   * Get player's champion pool from pro play
   * @param {string} playerName - Player's name on Leaguepedia
   * @returns {Promise<Array>} Array of champion play data
   */
  async getPlayerChampionPool(playerName) {
    try {
      const apiUrl = `${BACKEND_API_URL}/leaguepedia`
      console.log('[Leaguepedia] Calling API:', apiUrl, 'for player:', playerName)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getPlayerChampionPool',
          params: { playerName }
        })
      })

      console.log('[Leaguepedia] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Leaguepedia] Error response:', errorText)
        let error
        try {
          error = JSON.parse(errorText)
        } catch (e) {
          error = { message: errorText || `HTTP error! status: ${response.status}` }
        }
        throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('[Leaguepedia] Success, received data:', result)
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      return []
    } catch (error) {
      console.error('Leaguepedia API error (getPlayerChampionPool):', error)
      // Return empty array instead of throwing to allow op.gg data to still work
      return []
    }
  },

  /**
   * Get player information from Leaguepedia
   * @param {string} playerName - Player's name on Leaguepedia
   * @returns {Promise<Object|null>} Player info or null if not found
   */
  async getPlayerInfo(playerName) {
    try {
      const response = await fetch(`${BACKEND_API_URL}/leaguepedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getPlayerInfo',
          params: { playerName }
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        return result.data
      }
      return null
    } catch (error) {
      console.error('Leaguepedia API error (getPlayerInfo):', error)
      throw error
    }
  },

  /**
   * Get recent pro matches for a player
   * @param {string} playerName - Player's name on Leaguepedia
   * @param {number} limit - Number of matches to return (default: 20)
   * @returns {Promise<Array>} Array of recent matches
   */
  async getRecentMatches(playerName, limit = 20) {
    try {
      const response = await fetch(`${BACKEND_API_URL}/leaguepedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getRecentMatches',
          params: { playerName, limit }
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      return []
    } catch (error) {
      console.error('Leaguepedia API error (getRecentMatches):', error)
      throw error
    }
  },

  /**
   * Search for players by name (fuzzy search)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching players
   */
  async searchPlayers(searchTerm) {
    try {
      const response = await fetch(`${BACKEND_API_URL}/leaguepedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'searchPlayers',
          params: { searchTerm }
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      return []
    } catch (error) {
      console.error('Leaguepedia API error (searchPlayers):', error)
      throw error
    }
  }
}

