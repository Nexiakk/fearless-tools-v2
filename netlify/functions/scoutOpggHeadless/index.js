const axios = require('axios')
const cheerio = require('cheerio')

/**
 * Headless browser scraping using Browserless.io (free tier: 6 hours/month)
 * Alternative: Can use ScrapingBee, ScraperAPI, or other services
 * 
 * Free tier options:
 * - Browserless.io: 6 hours/month free
 * - ScrapingBee: 1000 requests/month free
 * - ScraperAPI: 1000 requests/month free
 */

// Get API key from environment variable (set in Netlify dashboard)
// For Browserless.io: Sign up at https://www.browserless.io/ (free tier available)
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || ''
// Updated endpoint: Browserless.io now uses /scrape for REST API (as of Nov 2025)
// Alternative: Use WebSocket endpoints for Puppeteer/Playwright (wss://production-<region>.browserless.io)
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://chrome.browserless.io/scrape'

// Alternative: ScrapingBee (uncomment to use instead)
// const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ''
// const SCRAPINGBEE_URL = 'https://app.scrapingbee.com/api/v1'

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { playerName, region, tag, championsUrl } = JSON.parse(event.body)
    
    let url = championsUrl
    if (!url.includes('/champions')) {
      url = url.replace(/\/$/, '') + '/champions'
    }

    console.log(`[Headless] Fetching URL: ${url}`)

    // Method 1: Browserless.io (recommended - free tier available)
    let html = null
    if (BROWSERLESS_API_KEY) {
      try {
        console.log('[Headless] Using Browserless.io')
        console.log('[Headless] Endpoint:', BROWSERLESS_URL)
        
        // Try /scrape endpoint first (newer API format)
        // If that doesn't work, fall back to /content (older format)
        let response
        try {
          // New format: /scrape endpoint (as of Nov 2025)
          // Note: This endpoint might return structured data, not raw HTML
          // If it doesn't work, we'll try the old /content endpoint
          response = await axios.post(
            `${BROWSERLESS_URL}?token=${BROWSERLESS_API_KEY}`,
            {
              url: url,
              waitFor: 2000,
              gotoOptions: {
                waitUntil: 'networkidle2',
                timeout: 10000
              }
            },
            {
              timeout: 15000,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
          
          // Check if response is HTML string or structured data
          if (typeof response.data === 'string') {
            html = response.data
            console.log(`[Headless] Successfully fetched HTML (${html.length} chars)`)
          } else {
            // If it's structured data, we might need to extract HTML differently
            // For now, try the old /content endpoint
            console.log('[Headless] /scrape returned structured data, trying /content endpoint')
            throw new Error('Structured data returned, need raw HTML')
          }
        } catch (error) {
          // Fallback to old /content endpoint if /scrape doesn't work
          if (BROWSERLESS_URL.includes('/scrape')) {
            const oldUrl = BROWSERLESS_URL.replace('/scrape', '/content')
            console.log('[Headless] Trying fallback endpoint:', oldUrl)
            try {
              response = await axios.post(
                `${oldUrl}?token=${BROWSERLESS_API_KEY}`,
                {
                  url: url,
                  waitFor: 2000,
                  gotoOptions: {
                    waitUntil: 'networkidle2',
                    timeout: 10000
                  }
                },
                {
                  timeout: 15000,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              )
              html = response.data
              console.log(`[Headless] Successfully fetched HTML via /content (${html.length} chars)`)
            } catch (fallbackError) {
              throw error // Throw original error
            }
          } else {
            throw error
          }
        }
      } catch (error) {
        console.error('[Headless] Browserless.io error:', error.message)
        // Fall through to alternative methods
      }
    }

    // Method 2: ScrapingBee (alternative - uncomment to use)
    /*
    if (!html && SCRAPINGBEE_API_KEY) {
      try {
        console.log('[Headless] Using ScrapingBee')
        const response = await axios.get(SCRAPINGBEE_URL, {
          params: {
            api_key: SCRAPINGBEE_API_KEY,
            url: url,
            render_js: 'true', // Enable JavaScript rendering
            wait: 2000 // Wait 2 seconds
          },
          timeout: 15000
        })
        html = response.data
        console.log(`[Headless] Successfully fetched HTML via ScrapingBee (${html.length} chars)`)
      } catch (error) {
        console.error('[Headless] ScrapingBee error:', error.message)
      }
    }
    */

    // Method 3: Direct axios (fallback - no JavaScript rendering)
    if (!html) {
      console.log('[Headless] Falling back to direct HTTP request (no JS rendering)')
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 8000
        })
        html = response.data
        console.log(`[Headless] Fallback HTML fetched (${html.length} chars)`)
      } catch (error) {
        console.error('[Headless] Fallback error:', error.message)
        throw new Error(`Failed to fetch page: ${error.message}`)
      }
    }

    // Parse HTML with cheerio (same as regular scraper)
    const $ = cheerio.load(html)

    // Try to extract from __NEXT_DATA__ first (most reliable)
    let nextData = null
    const nextDataScript = $('script#__NEXT_DATA__').html()
    if (nextDataScript) {
      try {
        nextData = JSON.parse(nextDataScript)
        console.log(`[Headless] Found __NEXT_DATA__ script tag`)
      } catch (e) {
        console.log(`[Headless] Failed to parse __NEXT_DATA__:`, e.message)
      }
    }

    // Extract champions from __NEXT_DATA__ if available
    if (nextData) {
      const pageProps = nextData?.props?.pageProps
      if (pageProps) {
        const findChampionsRecursive = (obj) => {
          if (typeof obj !== 'object' || obj === null) return null
          if (Array.isArray(obj) && obj.length > 0 && obj[0].championName) return obj
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              if (key.toLowerCase().includes('champion') && Array.isArray(obj[key]) && obj[key].length > 0) {
                if (obj[key].some(item => item.championName || item.name)) {
                  return obj[key]
                }
              }
              const result = findChampionsRecursive(obj[key])
              if (result) return result
            }
          }
          return null
        }

        const championsData = findChampionsRecursive(pageProps)
        if (championsData && Array.isArray(championsData) && championsData.length > 0) {
          console.log(`[Headless] Found ${championsData.length} champions in __NEXT_DATA__`)
          const extractedChampions = championsData.map(champ => {
            const games = champ.games || champ.totalGames || (champ.wins || 0) + (champ.losses || 0)
            const wins = champ.wins || 0
            const losses = champ.losses || 0
            const winrate = champ.winrate || champ.winRate || (games > 0 && wins > 0 ? (wins / games) * 100 : 0)

            const championData = {
              championName: champ.championName || champ.name || champ.champion || '',
              games,
              wins,
              losses,
              winrate
            }

            // Extract optional stats
            if (champ.kda) {
              championData.kda = {
                kills: champ.kda.kills || champ.kda.k || 0,
                deaths: champ.kda.deaths || champ.kda.d || 0,
                assists: champ.kda.assists || champ.kda.a || 0,
                ratio: champ.kda.ratio || 0,
                killParticipation: champ.kda.killParticipation || 0
              }
            }
            if (champ.damage) {
              championData.damage = {
                perMinute: champ.damage.perMinute || 0,
                percentage: champ.damage.percentage || 0
              }
            }
            if (champ.wards) {
              championData.wards = {
                visionScore: champ.wards.visionScore || 0,
                controlWards: champ.wards.controlWards || 0,
                placed: champ.wards.placed || 0,
                killed: champ.wards.killed || 0
              }
            }
            if (champ.cs) {
              championData.cs = {
                total: champ.cs.total || 0,
                perMinute: champ.cs.perMinute || 0
              }
            }
            if (champ.gold) {
              championData.gold = {
                total: champ.gold.total || 0,
                perMinute: champ.gold.perMinute || 0
              }
            }

            return championData
          }).filter(champ => champ.championName && champ.games > 0)

          if (extractedChampions.length > 0) {
            const rankText = pageProps.summoner?.tier || pageProps.tier || pageProps.rank || ''
            const lp = pageProps.summoner?.lp || pageProps.lp || 0

            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                champions: extractedChampions,
                rank: rankText,
                lp,
                lastUpdated: new Date().toISOString(),
                _method: 'headless',
                _source: nextData ? '__NEXT_DATA__' : 'html_parsing'
              })
            }
          }
        }
      }
    }

    // Fallback to HTML parsing (same logic as regular scraper)
    // For now, return error suggesting to use regular scraper
    // In production, you could copy the HTML parsing logic here
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        champions: [],
        rank: '',
        lp: 0,
        lastUpdated: new Date().toISOString(),
        _method: 'headless',
        _source: 'html_parsing',
        _note: 'HTML parsing not implemented in headless mode. Use regular scraper or implement parsing here.'
      })
    }

  } catch (error) {
    console.error('[Headless] Scraping error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to scrape with headless browser',
        message: error.message
      })
    }
  }
}

