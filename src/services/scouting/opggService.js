/**
 * Frontend service for op.gg scraping
 * Calls backend API endpoint (Netlify Function or Firebase Cloud Function)
 * 
 * For Netlify: Functions are at /.netlify/functions/
 * For Firebase: Set VITE_BACKEND_API_URL to your Cloud Function URL
 */

// Default to Netlify Functions (works automatically on Netlify)
// For local dev with Netlify CLI: use '/.netlify/functions'
// For Firebase: set VITE_BACKEND_API_URL in .env
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/.netlify/functions'

export const opggService = {
  /**
   * Scrape op.gg champion stats for a player
   * @param {string} opggUrl - Full op.gg URL
   * @returns {Promise<Object>} Champion pool data
   */
  async scrapePlayerChampions(opggUrl) {
    try {
      // Extract region and player name from URL
      const urlData = this.parseOpggUrl(opggUrl)
      if (!urlData) {
        throw new Error('Invalid op.gg URL')
      }

      // Call backend API
      const response = await fetch(`${BACKEND_API_URL}/scoutOpgg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerName: urlData.playerName,
          region: urlData.region
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }))
        throw new Error(error.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error scraping op.gg:', error)
      throw error
    }
  },

  /**
   * Parse op.gg URL to extract region and player name
   * @param {string} url - op.gg URL
   * @returns {Object|null} { region, playerName } or null
   */
  parseOpggUrl(url) {
    if (!url) return null

    try {
      // op.gg URL format: https://www.op.gg/summoners/{region}/{playerName}
      // or: https://www.op.gg/summoners/{region}/{playerName}/champions
      const match = url.match(/op\.gg\/summoners\/([^/]+)\/([^/?]+)/)
      if (!match) return null

      return {
        region: match[1],
        playerName: decodeURIComponent(match[2])
      }
    } catch (error) {
      console.error('Error parsing op.gg URL:', error)
      return null
    }
  }
}

