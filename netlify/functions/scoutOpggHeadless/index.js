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

    // Fallback to HTML parsing - SIMPLIFIED for headless browser
    // Headless browser gets properly rendered HTML, so we can trust the structure more
    console.log(`[Headless] No champion data found in __NEXT_DATA__, falling back to HTML parsing`)
    
    const champions = []
    
    // Find main champion table (simplified - headless should have consistent structure)
    let mainTable = $('table').not('[class*="matchup"]').filter((i, table) => {
      const $table = $(table)
      const rows = $table.find('tbody tr, tr').not('thead tr')
      return rows.filter((j, row) => $(row).find('img[alt]').length > 0).length >= 2
    }).first()
    
    // Get champion rows (simplified filtering)
    let championRows = $()
    if (mainTable.length > 0) {
      championRows = mainTable.find('tbody tr, tr').not('thead tr')
    } else {
      championRows = $('table tbody tr').filter((i, row) => {
        return $(row).find('img[alt]').length > 0 && !$(row).closest('[class*="matchup"]').length
      })
    }
    
    // Skip summary row if present
    const firstRow = championRows.first()
    if (firstRow.length && firstRow.text().toLowerCase().includes('all champions')) {
      championRows = championRows.slice(1)
    }
    
    // Filter out matchup rows
    championRows = championRows.filter((i, elem) => {
      const $row = $(elem)
      return $row.find('img[alt]').length > 0 && 
             !$row.closest('[class*="matchup"]').length &&
             /\d+/.test($row.text())
    })
    
    console.log(`[Headless] Found ${championRows.length} champion rows to process`)
    
    // Process each champion row (using the same extraction logic as regular scraper)
    championRows.each((i, elem) => {
      const $row = $(elem)
      const fullRowText = $row.text()
      
      let championName = ''
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      let damage = null
      let wards = null
      let cs = null
      let gold = null
      
      if ($row.is('tr')) {
        const directCells = $row.children('td')
        
        // Extract champion name from cell 1
        if (directCells.length > 1) {
          const nameCell = $(directCells[1])
          const imgAlt = nameCell.find('img[alt]').first().attr('alt') || ''
          if (imgAlt) {
            championName = imgAlt.trim()
          }
          if (!championName) {
            championName = nameCell.find('strong').first().text().trim()
          }
          if (!championName) {
            const $cellClone = nameCell.clone()
            $cellClone.find('table, [class*="matchup"]').remove()
            championName = $cellClone.text().trim()
          }
          championName = championName.replace(/['"]/g, '').trim()
        }
        
        if (!championName || championName.length < 2) {
          return
        }
        
        // Extract wins/losses from cell 2
        if (directCells.length > 2) {
          const $cell = $(directCells[2])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          const winsLossesMatch = cellText.match(/(\d+)\s*W\s+(\d+)\s*[LP]\b/i)
          if (winsLossesMatch) {
            wins = parseInt(winsLossesMatch[1])
            losses = parseInt(winsLossesMatch[2])
            games = wins + losses
          }
          const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
          if (winrateMatch) {
            winrate = parseFloat(winrateMatch[1])
          }
        }
        
        // Extract KDA from cell 3
        if (directCells.length > 3) {
          const $cell = $(directCells[3])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          const ratioMatch = cellText.match(/(\d+\.?\d*)\s*:\s*1(?:\s|$)/)
          let kdaMatch = null
          if (ratioMatch) {
            const ratioEnd = cellText.indexOf(ratioMatch[0]) + ratioMatch[0].length
            const afterRatio = cellText.substring(ratioEnd).trim()
            kdaMatch = afterRatio.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
          } else {
            kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
          }
          const kpMatch = cellText.match(/\((\d+\.?\d*)\s*%\)/)
          if (kdaMatch) {
            kda = {
              kills: parseFloat(kdaMatch[1]),
              deaths: parseFloat(kdaMatch[2]),
              assists: parseFloat(kdaMatch[3])
            }
            if (ratioMatch) kda.ratio = parseFloat(ratioMatch[1])
            if (kpMatch) kda.killParticipation = parseFloat(kpMatch[1])
          }
        }
        
        // Extract damage from cell 6
        if (directCells.length > 6) {
          const $cell = $(directCells[6])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          const dmgMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m\s+(\d+\.?\d*)\s*%/i)
          if (dmgMatch) {
            damage = {
              perMinute: parseFloat(dmgMatch[1]),
              percentage: parseFloat(dmgMatch[2])
            }
          }
        }
        
        // Extract wards from cell 7
        // Headless browser should have proper spacing, so simpler patterns work
        if (directCells.length > 7) {
          const $cell = $(directCells[7])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          // Pattern 1: "15 1 (16/4)" = vision score, control wards, (placed/killed)
          let wardsMatch = cellText.match(/(\d+)\s+(\d+)\s+\((\d+)\s*\/\s*(\d+)\)/)
          if (wardsMatch) {
            wards = {
              visionScore: parseFloat(wardsMatch[1]),
              controlWards: parseFloat(wardsMatch[2]),
              placed: parseFloat(wardsMatch[3]),
              killed: parseFloat(wardsMatch[4])
            }
          } else {
            // Pattern 2: "244 (16/4)" = vision score only, (placed/killed)
            wardsMatch = cellText.match(/(\d+)\s+\((\d+)\s*\/\s*(\d+)\)/)
            if (wardsMatch) {
              wards = {
                visionScore: parseFloat(wardsMatch[1]),
                controlWards: 0,
                placed: parseFloat(wardsMatch[2]),
                killed: parseFloat(wardsMatch[3])
              }
            }
          }
        }
        
        // Extract CS from cell 8
        // Headless browser should have proper spacing: "226 8.6/m" or "98 8.6/m"
        if (directCells.length > 8) {
          const $cell = $(directCells[8])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          // Standard format: "226 8.6/m" = total and per minute
          const csMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
          if (csMatch) {
            cs = {
              total: parseFloat(csMatch[1].replace(/,/g, '')),
              perMinute: parseFloat(csMatch[2])
            }
          } else {
            // Fallback: only per minute "8.6/m" (no total)
            const perMinMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m/i)
            if (perMinMatch) {
              const perMin = parseFloat(perMinMatch[1])
              if (perMin <= 30) { // Reasonable per minute value
                cs = { total: 0, perMinute: perMin }
              }
            }
          }
        }
        
        // Extract gold from cell 9
        // Headless browser should have proper spacing: "12,898 489.1/m"
        if (directCells.length > 9) {
          const $cell = $(directCells[9])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          // Standard format: "12,898 489.1/m" = total and per minute
          const goldMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
          if (goldMatch) {
            const total = parseFloat(goldMatch[1].replace(/,/g, ''))
            // Validate: gold should be reasonable (5000-50000)
            if (total >= 5000 && total <= 50000) {
              gold = {
                total: total,
                perMinute: parseFloat(goldMatch[2])
              }
            }
          }
        }
        
        // Calculate games and winrate if needed
        if ((wins > 0 || losses > 0) && games === 0) {
          games = wins + losses
        }
        if (winrate === 0 && games > 0 && wins > 0) {
          winrate = (wins / games) * 100
        }
      }
      
      // Add champion if valid
      if (games > 0 && championName && championName.length >= 2) {
        const championData = {
          championName,
          games,
          wins,
          losses,
          winrate: winrate || (games > 0 && wins > 0 ? (wins / games) * 100 : 0)
        }
        if (kda) championData.kda = kda
        if (damage) championData.damage = damage
        if (wards) championData.wards = wards
        if (cs) championData.cs = cs
        if (gold) championData.gold = gold
        champions.push(championData)
      }
    })
    
    // Remove duplicates and sort
    const uniqueChampions = []
    const seen = new Set()
    for (const champ of champions) {
      const key = champ.championName.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        uniqueChampions.push(champ)
      }
    }
    uniqueChampions.sort((a, b) => b.games - a.games)
    
    console.log(`[Headless] Extracted ${uniqueChampions.length} champions from HTML`)
    
    // Extract rank and LP
    const rankText = $('.tier-rank').text().trim() ||
                     $('.summoner-tier-rank').text().trim() ||
                     $('[class*="tier"]').first().text().trim() ||
                     ''
    const lpText = $('.lp').text().trim() ||
                   $('.summoner-lp').text().trim() ||
                   $('[class*="lp"]').first().text().trim() ||
                   ''
    const lp = parseInt(lpText.replace(/[^0-9]/g, '')) || 0
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        champions: uniqueChampions,
        rank: rankText,
        lp,
        lastUpdated: new Date().toISOString(),
        _method: 'headless',
        _source: 'html_parsing'
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

