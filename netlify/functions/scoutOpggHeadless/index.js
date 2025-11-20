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
// Browserless.io endpoint format: https://production-<region>.browserless.io/content
// Regions: sfo (San Francisco), ams (Amsterdam), etc.
// Default to sfo if not specified
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io/content'

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
    // If this fails, we should NOT fall back to direct HTTP - that defeats the purpose
    let html = null
    let usingHeadless = false
    
    if (BROWSERLESS_API_KEY) {
      try {
        console.log('[Headless] Using Browserless.io')
        console.log('[Headless] Endpoint:', BROWSERLESS_URL)
        
        try {
          // Follow Browserless.io documentation exactly:
          // https://docs.browserless.io/rest-apis/content
          // URL format: https://production-<region>.browserless.io/content?token=TOKEN
          // Body: { url: "https://example.com/" }
          // Response: Raw HTML text
          
          // Fix: chrome.browserless.io is deprecated - must use production-<region>.browserless.io
          // If user has old URL, convert it to regional format
          let contentUrl = BROWSERLESS_URL
          
          // Replace deprecated chrome.browserless.io with production-sfo
          if (contentUrl.includes('chrome.browserless.io')) {
            console.warn('[Headless] Detected deprecated chrome.browserless.io endpoint, converting to production-sfo')
            contentUrl = contentUrl.replace('chrome.browserless.io', 'production-sfo.browserless.io')
          }
          
          // Ensure we're using /content endpoint (not /scrape or /unblock)
          contentUrl = contentUrl.replace(/\/scrape$/, '/content').replace(/\/unblock$/, '/content')
          
          // If URL doesn't end with /content, add it
          if (!contentUrl.endsWith('/content')) {
            contentUrl = contentUrl.replace(/\/$/, '') + '/content'
          }
          
          const apiUrl = `${contentUrl}?token=${BROWSERLESS_API_KEY}`
          
          console.log('[Headless] Calling Browserless.io /content API')
          console.log('[Headless] Endpoint:', apiUrl)
          console.log('[Headless] Target URL:', url)
          
          const response = await axios.post(
            apiUrl,
            { url: url }, // Simple body - just the URL
            {
              timeout: 30000,
              headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
              },
              responseType: 'text' // Expect raw HTML text, not JSON
            }
          )
          
          // Response is raw HTML text (not JSON)
          if (typeof response.data === 'string' && response.data.length > 0) {
            html = response.data
            usingHeadless = true
            console.log(`[Headless] ✅ Successfully fetched HTML via /content (${html.length} chars)`)
          } else {
            throw new Error('Empty or invalid response from Browserless.io')
          }
        } catch (error) {
          console.error('[Headless] /content failed:', error.message)
          if (error.response) {
            console.error('[Headless] Response status:', error.response.status)
            console.error('[Headless] Response statusText:', error.response.statusText)
            console.error('[Headless] Response headers:', JSON.stringify(error.response.headers, null, 2))
            // Response might be text or JSON
            const responseData = typeof error.response.data === 'string' 
              ? error.response.data 
              : JSON.stringify(error.response.data, null, 2)
            console.error('[Headless] Response data:', responseData.substring(0, 500))
          }
          if (error.request) {
            console.error('[Headless] Request was made but no response received')
            console.error('[Headless] Request URL:', error.config?.url)
          }
          throw error
        }
      } catch (error) {
        console.error('[Headless] Browserless.io error:', error.message)
        console.error('[Headless] Full error:', error)
        
        // Return detailed error for debugging
        const errorDetails = {
          error: 'Failed to fetch with headless browser',
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          hint: 'Check BROWSERLESS_API_KEY and BROWSERLESS_URL environment variables. Browserless.io may be down or the API format may have changed.'
        }
        
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify(errorDetails)
        }
      }
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Browserless.io API key not configured',
          message: 'BROWSERLESS_API_KEY environment variable is required for headless scraping'
        })
      }
    }

    // NO FALLBACK - If headless browser fails, we fail
    // The whole point is to get properly rendered HTML, not to guess with templates
    if (!html || !usingHeadless) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Headless browser failed',
          message: 'Could not fetch rendered HTML. This endpoint requires a working headless browser service.'
        })
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
    
     // Process each champion row - SIMPLIFIED for headless browser
     // Add debug logging to understand why extraction fails
     championRows.each((i, elem) => {
       const $row = $(elem)
       
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
         
         // Debug: Log first few rows to understand structure
         if (i < 3) {
           console.log(`[Headless] Row ${i}: ${directCells.length} cells`)
           directCells.each((j, cell) => {
             const cellText = $(cell).text().trim().substring(0, 50)
             console.log(`[Headless] Row ${i}, Cell ${j}: "${cellText}"`)
           })
         }
         
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
           if (i < 3) {
             console.log(`[Headless] Row ${i} skipped - no valid champion name (got: "${championName}")`)
           }
           return
         }
        
         // Extract wins/losses from cell 2
         if (directCells.length > 2) {
           const $cell = $(directCells[2])
           const $cellClone = $cell.clone()
           $cellClone.find('table').remove()
           const cellText = $cellClone.text().trim()
           
           if (i < 3) {
             console.log(`[Headless] Row ${i} (${championName}) cell 2 text: "${cellText}"`)
           }
           
           const winsLossesMatch = cellText.match(/(\d+)\s*W\s+(\d+)\s*[LP]\b/i)
           if (winsLossesMatch) {
             wins = parseInt(winsLossesMatch[1])
             losses = parseInt(winsLossesMatch[2])
             games = wins + losses
           } else {
             // Try alternative pattern: "60W 41L" or "60 W 41 L"
             const altMatch = cellText.match(/(\d+)\s*[Ww]\s*(\d+)\s*[Ll]/)
             if (altMatch) {
               wins = parseInt(altMatch[1])
               losses = parseInt(altMatch[2])
               games = wins + losses
             }
           }
           const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
           if (winrateMatch) {
             winrate = parseFloat(winrateMatch[1])
           }
           
           if (i < 3) {
             console.log(`[Headless] Row ${i} (${championName}) extracted: ${wins}W ${losses}L = ${games} games`)
           }
         } else {
           if (i < 3) {
             console.log(`[Headless] Row ${i} (${championName}) - not enough cells (${directCells.length})`)
           }
         }
        
        // Extract KDA from cell 3
        // Headless browser gives us clean HTML, so we can trust the structure
        // Format: "2.12:1 6.9 / 5.8 / 5.4 (44%)"
        if (directCells.length > 3) {
          const $cell = $(directCells[3])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          // Simple extraction - headless browser should have proper spacing
          // Ratio: "2.12:1"
          const ratioMatch = cellText.match(/(\d+\.?\d*)\s*:\s*1\b/)
          
          // KDA: "6.9 / 5.8 / 5.4" - comes after ratio
          let kdaMatch = null
          if (ratioMatch) {
            const afterRatio = cellText.substring(cellText.indexOf(ratioMatch[0]) + ratioMatch[0].length).trim()
            kdaMatch = afterRatio.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
          } else {
            kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
          }
          
          // Kill participation: "(44%)"
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
        // Headless browser format: "1087.2/m 29.7%" (clean spacing)
        if (directCells.length > 6) {
          const $cell = $(directCells[6])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          // Simple pattern - headless browser has proper spacing
          const dmgMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m\s+(\d+\.?\d*)\s*%/i)
          if (dmgMatch) {
            damage = {
              perMinute: parseFloat(dmgMatch[1]),
              percentage: parseFloat(dmgMatch[2])
            }
          }
        }
        
        // Extract wards from cell 7
        // Headless browser format: "15 1 (16/4)" or "244 (16/4)" (clean spacing)
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
        // Headless browser format: "226 8.6/m" (clean spacing, total and per minute)
        if (directCells.length > 8) {
          const $cell = $(directCells[8])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          // Simple pattern - headless browser has proper spacing
          const csMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
          if (csMatch) {
            cs = {
              total: parseFloat(csMatch[1].replace(/,/g, '')),
              perMinute: parseFloat(csMatch[2])
            }
          }
        }
        
        // Extract gold from cell 9
        // Headless browser format: "12,898 489.1/m" (clean spacing, total and per minute)
        if (directCells.length > 9) {
          const $cell = $(directCells[9])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          // Simple pattern - headless browser has proper spacing
          const goldMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
          if (goldMatch) {
            gold = {
              total: parseFloat(goldMatch[1].replace(/,/g, '')),
              perMinute: parseFloat(goldMatch[2])
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
         
         if (i < 3) {
           console.log(`[Headless] Added champion: ${championName} - ${games} games (${wins}W ${losses}L)`)
         }
       } else {
         if (i < 3) {
           console.log(`[Headless] Row ${i} (${championName}) skipped - games: ${games}, name length: ${championName.length}`)
         }
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

