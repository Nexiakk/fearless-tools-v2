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
   * @param {boolean} useHeadless - Use headless browser (slower but more reliable)
   * @returns {Promise<Object>} Champion pool data
   */
  async scrapePlayerChampions(opggUrl, useHeadless = false) {
    try {
      // Extract region and player name from URL
      const urlData = this.parseOpggUrl(opggUrl)
      if (!urlData) {
        throw new Error('Invalid op.gg URL')
      }

      // Call backend API with full champions URL
      // Use headless endpoint if requested, otherwise use regular endpoint
      const endpoint = useHeadless ? 'scoutOpggHeadless' : 'scoutOpgg'
      const apiUrl = `${BACKEND_API_URL}/${endpoint}`
      console.log('[op.gg] Calling API:', apiUrl, useHeadless ? '(headless)' : '(regular)')
      console.log('[op.gg] Request data:', { playerName: urlData.playerName, region: urlData.region, tag: urlData.tag, championsUrl: urlData.fullUrl, useHeadless })
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerName: urlData.playerName,
          region: urlData.region,
          tag: urlData.tag,
          championsUrl: urlData.fullUrl
        })
      })

      console.log('[op.gg] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[op.gg] Error response:', errorText)
        let error
        try {
          error = JSON.parse(errorText)
        } catch (e) {
          error = { message: errorText || `HTTP error! status: ${response.status}` }
        }
        throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('[op.gg] Success, received data:', data)
      console.log('[op.gg] Champions array:', data.champions)
      console.log('[op.gg] Champions count:', data.champions?.length || 0)
      console.log('[op.gg] Full response structure:', JSON.stringify(data, null, 2))
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
      // New op.gg URL formats:
      // 1. https://op.gg/{language}/lol/summoners/{region}/{playerName}-{tag}
      // 2. https://op.gg/lol/summoners/{region}/{playerName}-{tag} (no language code)
      // 3. https://op.gg/summoners/{region}/{playerName} (old format)
      // All can have /champions at the end
      
      // Try new format with optional language code
      // Pattern: op.gg/(optional language)/lol/summoners/(region)/(playerName-tag)
      const newFormatMatch = url.match(/op\.gg\/(?:([^/]+)\/)?lol\/summoners\/([^/]+)\/([^/?]+)/)
      if (newFormatMatch) {
        const languageCode = newFormatMatch[1] // e.g., 'pl', 'de', 'en', or undefined
        const region = newFormatMatch[2]
        const fullName = decodeURIComponent(newFormatMatch[3])
        // Check if it has a tag (format: "playerName-tag")
        const nameParts = fullName.split('-')
        const playerName = nameParts.slice(0, -1).join('-') // Everything except last part
        const tag = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null
        
        // Build champions URL - normalize to /en/ localization for consistency
        // Replace any language code with 'en', or add /en/ if no language code exists
        let baseUrl = url.includes('/champions') ? url : `${url.replace(/\/$/, '')}/champions`
        // Remove existing language code and replace with /en/
        baseUrl = baseUrl.replace(/op\.gg\/[^/]+\/lol/, 'op.gg/en/lol')
        // If no language code was present, add /en/
        if (!baseUrl.includes('/en/lol') && !baseUrl.includes('/pl/lol') && !baseUrl.includes('/de/lol')) {
          baseUrl = baseUrl.replace(/op\.gg\/lol/, 'op.gg/en/lol')
        }
        
        let championsUrl = baseUrl
        // Add query parameter if not already present
        if (!championsUrl.includes('queue_type=')) {
          championsUrl += championsUrl.includes('?') ? '&queue_type=SOLORANKED' : '?queue_type=SOLORANKED'
        }
        
        return {
          region: region,
          playerName: playerName,
          tag: tag,
          fullUrl: championsUrl
        }
      }
      
      // Fallback to old format (www.op.gg/summoners/...)
      const oldFormatMatch = url.match(/op\.gg\/summoners\/([^/]+)\/([^/?]+)/)
      if (oldFormatMatch) {
        const playerName = decodeURIComponent(oldFormatMatch[2])
        // Build champions URL - normalize to /en/ localization
        let baseUrl = url.includes('/champions') ? url : `${url.replace(/\/$/, '')}/champions`
        // Add /en/ localization if not present
        if (!baseUrl.includes('/en/') && !baseUrl.includes('/pl/') && !baseUrl.includes('/de/')) {
          baseUrl = baseUrl.replace(/op\.gg\//, 'op.gg/en/')
        } else {
          // Replace any existing localization with /en/
          baseUrl = baseUrl.replace(/op\.gg\/[^/]+\//, 'op.gg/en/')
        }
        
        let championsUrl = baseUrl
        // Add query parameter if not already present
        if (!championsUrl.includes('queue_type=')) {
          championsUrl += championsUrl.includes('?') ? '&queue_type=SOLORANKED' : '?queue_type=SOLORANKED'
        }
        
        return {
          region: oldFormatMatch[1],
          playerName: playerName,
          tag: null,
          fullUrl: championsUrl
        }
      }
      
      console.error('[op.gg] URL did not match any known format:', url)
      return null
    } catch (error) {
      console.error('Error parsing op.gg URL:', error)
      return null
    }
  }
}

