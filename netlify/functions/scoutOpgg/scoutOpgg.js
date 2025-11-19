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
    
    // Fetch the page with timeout (8 seconds to leave buffer for processing)
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    })

    const $ = cheerio.load(response.data)

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
      
      // Must have stats (games/wins/losses) to be a main champion row
      // Get only direct children td elements (not from nested tables)
      const cells = $row.children('td')
      if (cells.length < 3) return false // Too few cells, probably not a main row
      
      // Check if cells contain numbers (stats) - but exclude nested table content
      let hasStats = false
      cells.each((idx, cell) => {
        const $cell = $(cell)
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
      
      return true
    })
    
    championRows.each((i, elem) => {
      const $row = $(elem)
      
      // Extract champion name - try multiple selectors
      let championName = ''
      
      // Try data attributes first
      championName = $row.attr('data-champion') || 
                     $row.find('[data-champion-name]').attr('data-champion-name') ||
                     $row.find('[data-champion]').attr('data-champion')
      
      // Try class-based selectors
      if (!championName) {
        championName = $row.find('.champion-name, [class*="champion-name"], .name').first().text().trim()
      }
      
      // Try image alt text
      if (!championName) {
        const imgAlt = $row.find('img[alt]').first().attr('alt') || ''
        // Extract champion name from alt (remove file extension, clean up)
        championName = imgAlt.replace(/\.(png|jpg|jpeg|webp)$/i, '').trim()
      }
      
      // Try table cell (second column often has name)
      if (!championName && $row.is('tr')) {
        championName = $row.find('td:nth-child(2), td:nth-child(1)').first().text().trim()
      }
      
      // Clean up champion name
      championName = championName.replace(/['"]/g, '').trim()
      
      if (!championName || championName.length < 2) return
      
      // Extract stats from individual table cells
      // op.gg typically has: Champion | Games | Wins | Losses | Winrate | KDA
      // CRITICAL: We must extract each stat from its specific cell, NOT concatenate them
      // When a champion is expanded, matchups are in nested tables - we must exclude those
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      
      if ($row.is('tr')) {
        // CRITICAL: Get only direct children td elements (not from nested tables)
        // When a champion is expanded, matchups are in nested tables inside cells
        const directCells = $row.children('td')
        
        // op.gg structure: [Champion Icon/Name] | [Games] | [Wins] | [Losses] | [Winrate %] | [KDA]
        // We'll use positional approach since class names may vary
        // Skip first cell (champion icon/name), then parse cells 1-5
        
        for (let idx = 1; idx < Math.min(directCells.length, 7); idx++) {
          const $cell = $(directCells[idx])
          
          // CRITICAL: Remove ALL nested content before extracting text
          // This includes nested tables (matchup data) and any other nested elements
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove() // Remove nested tables
          $cellClone.find('[class*="matchup"]').remove() // Remove matchup elements
          $cellClone.find('[class*="opponent"]').remove() // Remove opponent elements
          const cellText = $cellClone.text().trim()
          
          // Skip empty cells
          if (!cellText) continue
          
          // Check for winrate first (has % symbol) - this is most distinctive
          if (cellText.includes('%')) {
            const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
            if (winrateMatch) {
              const num = parseFloat(winrateMatch[1])
              if (num > 0 && num <= 100 && winrate === 0) {
                winrate = num
                continue
              }
            }
          }
          
          // Check for KDA (has slashes) - this is also distinctive
          if (cellText.includes('/') && cellText.match(/\d+\s*\/\s*\d+\s*\/\s*\d+/)) {
            const kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
            if (kdaMatch && !kda) {
              kda = {
                kills: parseFloat(kdaMatch[1]),
                deaths: parseFloat(kdaMatch[2]),
                assists: parseFloat(kdaMatch[3])
              }
              continue
            }
          }
          
          // For regular numbers, extract ONLY the first number from the cell
          // This prevents concatenation of multiple numbers
          const firstNumberMatch = cellText.match(/^\s*(\d+)/)
          if (firstNumberMatch) {
            const num = parseInt(firstNumberMatch[1])
            
            // Sanity check: numbers should be reasonable
            if (num <= 0 || num >= 10000) continue
            
            // Assign based on position (typical op.gg layout)
            // Cell 1 = Games, Cell 2 = Wins, Cell 3 = Losses
            if (idx === 1 && games === 0) {
              games = num
            } else if (idx === 2 && wins === 0) {
              wins = num
            } else if (idx === 3 && losses === 0) {
              losses = num
            } else {
              // Fallback: assign to first available slot
              if (games === 0) {
                games = num
              } else if (wins === 0) {
                wins = num
              } else if (losses === 0) {
                losses = num
              }
            }
          }
        }
        
        // Calculate games from wins + losses if we have those but not games
        if (games === 0 && wins > 0 && losses > 0) {
          games = wins + losses
        }
        
        // Calculate winrate from wins/losses if we have those but not winrate
        if (winrate === 0 && games > 0 && wins > 0) {
          winrate = (wins / games) * 100
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        champions: uniqueChampions,
        rank: rankText,
        lp,
        lastUpdated: new Date().toISOString()
      })
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

