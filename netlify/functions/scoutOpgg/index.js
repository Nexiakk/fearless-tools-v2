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
    
    // Debug: Check if we can find any tables
    const totalTables = $('table').length
    console.log(`[Backend] Found ${totalTables} tables in HTML`)

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
    
    // If no champions found, log HTML structure for debugging
    if (uniqueChampions.length === 0) {
      console.log(`[Backend] WARNING: No champions found!`)
      console.log(`[Backend] HTML sample (first 2000 chars):`, response.data.substring(0, 2000))
      console.log(`[Backend] All table elements:`, $('table').length)
      console.log(`[Backend] All tr elements:`, $('tr').length)
      console.log(`[Backend] All img elements with alt:`, $('img[alt]').length)
      // Try to find any champion-related content
      const championImages = $('img[alt]').toArray().slice(0, 10).map(img => $(img).attr('alt'))
      console.log(`[Backend] First 10 image alt texts:`, championImages)
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

