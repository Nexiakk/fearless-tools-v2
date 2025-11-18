/**
 * Frontend service for Leaguepedia API
 * Calls Netlify Function (backend) to avoid browser compatibility issues with poro
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
      const response = await fetch(`${BACKEND_API_URL}/leaguepedia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'getChampionPool',
          playerName
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Leaguepedia API error (getPlayerChampionPool):', error)
      throw error
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
          playerName
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
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
          playerName,
          limit
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Leaguepedia API error (getRecentMatches):', error)
      throw error
    }
  }
}

