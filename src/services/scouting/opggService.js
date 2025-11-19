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

      // Call backend API with full champions URL
      const response = await fetch(`${BACKEND_API_URL}/scoutOpgg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerName: urlData.playerName,
          region: urlData.region,
          tag: urlData.tag,
          championsUrl: urlData.fullUrl // Send the full champions URL to backend
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
   * @returns {Object|null} { region, playerName, tag, fullUrl } or null
   */
  parseOpggUrl(url) {
    if (!url) return null

    try {
      // New op.gg URL format: https://op.gg/{language}/lol/summoners/{region}/{playerName}-{tag}
      // or: https://op.gg/{language}/lol/summoners/{region}/{playerName}-{tag}/champions
      // Old format (still supported): https://www.op.gg/summoners/{region}/{playerName}
      
      // Try new format first
      const newFormatMatch = url.match(/op\.gg\/[^/]+\/lol\/summoners\/([^/]+)\/([^/?]+)/)
      if (newFormatMatch) {
        const fullName = decodeURIComponent(newFormatMatch[2])
        // Check if it has a tag (format: "playerName-tag")
        const nameParts = fullName.split('-')
        const playerName = nameParts.slice(0, -1).join('-') // Everything except last part
        const tag = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null
        
        // Build champions URL
        const championsUrl = url.includes('/champions') ? url : `${url.replace(/\/$/, '')}/champions`
        
        return {
          region: newFormatMatch[1],
          playerName: playerName,
          tag: tag,
          fullUrl: championsUrl
        }
      }
      
      // Fallback to old format
      const oldFormatMatch = url.match(/op\.gg\/summoners\/([^/]+)\/([^/?]+)/)
      if (oldFormatMatch) {
        const playerName = decodeURIComponent(oldFormatMatch[2])
        const championsUrl = url.includes('/champions') ? url : `${url.replace(/\/$/, '')}/champions`
        
        return {
          region: oldFormatMatch[1],
          playerName: playerName,
          tag: null,
          fullUrl: championsUrl
        }
      }
      
      return null
    } catch (error) {
      console.error('Error parsing op.gg URL:', error)
      return null
    }
  }
}

