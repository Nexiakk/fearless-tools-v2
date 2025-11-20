const axios = require('axios')
const cheerio = require('cheerio')

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { playerName, region, tag, championsUrl } = JSON.parse(event.body)

    // Use provided championsUrl if available, otherwise construct from old format
    let url
    if (championsUrl) {
      // Use the full champions URL provided by frontend
      url = championsUrl
    } else if (playerName && region) {
      // Fallback to old format construction
      url = `https://www.op.gg/summoners/${region}/${encodeURIComponent(playerName)}/champions`
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'championsUrl or (playerName and region) are required' })
      }
    }
    
    // Ensure URL ends with /champions
    if (!url.includes('/champions')) {
      url = url.replace(/\/$/, '') + '/champions'
    }
    
    console.log(`[Backend] Fetching URL: ${url}`)
    
    // Fetch the page with timeout (8 seconds to leave buffer for processing)
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    })

    console.log(`[Backend] Response status: ${response.status}`)
    console.log(`[Backend] Response data length: ${response.data?.length || 0}`)
    
    const $ = cheerio.load(response.data)
    
    // Check if page is Next.js and has __NEXT_DATA__ (common for op.gg)
    let nextData = null
    const nextDataScript = $('script#__NEXT_DATA__').html()
    if (nextDataScript) {
      try {
        nextData = JSON.parse(nextDataScript)
        console.log(`[Backend] Found __NEXT_DATA__ script tag`)
        console.log(`[Backend] __NEXT_DATA__ keys:`, Object.keys(nextData))
      } catch (e) {
        console.log(`[Backend] Failed to parse __NEXT_DATA__:`, e.message)
      }
    }
    
    // Also check for other script tags that might contain data
    const allScripts = $('script').length
    console.log(`[Backend] Found ${allScripts} script tags total`)
    const dataScripts = $('script').filter((i, script) => {
      const scriptContent = $(script).html() || ''
      return scriptContent.includes('champion') || scriptContent.includes('Champion') || scriptContent.includes('summoner')
    })
    console.log(`[Backend] Found ${dataScripts.length} script tags that might contain champion/summoner data`)
    
    // Debug: Check if we can find any tables
    const totalTables = $('table').length
    console.log(`[Backend] Found ${totalTables} tables in HTML`)
    
    // Debug: Check for common op.gg structures
    const championImages = $('img[alt]').length
    console.log(`[Backend] Found ${championImages} images with alt attributes`)
    
    // Check for op.gg specific classes/structures
    const championListElements = $('[class*="champion"], [class*="Champion"], [data-champion]').length
    console.log(`[Backend] Found ${championListElements} elements with champion-related classes/attributes`)
    
    // Check if page might be JavaScript-rendered (check for common React/Vue markers)
    const hasReactMarkers = response.data.includes('__NEXT_DATA__') || response.data.includes('react') || response.data.includes('__REACT')
    console.log(`[Backend] Page appears to be JS-rendered: ${hasReactMarkers}`)
    
    // Log a sample of the HTML to see structure
    const htmlSample = response.data.substring(0, 5000)
    console.log(`[Backend] HTML sample (first 5000 chars):`, htmlSample)
    
    // Try to find champion data in __NEXT_DATA__ first (Next.js apps often embed data here)
    if (nextData) {
      console.log(`[Backend] Attempting to extract data from __NEXT_DATA__...`)
      
      // Helper function to recursively search for champion data
      const findChampionsData = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return null
        
        // Check if this object looks like champion data
        if (Array.isArray(obj)) {
          // Check if array contains champion-like objects
          if (obj.length > 0 && obj[0] && typeof obj[0] === 'object') {
            const firstItem = obj[0]
            if ((firstItem.championName || firstItem.name || firstItem.champion) && 
                (firstItem.games !== undefined || firstItem.wins !== undefined)) {
              console.log(`[Backend] Found champions array at path: ${path}`)
              return obj
            }
          }
        }
        
        // Recursively search in nested objects
        for (const key in obj) {
          if (key.toLowerCase().includes('champion') || key.toLowerCase().includes('summoner')) {
            const result = findChampionsData(obj[key], `${path}.${key}`)
            if (result) return result
          }
        }
        
        // Also check common data structures
        if (obj.champions || obj.championStats || obj.data?.champions) {
          const data = obj.champions || obj.championStats || obj.data?.champions
          if (Array.isArray(data) && data.length > 0) {
            console.log(`[Backend] Found champions at path: ${path}`)
            return data
          }
        }
        
        return null
      }
      
      // Search in props.pageProps first (most common location)
      const pageProps = nextData?.props?.pageProps
      let championsData = null
      
      if (pageProps) {
        console.log(`[Backend] Found pageProps, keys:`, Object.keys(pageProps))
        // Try direct paths first
        championsData = pageProps.champions || 
                       pageProps.championStats || 
                       pageProps.data?.champions ||
                       pageProps.summoner?.champions ||
                       pageProps.summonerChampions ||
                       pageProps.championList
      }
      
      // If not found, do recursive search
      if (!championsData || !Array.isArray(championsData) || championsData.length === 0) {
        console.log(`[Backend] Direct paths failed, doing recursive search...`)
        championsData = findChampionsData(nextData, 'root')
      }
      
      if (championsData && Array.isArray(championsData) && championsData.length > 0) {
        console.log(`[Backend] Found champions in __NEXT_DATA__: ${championsData.length} champions`)
        console.log(`[Backend] Sample champion data:`, JSON.stringify(championsData[0], null, 2))
        
        // Process the champions data
        const extractedChampions = championsData.map(champ => {
          // Try various field names for champion name
          const name = champ.championName || champ.name || champ.champion || champ.champion_id || ''
          // Try various field names for stats
          const wins = champ.wins || champ.win || 0
          const losses = champ.losses || champ.loss || champ.defeats || 0
          const games = champ.games || champ.totalGames || champ.gameCount || (wins + losses)
          const winrate = champ.winrate || champ.winRate || champ.win_rate || 
                         (games > 0 && wins > 0 ? (wins / games) * 100 : 0)
          
          return {
            championName: name,
            games: games || 0,
            wins: wins || 0,
            losses: losses || 0,
            winrate: winrate || 0,
            kda: champ.kda ? {
              kills: champ.kda.kills || champ.kda.k || 0,
              deaths: champ.kda.deaths || champ.kda.d || 0,
              assists: champ.kda.assists || champ.kda.a || 0
            } : null
          }
        }).filter(champ => champ.championName && champ.games > 0)
        
        if (extractedChampions.length > 0) {
          console.log(`[Backend] Successfully extracted ${extractedChampions.length} champions from __NEXT_DATA__`)
          // Extract rank and LP from pageProps if available
          const rankText = pageProps?.summoner?.tier || pageProps?.tier || pageProps?.rank || ''
          const lp = pageProps?.summoner?.lp || pageProps?.lp || 0
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              champions: extractedChampions,
              rank: rankText,
              lp,
              lastUpdated: new Date().toISOString()
            })
          }
        }
      }
      console.log(`[Backend] No champion data found in __NEXT_DATA__, falling back to HTML parsing`)
    }

    // Extract champion stats from the main champion list
    // CRITICAL: Only get stats from top-level champion items, NOT from expanded matchup sections
    // op.gg automatically expands the first champion, so we need to avoid matchup data
    const champions = []
    
    // Strategy: Find the MAIN champion list table for CURRENT SEASON
    // op.gg structure: There's a main table with champion rows
    // When a champion is expanded, matchups appear in nested tables/rows
    // We need to get ONLY the main champion rows, ignoring all nested content
    
    // Find the main champion list table
    // Look for the largest table that contains champion data
    let mainTable = null
    const allTables = $('table').filter((i, table) => {
      const $table = $(table)
      
      // Skip if inside matchup/expanded sections
      if ($table.closest('[class*="matchup"]').length > 0 ||
          $table.closest('[class*="expanded"]').length > 0 ||
          $table.closest('[class*="opponent"]').length > 0) {
        return false
      }
      
      // Skip if it's explicitly a matchup table
      const tableClass = ($table.attr('class') || '').toLowerCase()
      const headerText = $table.find('thead th').text().toLowerCase()
      if (tableClass.includes('matchup') || 
          headerText.includes('opponent') ||
          headerText.includes('vs') ||
          headerText.includes('against')) {
        return false
      }
      
      // Must have rows with champion images
      const championRows = $table.find('tbody tr, tr').not('thead tr').filter((j, row) => {
        return $(row).find('img[alt], img[src*="champion"]').length > 0
      })
      
      // Must have at least 2 champion rows (summary + at least 1 champion)
      return championRows.length >= 2
    })
    
    // Get the largest table (main list) that's not a matchup table
    if (allTables.length > 0) {
      let maxRows = 0
      let bestTable = null
      allTables.each((i, table) => {
        const $table = $(table)
        // Count only direct children rows (not nested)
        const rowCount = $table.find('> tbody > tr, > tr').not('thead tr').length
        // Prefer tables with more rows (main list has many champions)
        if (rowCount > maxRows && rowCount > 2) {
          maxRows = rowCount
          bestTable = $table
        }
      })
      mainTable = bestTable || $(allTables[0])
    }
    
    // Get rows from the main table - use a simpler, more permissive approach
    let championRows = $()
    if (mainTable && mainTable.length > 0) {
      if (mainTable.find('tbody').length > 0) {
        // Get ALL direct children of tbody
        championRows = mainTable.find('tbody').children('tr')
      } else {
        // No tbody, get direct children of table
        championRows = mainTable.children('tr').not('thead tr')
      }
    } else {
      // Fallback: find all table rows with champion images
      championRows = $('table tbody tr, table > tr').filter((i, row) => {
        const $row = $(row)
        // Must have champion image
        return $row.find('img[alt], img[src*="champion"]').length > 0
      })
    }
    
    console.log(`[Backend] Found ${championRows.length} potential champion rows before filtering`)
    
    // Filter more permissively - only exclude obvious matchup rows
    championRows = championRows.filter((i, elem) => {
      const $row = $(elem)
      
      // Skip if explicitly a matchup row
      const rowClass = ($row.attr('class') || '').toLowerCase()
      const rowData = ($row.attr('data-type') || '').toLowerCase()
      if (rowClass.includes('matchup') || rowClass.includes('opponent') || 
          rowData === 'matchup' || rowData === 'opponent') {
        return false
      }
      
      // Skip if inside a matchup container
      if ($row.closest('[class*="matchup"]').length > 0 && 
          $row.closest('[class*="matchup"]').attr('class')?.toLowerCase().includes('matchup')) {
        return false
      }
      
      // Must have champion image
      const hasChampionImage = $row.find('img[alt]').length > 0
      if (!hasChampionImage) return false
      
      // Must have some stats (numbers) in the row
      const rowText = $row.text()
      if (!/\d+/.test(rowText)) return false
      
      // Skip summary rows (like "All Champions")
      const rowTextLower = rowText.toLowerCase()
      if (rowTextLower.includes('all champions') || rowTextLower.includes('wszyscy') || 
          rowTextLower.includes('total') && !rowTextLower.includes('games')) {
        return false
      }
      
      // Check if row is inside a nested table (inside a td of another row)
      const parentTd = $row.closest('td')
      if (parentTd.length > 0) {
        const parentRow = parentTd.closest('tr')
        // If parent row is not this row, and parent row also has champion image, this is nested
        if (parentRow.length > 0 && parentRow[0] !== $row[0] && parentRow.find('img[alt]').length > 0) {
          // This is likely a matchup row inside an expanded champion row
          return false
        }
      }
      
      return true
    })
    
    console.log(`[Backend] After filtering: ${championRows.length} champion rows`)
    
    championRows.each((i, elem) => {
      const $row = $(elem)
      
      // CRITICAL: Check if this row is expanded (contains nested matchup tables)
      // If it is, we need to be extra careful to only get stats from the main row, not nested content
      const isExpanded = $row.find('table').length > 0 || 
                        $row.find('[class*="matchup"]').length > 0 ||
                        $row.find('[class*="expanded"]').length > 0
      
      // Extract champion name - based on actual HTML structure
      // Column 2 (index 1) contains: <img alt="Yone"> and <strong>Yone</strong>
      let championName = ''
      
      if ($row.is('tr')) {
        const directCells = $row.children('td')
        
        // Column 2 (index 1) contains champion name
        if (directCells.length > 1) {
          const nameCell = $(directCells[1])
          
          // Method 1: Get from image alt attribute (most reliable)
          const imgAlt = nameCell.find('img[alt]').first().attr('alt') || ''
          if (imgAlt) {
            championName = imgAlt.trim()
          }
          
          // Method 2: Get from <strong> tag if alt didn't work
          if (!championName) {
            championName = nameCell.find('strong').first().text().trim()
          }
          
          // Method 3: Get from any text in the cell (fallback)
          if (!championName) {
            // Remove nested tables/matchup content before extracting text
            const $cellClone = nameCell.clone()
            $cellClone.find('table, [class*="matchup"], img').remove() // Also remove images to get clean text
            championName = $cellClone.text().trim()
          }
        }
      }
      
      // Fallback: Try data attributes
      if (!championName) {
        championName = $row.attr('data-champion') || 
                       $row.find('[data-champion-name]').attr('data-champion-name') ||
                       $row.find('[data-champion]').attr('data-champion')
      }
      
      // Clean up champion name
      championName = championName
        .replace(/['"]/g, '') // Remove quotes
        .trim() // Trim edges
      
      if (!championName || championName.length < 2) {
        console.log(`[DEBUG] Skipping row - no valid champion name found`)
        return
      }
      
      console.log(`[DEBUG] Processing champion: ${championName}`)
      
      // Extract stats from specific cells based on op.gg structure
      // Cell 0: Rank
      // Cell 1: Champion name/image
      // Cell 2: Wins/Losses/Winrate
      // Cell 3: KDA (ratio, kills/deaths/assists, kill participation)
      // Cell 4: op.gg score (SKIP)
      // Cell 5: Laning winrate (SKIP)
      // Cell 6: Damage (per minute, percentage)
      // Cell 7: Wards (vision score, control wards, placed, killed)
      // Cell 8: CS (total, per minute)
      // Cell 9: Gold (total, per minute)
      
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      let damage = null
      let wards = null
      let cs = null
      let gold = null
      
      // Get the full row text for pattern matching
      const fullRowText = $row.text()
      console.log(`[DEBUG] Champion: ${championName}, Full row text: "${fullRowText.substring(0, 200)}"`)
      
      if ($row.is('tr')) {
        const directCells = $row.children('td')
        console.log(`[DEBUG] Champion: ${championName}, Number of cells: ${directCells.length}`)
        // Log all cell contents for debugging - this is critical for understanding the structure
        console.log(`[DEBUG] === CELL STRUCTURE FOR ${championName} ===`)
        directCells.each((idx, cell) => {
          const $cell = $(cell)
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          const cellHtml = $cell.html().substring(0, 100)
          console.log(`[DEBUG] Cell ${idx}: text="${cellText}", html="${cellHtml}"`)
        })
        console.log(`[DEBUG] === END CELL STRUCTURE ===`)
        
        // Extract from specific cells by index
        // Structure: [0: rank, 1: name, 2: wins/losses, 3: KDA, 4: skip, 5: skip, 6: damage, 7: wards, 8: CS, 9: gold]
        
        // Cell 2 (index 2): Wins/Losses/Winrate - "60 W 41 L 59%"
        if (directCells.length > 2) {
          const $cell = $(directCells[2])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 2 (wins/losses) text: "${cellText}"`)
            const winsLossesMatch = cellText.match(/(\d+)\s*W\s+(\d+)\s*[LP]\b/i) || 
                                    cellText.match(/(\d+)\s*W\s*(\d+)\s*[LP]/i)
            if (winsLossesMatch) {
              wins = parseInt(winsLossesMatch[1])
              losses = parseInt(winsLossesMatch[2])
              games = wins + losses
              console.log(`[DEBUG] Extracted wins/losses: ${wins}W ${losses}L`)
            }
            
            const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
            if (winrateMatch) {
              winrate = parseFloat(winrateMatch[1])
              console.log(`[DEBUG] Extracted winrate: ${winrate}%`)
            }
          }
        }
        
        // Cell 3 (index 3): KDA - "2.12:1 6.9 / 5.8 / 5.4 (44%)"
        if (directCells.length > 3 && !kda) {
          const $cell = $(directCells[3])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 3 (KDA) text: "${cellText}"`)
            // Extract KDA ratio (e.g., "2.12:1") - must end with ":1" and be followed by space or KDA
            const ratioMatch = cellText.match(/(\d+\.?\d*)\s*:\s*1(?:\s|$)/)
            
            // Extract KDA stats - must come AFTER the ratio (if present)
            // Pattern: number / number / number (with two slashes)
            let kdaMatch = null
            if (ratioMatch) {
              // Find KDA after the ratio
              const ratioEnd = cellText.indexOf(ratioMatch[0]) + ratioMatch[0].length
              const afterRatio = cellText.substring(ratioEnd).trim()
              // Match KDA pattern in the text after ratio
              kdaMatch = afterRatio.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
            } else {
              // No ratio found, try to match KDA anywhere (but be careful not to match ratio)
              kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
              // If match starts with a number that looks like it could be part of a ratio (e.g., "2.12"), skip it
              if (kdaMatch && cellText.indexOf(kdaMatch[0]) < 10) {
                // Check if there's a colon nearby that might indicate this is part of a ratio
                const beforeMatch = cellText.substring(0, cellText.indexOf(kdaMatch[0]))
                if (beforeMatch.match(/:\s*1/)) {
                  // This is likely part of a ratio, skip it
                  kdaMatch = null
                }
              }
            }
            
            // Extract kill participation (e.g., "(44%)") - must be in parentheses
            const kpMatch = cellText.match(/\((\d+\.?\d*)\s*%\)/)
            
            if (kdaMatch) {
              kda = {
                kills: parseFloat(kdaMatch[1]),
                deaths: parseFloat(kdaMatch[2]),
                assists: parseFloat(kdaMatch[3])
              }
              if (ratioMatch) {
                kda.ratio = parseFloat(ratioMatch[1])
              }
              if (kpMatch) {
                kda.killParticipation = parseFloat(kpMatch[1])
              }
              console.log(`[DEBUG] Extracted KDA from cell 3:`, kda)
            } else {
              console.log(`[DEBUG] KDA pattern did not match cell 3 text: "${cellText}"`)
            }
          }
        }
        
        // Cell 6 (index 6): Damage - "1087.2/m 29.7%"
        if (directCells.length > 6 && !damage) {
          const $cell = $(directCells[6])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 6 (damage) text: "${cellText}"`)
            // Match pattern: "1087.2/m 29.7%" - damage per minute and damage percentage
            const dmgMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m\s+(\d+\.?\d*)\s*%/i)
            if (dmgMatch) {
              damage = {
                perMinute: parseFloat(dmgMatch[1]),
                percentage: parseFloat(dmgMatch[2])
              }
              console.log(`[DEBUG] Extracted damage:`, damage)
            } else {
              // Fallback: try to match separately
              const dmgPerMinMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m/i)
              const dmgPercentMatch = cellText.match(/(\d+\.?\d*)\s*%/)
              if (dmgPerMinMatch || dmgPercentMatch) {
                damage = {}
                if (dmgPerMinMatch) {
                  damage.perMinute = parseFloat(dmgPerMinMatch[1])
                }
                if (dmgPercentMatch) {
                  damage.percentage = parseFloat(dmgPercentMatch[1])
                }
                console.log(`[DEBUG] Extracted damage (fallback):`, damage)
              }
            }
          }
        }
        
        // Cell 7 (index 7): Wards - "244 (16/4)" (vision score, placed, killed) OR "14 1 (7/2)" (vision score, control wards, placed, killed)
        if (directCells.length > 7 && !wards) {
          const $cell = $(directCells[7])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 7 (wards) text: "${cellText}"`)
            // Try Pattern 2 FIRST: "15 1 (16/4)" = vision score, control wards, (placed/killed)
            let wardsMatch = cellText.match(/(\d+)\s+(\d+)\s+\((\d+)\s*\/\s*(\d+)\)/)
            if (wardsMatch) {
              wards = {
                visionScore: parseFloat(wardsMatch[1]),
                controlWards: parseFloat(wardsMatch[2]),
                placed: parseFloat(wardsMatch[3]),
                killed: parseFloat(wardsMatch[4])
              }
              console.log(`[DEBUG] Extracted wards from cell 7 (format 2):`, wards)
            } else {
              // Pattern 1: "244 (16/4)" or "151 (16/4)" = vision score, (placed/killed)
              // Check if the number might be two concatenated numbers (e.g., "151" = "15" + "1")
              wardsMatch = cellText.match(/(\d+)\s*\((\d+)\s*\/\s*(\d+)\)/)
              if (wardsMatch) {
                const visionScoreStr = wardsMatch[1]
                // If vision score is 3+ digits and ends with a single digit (0-9), it might be two numbers
                // Example: "151" -> "15" (vision) + "1" (control wards)
                // But "244" is probably just one number (vision score can be 200+)
                if (visionScoreStr.length >= 3) {
                  // Try splitting: last digit might be control wards
                  const lastDigit = parseInt(visionScoreStr[visionScoreStr.length - 1])
                  const visionScoreNum = parseInt(visionScoreStr.substring(0, visionScoreStr.length - 1))
                  // Control wards are typically 0-10, vision score is typically 5-400 (wider range)
                  // Only split if both parts are reasonable
                  if (lastDigit >= 0 && lastDigit <= 10 && visionScoreNum >= 5 && visionScoreNum <= 400) {
                    // Additional check: if the original number is very high (e.g., 244), it's probably just vision score
                    const originalNum = parseFloat(visionScoreStr)
                    if (originalNum > 200) {
                      // High numbers are likely just vision score, not concatenated
                      wards = {
                        visionScore: originalNum,
                        controlWards: 0,
                        placed: parseFloat(wardsMatch[2]),
                        killed: parseFloat(wardsMatch[3])
                      }
                      console.log(`[DEBUG] Extracted wards from cell 7 (format 1, high vision score):`, wards)
                    } else {
                      // Lower numbers might be concatenated
                      wards = {
                        visionScore: visionScoreNum,
                        controlWards: lastDigit,
                        placed: parseFloat(wardsMatch[2]),
                        killed: parseFloat(wardsMatch[3])
                      }
                      console.log(`[DEBUG] Extracted wards from cell 7 (format 1, split concatenated):`, wards)
                    }
                  } else {
                    // Use as single number
                    wards = {
                      visionScore: parseFloat(visionScoreStr),
                      controlWards: 0,
                      placed: parseFloat(wardsMatch[2]),
                      killed: parseFloat(wardsMatch[3])
                    }
                    console.log(`[DEBUG] Extracted wards from cell 7 (format 1):`, wards)
                  }
                } else {
                  // Single number format (1-2 digits)
                  wards = {
                    visionScore: parseFloat(visionScoreStr),
                    controlWards: 0,
                    placed: parseFloat(wardsMatch[2]),
                    killed: parseFloat(wardsMatch[3])
                  }
                  console.log(`[DEBUG] Extracted wards from cell 7 (format 1):`, wards)
                }
              } else {
                console.log(`[DEBUG] Wards pattern did not match cell 7 text: "${cellText}"`)
              }
            }
          } else {
            console.log(`[DEBUG] Cell 7 is empty for champion: ${championName}`)
          }
        } else {
          console.log(`[DEBUG] Cannot extract wards - directCells.length: ${directCells.length}, already extracted: ${!!wards}`)
        }
        
        // Cell 8 (index 8): CS - "2686.8/m" (only per minute) OR "226 8.6/m" (total and per minute)
        if (directCells.length > 8 && !cs) {
          const $cell = $(directCells[8])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 8 (CS) text: "${cellText}"`)
            // Pattern 1: "226 8.6/m" = total and per minute (correct format)
            let csMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
            if (csMatch) {
              cs = {
                total: parseFloat(csMatch[1].replace(/,/g, '')),
                perMinute: parseFloat(csMatch[2])
              }
              console.log(`[DEBUG] Extracted CS from cell 8 (format 1):`, cs)
            } else {
              // Pattern 2: "988.6/m", "2198.2/m", or "2686.8/m" = might be concatenated or only per minute
              csMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*m/i)
              if (csMatch) {
                const valueStr = csMatch[1]
                // Check if this might be two concatenated numbers
                // CS total can be 2-3 digits (50-600), per minute is typically 5-15
                // If the number has a decimal and is 3+ digits, try to split it
                if (valueStr.includes('.') && valueStr.length >= 3) {
                  const decimalIndex = valueStr.indexOf('.')
                  // Try different split points: 2, 3, or 4 digits for total
                  // Start from 2 (for "988.6" = "98" + "8.6") up to 4 (for "12349.2" = "1234" + "9.2")
                  for (let splitPoint = 2; splitPoint <= Math.min(4, decimalIndex); splitPoint++) {
                    const totalPart = valueStr.substring(0, splitPoint)
                    const perMinPart = valueStr.substring(splitPoint)
                    
                    const total = parseFloat(totalPart)
                    const perMin = parseFloat(perMinPart)
                    
                    // Check if values are reasonable
                    // CS total: 50-600 (handles 2-digit like 98, 3-digit like 219, even 4-digit like 1234)
                    // Per minute: 4-20 (slightly wider range to be safe)
                    if (total >= 50 && total <= 600 && perMin >= 4 && perMin <= 20) {
                      cs = {
                        total: total,
                        perMinute: perMin
                      }
                      console.log(`[DEBUG] Extracted CS from cell 8 (format 2, split concatenated at ${splitPoint}):`, cs)
                      break
                    }
                  }
                }
                
                // If we didn't find a good split, treat as per minute only
                if (!cs) {
                  const perMin = parseFloat(valueStr)
                  // If per minute is very high (>100), it's probably concatenated but we couldn't split it
                  // Try one more time with heuristic: if it's 3+ digits, try common split points
                  if (perMin > 100 && valueStr.length >= 3) {
                    console.log(`[DEBUG] CS value ${perMin} seems too high for per minute only, trying heuristic split`)
                    // Try splitting at 2, 3, or 4 digits
                    for (let splitPoint = 2; splitPoint <= Math.min(4, valueStr.length - 2); splitPoint++) {
                      const totalGuess = parseFloat(valueStr.substring(0, splitPoint))
                      const perMinGuess = parseFloat(valueStr.substring(splitPoint))
                      if (totalGuess >= 50 && totalGuess <= 600 && perMinGuess >= 4 && perMinGuess <= 20) {
                        cs = {
                          total: totalGuess,
                          perMinute: perMinGuess
                        }
                        console.log(`[DEBUG] Extracted CS from cell 8 (format 2, heuristic split at ${splitPoint}):`, cs)
                        break
                      }
                    }
                  }
                  
                  if (!cs) {
                    // Only use as per minute if it's reasonable (< 30)
                    if (perMin <= 30) {
                      cs = {
                        total: 0, // Not provided
                        perMinute: perMin
                      }
                      console.log(`[DEBUG] Extracted CS from cell 8 (format 2, per minute only):`, cs)
                    } else {
                      console.log(`[DEBUG] CS value ${perMin} is too high and couldn't be split, skipping`)
                    }
                  }
                }
              } else {
                console.log(`[DEBUG] CS pattern did not match cell 8 text: "${cellText}"`)
              }
            }
          } else {
            console.log(`[DEBUG] Cell 8 is empty for champion: ${championName}`)
          }
        } else {
          console.log(`[DEBUG] Cannot extract CS - directCells.length: ${directCells.length}, already extracted: ${!!cs}`)
        }
        
        // Cell 9 (index 9): Gold - "16,384418.1/m" (malformed, missing space) OR "12,898 489.1/m" (correct format)
        if (directCells.length > 9 && !gold) {
          const $cell = $(directCells[9])
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (cellText) {
            console.log(`[DEBUG] Champion: ${championName}, Cell 9 (gold) text: "${cellText}"`)
            // Pattern 1: "12,898 489.1/m" = total and per minute (correct format)
            let goldMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
            if (goldMatch) {
              gold = {
                total: parseFloat(goldMatch[1].replace(/,/g, '')),
                perMinute: parseFloat(goldMatch[2])
              }
              console.log(`[DEBUG] Extracted gold from cell 9 (format 1):`, gold)
            } else {
              // Pattern 2: "16,384418.1/m" = malformed, missing space between total and per minute
              // Need to intelligently split: "16,384" (total) + "418.1" (per minute)
              // Strategy: Find decimal point, work backwards to find reasonable split
              // Per minute usually has decimal (e.g., "418.1"), total is integer
              const malformedMatch = cellText.match(/(\d+),(\d+)(\d*\.\d+)\s*\/\s*m/i)
              if (malformedMatch) {
                const beforeComma = malformedMatch[1] // "16"
                const afterCommaAll = malformedMatch[2] // "384418" (all digits after comma before decimal)
                const decimalPart = malformedMatch[3] // ".1" or "418.1"
                
                // Try different splits: per minute should be 100-1000, total should be 5000-50000
                // Try splitting afterCommaAll at different points
                for (let splitPoint = 3; splitPoint <= Math.min(6, afterCommaAll.length); splitPoint++) {
                  const totalPart = afterCommaAll.substring(0, splitPoint) // First N digits after comma
                  const perMinPart = afterCommaAll.substring(splitPoint) + decimalPart // Rest + decimal
                  
                  const total = parseFloat(beforeComma + totalPart)
                  const perMin = parseFloat(perMinPart)
                  
                  // Check if values are reasonable
                  if (perMin >= 100 && perMin <= 1000 && total >= 5000 && total <= 50000) {
                    gold = {
                      total: total,
                      perMinute: perMin
                    }
                    console.log(`[DEBUG] Extracted gold from cell 9 (format 2, split at position ${splitPoint}):`, gold)
                    break
                  }
                }
                
                if (!gold) {
                  console.log(`[DEBUG] Gold pattern matched but couldn't find reasonable split: "${cellText}"`)
                }
              } else {
                console.log(`[DEBUG] Gold pattern did not match cell 9 text: "${cellText}"`)
              }
            }
          } else {
            console.log(`[DEBUG] Cell 9 is empty for champion: ${championName}`)
          }
        } else {
          console.log(`[DEBUG] Cannot extract gold - directCells.length: ${directCells.length}, already extracted: ${!!gold}`)
        }
        
        // Calculate games from wins + losses if we have them
        if ((wins > 0 || losses > 0) && games === 0) {
          games = wins + losses
          console.log(`[DEBUG] Calculated games from wins/losses: ${games}`)
        }
        
        // Calculate winrate if we have games but no winrate was extracted
        if (winrate === 0 && games > 0 && wins > 0) {
          winrate = (wins / games) * 100
          console.log(`[DEBUG] Calculated winrate: ${winrate}%`)
        }
        
        // Fallback: Try to extract missing stats from full row text if cell extraction failed
        // Also try searching all cells if specific cell extraction failed
        if (!wards) {
          console.log(`[DEBUG] Wards not found in cell 7, trying fallback extraction for ${championName}`)
          
          // Try from full row text first - be more flexible with spacing
          if (fullRowText) {
            // Try Pattern 2 FIRST: "15 1 (16/4)" = vision score, control wards, (placed/killed)
            let wardsMatch = fullRowText.match(/(\d+)\s+(\d+)\s+\((\d+)\s*\/\s*(\d+)\)/)
            if (wardsMatch) {
              wards = {
                visionScore: parseFloat(wardsMatch[1]),
                controlWards: parseFloat(wardsMatch[2]),
                placed: parseFloat(wardsMatch[3]),
                killed: parseFloat(wardsMatch[4])
              }
              console.log(`[DEBUG] Extracted wards from full row text (format 2):`, wards)
            } else {
              // Pattern 1: "244 (16/4)" or "151 (16/4)" = vision score, (placed/killed)
              wardsMatch = fullRowText.match(/(\d+)\s*\((\d+)\s*\/\s*(\d+)\)/)
              if (wardsMatch) {
                const visionScoreStr = wardsMatch[1]
                // Check if vision score might be two concatenated numbers
                if (visionScoreStr.length >= 3) {
                  const lastDigit = parseInt(visionScoreStr[visionScoreStr.length - 1])
                  const visionScoreNum = parseInt(visionScoreStr.substring(0, visionScoreStr.length - 1))
                  const originalNum = parseFloat(visionScoreStr)
                  
                  // Control wards: 0-10, vision score: 5-400
                  if (lastDigit >= 0 && lastDigit <= 10 && visionScoreNum >= 5 && visionScoreNum <= 400) {
                    // High numbers (>200) are likely just vision score
                    if (originalNum > 200) {
                      wards = {
                        visionScore: originalNum,
                        controlWards: 0,
                        placed: parseFloat(wardsMatch[2]),
                        killed: parseFloat(wardsMatch[3])
                      }
                      console.log(`[DEBUG] Extracted wards from full row text (format 1, high vision score):`, wards)
                    } else {
                      wards = {
                        visionScore: visionScoreNum,
                        controlWards: lastDigit,
                        placed: parseFloat(wardsMatch[2]),
                        killed: parseFloat(wardsMatch[3])
                      }
                      console.log(`[DEBUG] Extracted wards from full row text (format 1, split concatenated):`, wards)
                    }
                  } else {
                    wards = {
                      visionScore: originalNum,
                      controlWards: 0,
                      placed: parseFloat(wardsMatch[2]),
                      killed: parseFloat(wardsMatch[3])
                    }
                    console.log(`[DEBUG] Extracted wards from full row text (format 1):`, wards)
                  }
                } else {
                  wards = {
                    visionScore: parseFloat(visionScoreStr),
                    controlWards: 0,
                    placed: parseFloat(wardsMatch[2]),
                    killed: parseFloat(wardsMatch[3])
                  }
                  console.log(`[DEBUG] Extracted wards from full row text (format 1):`, wards)
                }
              }
            }
          }
          
          // If still not found, search all cells
          if (!wards && directCells.length > 0) {
            console.log(`[DEBUG] Searching all ${directCells.length} cells for wards pattern`)
            for (let i = 0; i < directCells.length; i++) {
              const $cell = $(directCells[i])
              const $cellClone = $cell.clone()
              $cellClone.find('table').remove()
              const cellText = $cellClone.text().trim()
              
              if (cellText && /\(\d+\s*\/\s*\d+\)/.test(cellText)) {
                const wardsMatch = cellText.match(/(\d+)\s+(\d+)\s+\((\d+)\s*\/\s*(\d+)\)/)
                if (wardsMatch) {
                  wards = {
                    visionScore: parseFloat(wardsMatch[1]),
                    controlWards: parseFloat(wardsMatch[2]),
                    placed: parseFloat(wardsMatch[3]),
                    killed: parseFloat(wardsMatch[4])
                  }
                  console.log(`[DEBUG] Extracted wards from cell ${i}:`, wards)
                  break
                }
              }
            }
          }
          
          if (!wards) {
            console.log(`[DEBUG] WARNING: Could not extract wards for ${championName}. Full row text: "${fullRowText.substring(0, 300)}"`)
          }
        }
        
        if (!cs) {
          console.log(`[DEBUG] CS not found in cell 8, trying fallback extraction for ${championName}`)
          
          // Try from full row text first - look for pattern like "226 8.6/m" or "2686.8/m"
          if (fullRowText) {
            // Pattern 1: "226 8.6/m" = total and per minute
            let csMatch = fullRowText.match(/(\d{2,})\s+(\d+\.?\d*)\s*\/\s*m/i)
            if (csMatch && parseFloat(csMatch[1]) < 10000) { // CS total should be reasonable (< 10000)
              cs = {
                total: parseFloat(csMatch[1].replace(/,/g, '')),
                perMinute: parseFloat(csMatch[2])
              }
              console.log(`[DEBUG] Extracted CS from full row text (format 1):`, cs)
            } else {
              // Pattern 2: "988.6/m", "2198.2/m", or "2686.8/m" = might be concatenated or only per minute
              csMatch = fullRowText.match(/(\d+\.?\d*)\s*\/\s*m/i)
              if (csMatch) {
                const valueStr = csMatch[1]
                // Check if this might be two concatenated numbers
                // CS total can be 2-3 digits (50-600), per minute is typically 5-15
                if (valueStr.includes('.') && valueStr.length >= 3) {
                  const decimalIndex = valueStr.indexOf('.')
                  // Try different split points: 2, 3, or 4 digits for total
                  for (let splitPoint = 2; splitPoint <= Math.min(4, decimalIndex); splitPoint++) {
                    const totalPart = valueStr.substring(0, splitPoint)
                    const perMinPart = valueStr.substring(splitPoint)
                    
                    const total = parseFloat(totalPart)
                    const perMin = parseFloat(perMinPart)
                    
                    // CS total: 50-600, per minute: 4-20
                    if (total >= 50 && total <= 600 && perMin >= 4 && perMin <= 20) {
                      cs = {
                        total: total,
                        perMinute: perMin
                      }
                      console.log(`[DEBUG] Extracted CS from full row text (format 2, split concatenated at ${splitPoint}):`, cs)
                      break
                    }
                  }
                }
                
                // If we didn't find a good split, check if it's just per minute
                if (!cs) {
                  const perMin = parseFloat(valueStr)
                  if (perMin > 100) {
                    // Too high for per minute, try heuristic split
                    if (valueStr.length >= 3) {
                      for (let splitPoint = 2; splitPoint <= Math.min(4, valueStr.length - 2); splitPoint++) {
                        const totalGuess = parseFloat(valueStr.substring(0, splitPoint))
                        const perMinGuess = parseFloat(valueStr.substring(splitPoint))
                        if (totalGuess >= 50 && totalGuess <= 600 && perMinGuess >= 4 && perMinGuess <= 20) {
                          cs = {
                            total: totalGuess,
                            perMinute: perMinGuess
                          }
                          console.log(`[DEBUG] Extracted CS from full row text (format 2, heuristic split at ${splitPoint}):`, cs)
                          break
                        }
                      }
                    }
                  }
                  
                  if (!cs) {
                    // Only use as per minute if it's reasonable
                    if (perMin <= 30) {
                      cs = {
                        total: 0,
                        perMinute: perMin
                      }
                      console.log(`[DEBUG] Extracted CS from full row text (format 2, per minute only):`, cs)
                    }
                  }
                }
              }
            }
          }
          
          // If still not found, search all cells
          if (!cs && directCells.length > 0) {
            console.log(`[DEBUG] Searching all ${directCells.length} cells for CS pattern`)
            for (let i = 0; i < directCells.length; i++) {
              const $cell = $(directCells[i])
              const $cellClone = $cell.clone()
              $cellClone.find('table').remove()
              const cellText = $cellClone.text().trim()
              
              if (cellText && /\d+\s+\d+\.?\d*\s*\/\s*m/i.test(cellText)) {
                const csMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
                if (csMatch && parseFloat(csMatch[1].replace(/,/g, '')) < 10000) {
                  cs = {
                    total: parseFloat(csMatch[1].replace(/,/g, '')),
                    perMinute: parseFloat(csMatch[2])
                  }
                  console.log(`[DEBUG] Extracted CS from cell ${i}:`, cs)
                  break
                }
              }
            }
          }
          
          if (!cs) {
            console.log(`[DEBUG] WARNING: Could not extract CS for ${championName}. Full row text: "${fullRowText.substring(0, 300)}"`)
          }
        }
        
        if (!gold) {
          console.log(`[DEBUG] Gold not found in cell 9, trying fallback extraction for ${championName}`)
          
          // Try from full row text first - gold usually has comma (e.g., "12,898 489.1/m" or malformed "16,384418.1/m")
          if (fullRowText) {
            // Pattern 1: "12,898 489.1/m" = total and per minute (correct format)
            let goldMatch = fullRowText.match(/([\d,]{4,})\s+(\d+\.?\d*)\s*\/\s*m/i)
            if (goldMatch) {
              const total = parseFloat(goldMatch[1].replace(/,/g, ''))
              // Gold should be reasonable (between 5000 and 50000 typically)
              if (total >= 5000 && total <= 50000) {
                gold = {
                  total: total,
                  perMinute: parseFloat(goldMatch[2])
                }
                console.log(`[DEBUG] Extracted gold from full row text (format 1):`, gold)
              }
            } else {
              // Pattern 2: "16,384418.1/m" = malformed, missing space
              // Strategy: Find decimal point, work backwards to find reasonable split
              const malformedMatch = fullRowText.match(/(\d+),(\d+)(\d*\.\d+)\s*\/\s*m/i)
              if (malformedMatch) {
                const beforeComma = malformedMatch[1]
                const afterCommaAll = malformedMatch[2]
                const decimalPart = malformedMatch[3]
                
                // Try different splits
                for (let splitPoint = 3; splitPoint <= Math.min(6, afterCommaAll.length); splitPoint++) {
                  const totalPart = afterCommaAll.substring(0, splitPoint)
                  const perMinPart = afterCommaAll.substring(splitPoint) + decimalPart
                  
                  const total = parseFloat(beforeComma + totalPart)
                  const perMin = parseFloat(perMinPart)
                  
                  if (perMin >= 100 && perMin <= 1000 && total >= 5000 && total <= 50000) {
                    gold = {
                      total: total,
                      perMinute: perMin
                    }
                    console.log(`[DEBUG] Extracted gold from full row text (format 2, split at ${splitPoint}):`, gold)
                    break
                  }
                }
              }
            }
          }
          
          // If still not found, search all cells
          if (!gold && directCells.length > 0) {
            console.log(`[DEBUG] Searching all ${directCells.length} cells for gold pattern`)
            for (let i = 0; i < directCells.length; i++) {
              const $cell = $(directCells[i])
              const $cellClone = $cell.clone()
              $cellClone.find('table').remove()
              const cellText = $cellClone.text().trim()
              
              // Look for pattern with comma (gold usually has comma separator) or large number
              if (cellText && /[\d,]+\s+\d+\.?\d*\s*\/\s*m/i.test(cellText)) {
                const goldMatch = cellText.match(/([\d,]+)\s+(\d+\.?\d*)\s*\/\s*m/i)
                if (goldMatch) {
                  const total = parseFloat(goldMatch[1].replace(/,/g, ''))
                  // Gold should be reasonable (between 5000 and 50000 typically)
                  if (total >= 5000 && total <= 50000) {
                    gold = {
                      total: total,
                      perMinute: parseFloat(goldMatch[2])
                    }
                    console.log(`[DEBUG] Extracted gold from cell ${i}:`, gold)
                    break
                  }
                }
              }
            }
          }
          
          if (!gold) {
            console.log(`[DEBUG] WARNING: Could not extract gold for ${championName}. Full row text: "${fullRowText.substring(0, 300)}"`)
          }
        }
      }

      // Only add if we have valid data
      if (games > 0 && championName && championName.length >= 2) {
        const championData = {
          championName: championName,
          games,
          wins,
          losses,
          winrate: winrate || (games > 0 && wins > 0 ? (wins / games) * 100 : 0)
        }
        
        // Add optional stats if available
        if (kda) championData.kda = kda
        if (damage) championData.damage = damage
        if (wards) championData.wards = wards
        if (cs) championData.cs = cs
        if (gold) championData.gold = gold
        
        champions.push(championData)
        const fieldsPresent = []
        if (championData.kda) fieldsPresent.push('kda')
        if (championData.damage) fieldsPresent.push('damage')
        if (championData.wards) fieldsPresent.push('wards')
        if (championData.cs) fieldsPresent.push('cs')
        if (championData.gold) fieldsPresent.push('gold')
        console.log(`[DEBUG] Added champion: ${championName} - ${games} games (${wins}W ${losses}L, ${winrate}%)`)
        console.log(`[DEBUG] Champion ${championName} fields: ${fieldsPresent.join(', ') || 'none'}`)
        console.log(`[DEBUG] Champion ${championName} full data:`, JSON.stringify(championData, null, 2))
      } else {
        console.log(`[DEBUG] Skipped champion: ${championName} - games: ${games}, name length: ${championName.length}`)
      }
    })
    
    console.log(`[Backend] === Champion Processing Summary ===`)
    console.log(`[Backend] Total champions extracted: ${champions.length}`)
    if (champions.length > 0) {
      console.log(`[Backend] Sample champions:`, champions.slice(0, 5).map(c => `${c.championName}: ${c.games} games (${c.wins}W ${c.losses}L)`))
    }
    
    // Remove duplicates and sort by games (most played first, matching op.gg order)
    const uniqueChampions = []
    const seen = new Set()
    for (const champ of champions) {
      const key = champ.championName.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        uniqueChampions.push(champ)
      } else {
        console.log(`[Backend] Duplicate champion skipped: ${champ.championName}`)
      }
    }
    
    // Sort by games descending (most played first)
    uniqueChampions.sort((a, b) => b.games - a.games)

    console.log(`[Backend] After deduplication: ${uniqueChampions.length} unique champions`)
    console.log(`[Backend] Top 5 champions:`, uniqueChampions.slice(0, 5).map(c => `${c.championName}: ${c.games} games (${c.wins}W ${c.losses}L, ${c.winrate.toFixed(1)}%)`))
    
    // Log field presence for first champion to verify all fields are included
    if (uniqueChampions.length > 0) {
      const firstChamp = uniqueChampions[0]
      const fieldsInFirst = Object.keys(firstChamp).filter(k => !['championName', 'games', 'wins', 'losses', 'winrate'].includes(k))
      console.log(`[Backend] First champion (${firstChamp.championName}) has fields:`, fieldsInFirst)
      console.log(`[Backend] First champion full structure:`, JSON.stringify(firstChamp, null, 2))
      
      // Count how many champions have each field
      const fieldCounts = {
        kda: 0,
        damage: 0,
        wards: 0,
        cs: 0,
        gold: 0
      }
      uniqueChampions.forEach(champ => {
        if (champ.kda) fieldCounts.kda++
        if (champ.damage) fieldCounts.damage++
        if (champ.wards) fieldCounts.wards++
        if (champ.cs) fieldCounts.cs++
        if (champ.gold) fieldCounts.gold++
      })
      console.log(`[Backend] Field extraction summary:`, fieldCounts)
      console.log(`[Backend] Total champions: ${uniqueChampions.length}`)
    }
    
    // If no champions found, try alternative extraction methods
    if (uniqueChampions.length === 0) {
      console.log(`[Backend] WARNING: No champions found with primary method!`)
      console.log(`[Backend] Trying alternative extraction methods...`)
      
      // Log detailed HTML structure for debugging
      console.log(`[Backend] === HTML Structure Analysis ===`)
      console.log(`[Backend] Total elements: ${$('*').length}`)
      console.log(`[Backend] Total divs: ${$('div').length}`)
      console.log(`[Backend] Total spans: ${$('span').length}`)
      console.log(`[Backend] Elements with 'champion' in class: ${$('[class*="champion"]').length}`)
      console.log(`[Backend] Elements with 'Champion' in class: ${$('[class*="Champion"]').length}`)
      
      // Check for common op.gg class patterns
      const possibleChampionContainers = $('[class*="champion-list"], [class*="champion-table"], [class*="champion-item"], [class*="champion-row"]')
      console.log(`[Backend] Found ${possibleChampionContainers.length} elements with champion-list/table/item/row classes`)
      
      // Alternative method 1: Look for any rows with champion images and stats
      const allRowsWithImages = $('tr').filter((i, row) => {
        const $row = $(row)
        return $row.find('img[alt]').length > 0 && /\d+/.test($row.text())
      })
      console.log(`[Backend] Found ${allRowsWithImages.length} rows with images and numbers`)
      
      // Alternative method 2: Look for div-based structures (op.gg might use divs now)
      const divChampions = $('[class*="champion"], [class*="Champion"]').filter((i, elem) => {
        const $elem = $(elem)
        return $elem.find('img[alt]').length > 0
      })
      console.log(`[Backend] Found ${divChampions.length} div elements with champion images`)
      
      // Alternative method 3: Look for data attributes
      const dataChampions = $('[data-champion], [data-champion-name]')
      console.log(`[Backend] Found ${dataChampions.length} elements with champion data attributes`)
      
      // Alternative method 4: Look for any element containing champion image and stats text
      const allCandidateElements = $('*').filter((i, elem) => {
        const $elem = $(elem)
        const hasImage = $elem.find('img[alt]').length > 0 || $elem.is('img[alt]')
        const hasStats = /\d+[WLP]\d*[WLP]?\d*%/.test($elem.text()) || /\d+\s*W\s*\d+\s*L/.test($elem.text())
        return hasImage && hasStats
      })
      console.log(`[Backend] Found ${allCandidateElements.length} candidate elements with images and stats patterns`)
      
      // Log sample of what we're seeing
      const sampleRows = allRowsWithImages.slice(0, 5)
      sampleRows.each((i, row) => {
        const $row = $(row)
        const imgAlt = $row.find('img[alt]').first().attr('alt')
        const rowText = $row.text().substring(0, 150)
        const rowHtml = $row.html().substring(0, 200)
        console.log(`[Backend] Sample row ${i}: img="${imgAlt}", text="${rowText}", html="${rowHtml}"`)
      })
      
      // Log a few div candidates
      const sampleDivs = divChampions.slice(0, 3)
      sampleDivs.each((i, div) => {
        const $div = $(div)
        const imgAlt = $div.find('img[alt]').first().attr('alt')
        const divText = $div.text().substring(0, 150)
        const divClass = $div.attr('class') || ''
        console.log(`[Backend] Sample div ${i}: class="${divClass}", img="${imgAlt}", text="${divText}"`)
      })
      
      // Try to extract from div-based structures first (modern op.gg might use divs)
      if (divChampions.length > 0) {
        console.log(`[Backend] Attempting extraction from ${divChampions.length} div elements...`)
        divChampions.each((i, elem) => {
          const $elem = $(elem)
          const imgAlt = $elem.find('img[alt]').first().attr('alt')
          if (imgAlt && imgAlt.length > 2) {
            const elemText = $elem.text()
            // Try to extract stats - look for patterns like "32W 28L 53%" or "32W28P53%"
            const winsMatch = elemText.match(/(\d+)\s*W(?!\d|%)/i) || elemText.match(/(\d+)\s*W\b/i)
            const lossesMatch = elemText.match(/(\d+)\s*[LP](?!\d|%)/i) || elemText.match(/(\d+)\s*L(?!\d|%)/i)
            const winrateMatch = elemText.match(/(\d+\.?\d*)\s*%/)
            
            if (winsMatch || lossesMatch) {
              const wins = winsMatch ? parseInt(winsMatch[1]) : 0
              const losses = lossesMatch ? parseInt(lossesMatch[1]) : 0
              const games = wins + losses
              const winrate = winrateMatch ? parseFloat(winrateMatch[1]) : (games > 0 && wins > 0 ? (wins / games) * 100 : 0)
              
              if (games > 0) {
                const champ = {
                  championName: imgAlt.trim(),
                  games,
                  wins,
                  losses,
                  winrate
                }
                champions.push(champ)
                console.log(`[Backend] Extracted champion from div:`, champ)
              }
            }
          }
        })
      }
      
      // Try to extract from any structure we find
      if (allRowsWithImages.length > 0) {
        console.log(`[Backend] Attempting extraction from ${allRowsWithImages.length} candidate rows...`)
        allRowsWithImages.each((i, elem) => {
          const $row = $(elem)
          const imgAlt = $row.find('img[alt]').first().attr('alt')
          if (imgAlt && imgAlt.length > 2) {
            // Try to extract stats from this row
            const rowText = $row.text()
            const winsMatch = rowText.match(/(\d+)\s*W(?!\d|%)/i) || rowText.match(/(\d+)\s*W\b/i)
            const lossesMatch = rowText.match(/(\d+)\s*[LP](?!\d|%)/i) || rowText.match(/(\d+)\s*L(?!\d|%)/i)
            const winrateMatch = rowText.match(/(\d+\.?\d*)\s*%/)
            
            if (winsMatch || lossesMatch) {
              const wins = winsMatch ? parseInt(winsMatch[1]) : 0
              const losses = lossesMatch ? parseInt(lossesMatch[1]) : 0
              const games = wins + losses
              const winrate = winrateMatch ? parseFloat(winrateMatch[1]) : (games > 0 && wins > 0 ? (wins / games) * 100 : 0)
              
              const champ = {
                championName: imgAlt.trim(),
                games,
                wins,
                losses,
                winrate
              }
              if (champ.games > 0) {
                champions.push(champ)
                console.log(`[Backend] Extracted champion from row:`, champ)
              }
            }
          }
        })
      }
      
      // Re-process with newly found champions
      const newUniqueChampions = []
      const newSeen = new Set()
      for (const champ of champions) {
        const key = champ.championName.toLowerCase().trim()
        if (!newSeen.has(key)) {
          newSeen.add(key)
          newUniqueChampions.push(champ)
        }
      }
      uniqueChampions.push(...newUniqueChampions)
      console.log(`[Backend] After alternative extraction: ${uniqueChampions.length} champions`)
      
      // If still no champions, log more HTML for manual inspection
      if (uniqueChampions.length === 0) {
        console.log(`[Backend] === Still no champions found. Logging more HTML for inspection ===`)
        // Log a larger sample of HTML that might contain champion data
        const bodyContent = $('body').html() || ''
        const relevantSection = bodyContent.substring(0, 10000)
        console.log(`[Backend] Body HTML sample (first 10000 chars):`, relevantSection)
      }
    }

    // Extract rank info - adjust selectors based on actual structure
    const rankText = $('.tier-rank').text().trim() || 
                     $('.summoner-tier-rank').text().trim() || 
                     $('[class*="tier"]').first().text().trim() || 
                     ''
    
    const lpText = $('.lp').text().trim() || 
                   $('.summoner-lp').text().trim() || 
                   $('[class*="lp"]').first().text().trim() || 
                   ''
    const lp = parseInt(lpText.replace(/[^0-9]/g, '')) || 0

    // Log extraction summary for debugging
    const extractionSummary = {
      totalChampions: uniqueChampions.length,
      withKDA: uniqueChampions.filter(c => c.kda).length,
      withDamage: uniqueChampions.filter(c => c.damage).length,
      withWards: uniqueChampions.filter(c => c.wards).length,
      withCS: uniqueChampions.filter(c => c.cs).length,
      withGold: uniqueChampions.filter(c => c.gold).length
    }
    console.log(`[Backend] Extraction Summary:`, extractionSummary)
    
    // Log first champion's full row text for debugging
    if (championRows.length > 0) {
      const firstRow = $(championRows[0])
      const firstRowText = firstRow.text()
      const firstRowCells = firstRow.children('td')
      console.log(`[Backend] First champion row has ${firstRowCells.length} cells`)
      console.log(`[Backend] First champion row text (first 500 chars):`, firstRowText.substring(0, 500))
      firstRowCells.each((idx, cell) => {
        const cellText = $(cell).clone().find('table').remove().end().text().trim()
        console.log(`[Backend] First champion cell ${idx}: "${cellText.substring(0, 100)}"`)
      })
    }
    
    const responseData = {
      champions: uniqueChampions,
      rank: rankText,
      lp,
      lastUpdated: new Date().toISOString(),
      _debug: extractionSummary // Include in response for debugging
    }
    
    console.log(`[Backend] Response data:`, JSON.stringify(responseData, null, 2))
    console.log(`[Backend] Champions count in response:`, uniqueChampions.length)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    }
  } catch (error) {
    console.error('Scraping error:', error)
    
    // Return user-friendly error
    let errorMessage = 'Failed to scrape op.gg'
    if (error.response) {
      errorMessage = `op.gg returned error: ${error.response.status}`
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - op.gg is slow or unavailable'
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        message: error.message 
      })
    }
  }
}

