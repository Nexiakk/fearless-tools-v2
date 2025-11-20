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
      // Navigate through the nested structure to find champion data
      // op.gg structure might be in props.pageProps or similar
      const pageProps = nextData?.props?.pageProps
      if (pageProps) {
        console.log(`[Backend] Found pageProps, keys:`, Object.keys(pageProps))
        // Look for champion/champions data in various possible locations
        const championsData = pageProps.champions || 
                             pageProps.championStats || 
                             pageProps.data?.champions ||
                             pageProps.summoner?.champions ||
                             pageProps.summonerChampions
        if (championsData && Array.isArray(championsData) && championsData.length > 0) {
          console.log(`[Backend] Found champions in __NEXT_DATA__: ${championsData.length} champions`)
          // Process the champions data
          const extractedChampions = championsData.map(champ => {
            return {
              championName: champ.championName || champ.name || champ.champion || '',
              games: champ.games || champ.totalGames || (champ.wins || 0) + (champ.losses || 0),
              wins: champ.wins || 0,
              losses: champ.losses || 0,
              winrate: champ.winrate || champ.winRate || (champ.games > 0 && champ.wins > 0 ? (champ.wins / champ.games) * 100 : 0),
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
            const rankText = pageProps.summoner?.tier || pageProps.tier || pageProps.rank || ''
            const lp = pageProps.summoner?.lp || pageProps.lp || 0
            
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
    
    // Get rows from the main table
    // CRITICAL: Only get DIRECT children of tbody, not nested rows
    let championRows = $()
    if (mainTable && mainTable.length > 0) {
      if (mainTable.find('tbody').length > 0) {
        // Get ONLY direct children of tbody (not nested)
        championRows = mainTable.find('tbody').children('tr')
      } else {
        // No tbody, get direct children of table (not nested)
        championRows = mainTable.children('tr').not('thead tr')
      }
    } else {
      // Fallback: find rows directly
      championRows = $('table tbody tr').filter((i, row) => {
        const $row = $(row)
        // Must have champion image
        if ($row.find('img[alt], img[src*="champion"]').length === 0) return false
        // Must NOT be in matchup section
        if ($row.closest('[class*="matchup"]').length > 0) return false
        // Must be a direct child of tbody (not nested)
        const trAncestors = $row.parents('tr').length
        return trAncestors === 0
      })
    }
    
    // First, identify and skip the summary row (first row like "Wszyscy bohaterowie")
    const allRows = championRows.toArray()
    if (allRows.length > 0) {
      const firstRow = $(allRows[0])
      const firstRowText = firstRow.text().toLowerCase()
      // Check if first row is a summary row
      if (firstRowText.includes('wszyscy') || firstRowText.includes('all') || 
          firstRowText.includes('total') || firstRowText.includes('bohaterowie') || 
          firstRowText.includes('champions') || !firstRow.find('img[alt]').length) {
        // Remove first row from array
        allRows.shift()
        championRows = $(allRows)
      }
    }
    
    // Filter out matchup rows and ensure we only get main champion rows
    // CRITICAL: When op.gg expands the first champion, it creates nested tables/rows for matchups
    // We must ONLY get direct children of tbody, and skip any rows that are inside nested tables
    championRows = championRows.filter((i, elem) => {
      const $row = $(elem)
      
      // CRITICAL CHECK: Skip if this row is inside a nested table
      // When a champion is expanded, matchups are in a nested table inside that row
      const parentTable = $row.closest('table')
      if (parentTable.length > 0) {
        const tableParent = parentTable.parent()
        // If the table's parent is a td (cell in another row), this is a nested table
        if (tableParent.is('td')) {
          // This is definitely a nested table - skip it
          return false
        }
        // Check if this table is nested inside another row
        const containingRow = tableParent.closest('tr')
        if (containingRow.length > 0 && containingRow[0] !== $row[0]) {
          // This is a nested table inside an expanded row - skip it
          return false
        }
      }
      
      // Must have a champion image to be a valid champion row
      const hasChampionImage = $row.find('> td img[alt], > td img[src*="champion"], td:first-child img[alt]').length > 0
      if (!hasChampionImage) return false
      
      // Skip if it's explicitly a matchup row
      const rowClass = ($row.attr('class') || '').toLowerCase()
      if (rowClass.includes('matchup') || 
          rowClass.includes('opponent') ||
          $row.attr('data-type') === 'matchup' ||
          $row.attr('data-type') === 'opponent') {
        return false
      }
      
      // Skip if inside an expanded matchup section
      if ($row.closest('[class*="matchup"]').length > 0 ||
          $row.closest('[class*="expanded"]').length > 0 ||
          $row.closest('[class*="opponent"]').length > 0) {
        return false
      }
      
      // CRITICAL: Skip if this row contains nested tables - it's expanded and has matchup data
      // We want only the main champion rows, not expanded rows with nested content
      if ($row.find('table').length > 0) {
        // This row has nested tables - it's expanded
        // We still want to process it, but we'll be extra careful in stat extraction
        // However, if it has too many nested tables or matchup-specific content, skip it
        const nestedTables = $row.find('table').length
        const matchupElements = $row.find('[class*="matchup"], [class*="opponent"]').length
        // If there are many nested tables or matchup elements, this might be mostly matchup data
        // Skip it to avoid confusion
        if (nestedTables > 2 || matchupElements > 3) {
          return false
        }
      }
      
      // Must have stats (games/wins/losses) to be a main champion row
      // Get only direct children td elements (not from nested tables)
      const cells = $row.children('td')
      if (cells.length < 3) return false // Too few cells, probably not a main row
      
      // Check if cells contain numbers (stats) - but exclude nested table content
      let hasStats = false
      let cellsWithTables = 0
      cells.each((idx, cell) => {
        const $cell = $(cell)
        // Count cells with nested tables
        if ($cell.find('table').length > 0) {
          cellsWithTables++
        }
        // CRITICAL: Remove nested tables before checking for stats
        const $cellClone = $cell.clone()
        $cellClone.find('table').remove() // Remove nested tables
        const cleanText = $cellClone.text().trim()
        // Skip first cell (usually champion name/icon)
        if (idx > 0 && /\d+/.test(cleanText)) {
          hasStats = true
          return false // break
        }
      })
      if (!hasStats) return false
      
      // If most cells have nested tables, this row is probably mostly matchup data
      // Only allow if at least half the cells don't have tables
      if (cellsWithTables > cells.length / 2) {
        return false
      }
      
      return true
    })
    
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
            $cellClone.find('table, [class*="matchup"]').remove()
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
      championName = championName.replace(/['"]/g, '').trim()
      
      if (!championName || championName.length < 2) {
        console.log(`[DEBUG] Skipping row - no valid champion name found`)
        return
      }
      
      console.log(`[DEBUG] Processing champion: ${championName}`)
      
      // Extract stats from individual table cells
      // Based on actual op.gg HTML structure:
      // Column 1: Rank number
      // Column 2: Champion name/image
      // Column 3: Games/Wins/Losses/Winrate (all in one cell with progress bar)
      // Column 4: KDA
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      
      if ($row.is('tr')) {
        const directCells = $row.children('td')
        
        // Column 3 (index 2) contains: Games/Wins/Losses/Winrate
        // Structure: <div> with progress bar showing "32W" and "28P", plus "53%" winrate
        if (directCells.length > 2) {
          const statsCell = $(directCells[2])
          
          // Skip if this cell contains a nested table (expanded matchup data)
          if (statsCell.find('table').length === 0) {
            // Get all text from the cell
            const cellText = statsCell.text()
            
            // DEBUG: Log what we're extracting
            console.log(`[DEBUG] Champion: ${championName}, Stats cell text: "${cellText}"`)
            
            // Extract winrate (has % symbol) - e.g., "53%"
            const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
            if (winrateMatch) {
              winrate = parseFloat(winrateMatch[1])
              console.log(`[DEBUG] Extracted winrate: ${winrate}%`)
            }
            
            // Extract wins and losses from progress bar
            // HTML structure: "32W" (wins) and "28P" (losses) in spans, plus "53%" winrate
            // The text might be "32W28P53%" or "32 W 28 P 53%" depending on extraction
            // Pattern 1: "32W" or "32 W" (wins) - look for number followed by W (not followed by digit or %)
            const winsMatch = cellText.match(/(\d+)\s*W(?!\d|%)/i) || 
                             cellText.match(/(\d+)\s*Wins?/i) ||
                             cellText.match(/(\d+)\s*W\b/i)
            
            // Pattern 2: "28P" or "28 P" (losses - P stands for Polish "Przegrane" or "Played")
            // Also try "28L" for losses
            const lossesMatch = cellText.match(/(\d+)\s*P(?!\d|%)/i) ||
                               cellText.match(/(\d+)\s*L(?!\d|%)/i) ||
                               cellText.match(/(\d+)\s*Loss(?:es)?/i) ||
                               cellText.match(/(\d+)\s*P\b/i)
            
            if (winsMatch) {
              wins = parseInt(winsMatch[1])
              console.log(`[DEBUG] Extracted wins: ${wins}`)
            }
            if (lossesMatch) {
              losses = parseInt(lossesMatch[1])
              console.log(`[DEBUG] Extracted losses: ${losses}`)
            }
            
            // Calculate games from wins + losses
            if (wins > 0 || losses > 0) {
              games = wins + losses
              console.log(`[DEBUG] Calculated games: ${games}`)
            }
            
            // If we have games but no winrate, calculate it
            if (winrate === 0 && games > 0 && wins > 0) {
              winrate = (wins / games) * 100
              console.log(`[DEBUG] Calculated winrate: ${winrate}%`)
            }
          } else {
            console.log(`[DEBUG] Skipping stats cell for ${championName} - contains nested table`)
          }
        }
        
        // Column 4 (index 3) contains: KDA
        // Structure: "2.19:1" and "3.9 / 4.5 / 6 (42%)"
        if (directCells.length > 3 && !kda) {
          const kdaCell = $(directCells[3])
          
          // Skip if this cell contains a nested table
          if (kdaCell.find('table').length === 0) {
            const kdaText = kdaCell.text()
            
            // Look for KDA pattern: "3.9 / 4.5 / 6"
            const kdaMatch = kdaText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
            if (kdaMatch) {
              kda = {
                kills: parseFloat(kdaMatch[1]),
                deaths: parseFloat(kdaMatch[2]),
                assists: parseFloat(kdaMatch[3])
              }
            }
          }
        }
      }

      // Only add if we have valid data
      if (games > 0 && championName && championName.length >= 2) {
        champions.push({
          championName: championName,
          games,
          wins,
          losses,
          winrate,
          kda
        })
      }
    })
    
    // Remove duplicates and sort by games (most played first, matching op.gg order)
    const uniqueChampions = []
    const seen = new Set()
    for (const champ of champions) {
      const key = champ.championName.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        uniqueChampions.push(champ)
      }
    }
    
    // Sort by games descending (most played first)
    uniqueChampions.sort((a, b) => b.games - a.games)

    console.log(`[Backend] Processed ${champions.length} champions, ${uniqueChampions.length} unique`)
    console.log(`[Backend] First 3 champions:`, uniqueChampions.slice(0, 3))
    
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

    const responseData = {
      champions: uniqueChampions,
      rank: rankText,
      lp,
      lastUpdated: new Date().toISOString()
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

