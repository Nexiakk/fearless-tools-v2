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
    
    // Strategy: Find the MAIN champion list table for CURRENT SEASON, not matchup tables
    // op.gg has a main table for champions, and separate tables for matchups
    // We want the current season's champion list, not previous seasons or matchups
    
    // First, try to find a container that indicates "current season" or main champion list
    // Look for sections/containers that might indicate the main list
    let mainTable = null
    let mainContainer = null
    
    // Try to find containers that indicate current season or main list
    const possibleContainers = [
      '[class*="current-season"]',
      '[class*="champion-list"]',
      '[class*="most-champion"]',
      'section[class*="champion"]',
      'div[class*="champion"]'
    ]
    
    for (const selector of possibleContainers) {
      const containers = $(selector).filter((i, cont) => {
        const $cont = $(cont)
        // Must not be in matchup section
        if ($cont.closest('[class*="matchup"]').length > 0) return false
        // Must contain a table with champion rows
        return $cont.find('table tr').filter((j, row) => {
          return $(row).find('img[alt], img[src*="champion"]').length > 0
        }).length > 0
      })
      
      if (containers.length > 0) {
        mainContainer = $(containers[0])
        break
      }
    }
    
    // Find the main champion list table
    // Look for tables that contain champion data but NOT matchup data
    const searchScope = mainContainer || $
    
    // Try to find the main champion table by looking for tables that:
    // 1. Are NOT inside matchup/expanded sections
    // 2. Have multiple rows (champion list)
    // 3. Don't have matchup-specific classes
    // 4. Are in the main container (if we found one)
    const allTables = searchScope.find('table').filter((i, table) => {
      const $table = $(table)
      // Skip if inside matchup/expanded sections
      if ($table.closest('[class*="matchup"]').length > 0 ||
          $table.closest('[class*="expanded"]').length > 0 ||
          $table.closest('[class*="opponent"]').length > 0) {
        return false
      }
      // Skip if it's a matchup table
      const tableClass = ($table.attr('class') || '').toLowerCase()
      const headerText = $table.find('thead th').text().toLowerCase()
      if (tableClass.includes('matchup') || 
          headerText.includes('opponent') ||
          headerText.includes('vs') ||
          headerText.includes('against')) {
        return false
      }
      // Must have rows with champion images
      const championRows = $table.find('tr').filter((j, row) => {
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
        const rowCount = $table.find('tbody tr, tr').not('thead tr').length
        // Prefer tables with more rows (main list has many champions)
        if (rowCount > maxRows && rowCount > 2) {
          maxRows = rowCount
          bestTable = $table
        }
      })
      mainTable = bestTable || $(allTables[0])
    }
    
    // If we found a main table, get rows from it
    // Otherwise fall back to finding rows directly
    let championRows
    if (mainTable) {
      // Get rows from the main table's tbody, or direct children if no tbody
      // CRITICAL: Only get direct children of tbody, not nested rows from expanded sections
      if (mainTable.find('tbody').length > 0) {
        // Get direct children of tbody only (not nested)
        championRows = mainTable.find('tbody').children('tr')
      } else {
        // No tbody, get direct children of table (not nested)
        championRows = mainTable.children('tr').not('thead tr')
      }
      
      // Additional safety: filter out any rows that are nested too deep
      // Main champion rows should be direct children, not nested in other elements
      championRows = championRows.filter((i, row) => {
        const $row = $(row)
        // Check how many tr ancestors this row has - if more than 1, it's nested
        const trAncestors = $row.parents('tr').length
        // Should be 0 (direct child of tbody/table) or at most 1 (if inside a wrapper)
        return trAncestors <= 1
      })
    } else {
      // Fallback: try to find champion rows more carefully
      championRows = $('table tbody tr').filter((i, row) => {
        const $row = $(row)
        // Must have champion image
        if ($row.find('img[alt], img[src*="champion"]').length === 0) return false
        // Must NOT be in matchup section
        if ($row.closest('[class*="matchup"]').length > 0) return false
        // Must NOT be a matchup row
        if ($row.hasClass('matchup') || $row.attr('class')?.includes('matchup')) return false
        // Must be a direct child of tbody (not nested)
        const trAncestors = $row.parents('tr').length
        return trAncestors === 0
      })
      
      // If still nothing, try list items
      if (championRows.length === 0) {
        championRows = $('[class*="champion-item"], [class*="champion-box"], [data-champion]')
          .filter((i, elem) => {
            const $elem = $(elem)
            return $elem.closest('[class*="matchup"]').length === 0
          })
      }
    }
    
    // First, identify and skip the summary row (first row like "Wszyscy bohaterowie")
    // We need to check this before filtering, as the filter index won't match original index
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
    
    // Filter out matchup rows, expanded sections, and ensure we only get main champion rows
    championRows = championRows.filter((i, elem) => {
      const $row = $(elem)
      
      // Must have a champion image to be a valid champion row
      const hasChampionImage = $row.find('img[alt], img[src*="champion"]').length > 0
      if (!hasChampionImage) return false
      
      // Skip if it's explicitly a matchup row
      const rowClass = ($row.attr('class') || '').toLowerCase()
      const isMatchupRow = $row.hasClass('matchup') ||
                          $row.hasClass('matchup-row') ||
                          rowClass.includes('matchup') ||
                          rowClass.includes('opponent') ||
                          $row.attr('data-type') === 'matchup' ||
                          $row.attr('data-type') === 'opponent'
      
      if (isMatchupRow) return false
      
      // Skip if inside an expanded matchup section (check all parent elements)
      const isInExpandedSection = $row.closest('[class*="matchup"]').length > 0 ||
                                 $row.closest('[class*="expanded"]').length > 0 ||
                                 $row.closest('[class*="opponent"]').length > 0 ||
                                 $row.closest('.matchup-table').length > 0 ||
                                 $row.closest('[class*="vs"]').length > 0 ||
                                 $row.closest('table.matchup').length > 0 ||
                                 $row.parents().filter((j, parent) => {
                                   const $parent = $(parent)
                                   const parentClass = ($parent.attr('class') || '').toLowerCase()
                                   return parentClass.includes('matchup') || 
                                          parentClass.includes('opponent') ||
                                          parentClass.includes('expanded')
                                 }).length > 0
      
      if (isInExpandedSection) return false
      
      // Skip if it contains matchup-specific elements or text
      const rowText = $row.text().toLowerCase()
      const hasMatchupElements = $row.find('[class*="matchup"], [class*="opponent"], [class*="vs"], [class*="against"]').length > 0
      const hasMatchupText = rowText.includes('vs') && rowText.includes('win') && rowText.length < 50 // Short text with "vs" is likely matchup
      
      if (hasMatchupElements || hasMatchupText) return false
      
      // Must have stats (games/wins/losses) to be a main champion row, not a matchup row
      // Matchup rows typically don't have full stats in the same format
      const cells = $row.find('td')
      if (cells.length > 0) {
        // Check if this looks like a main champion row (has multiple stat cells)
        // Main rows usually have 4+ cells (champion, games, wins, losses, winrate, kda)
        // Matchup rows might have fewer cells or different structure
        const cellCount = cells.length
        if (cellCount < 3) return false // Too few cells, probably not a main row
        
        // Check if cells contain numbers (stats)
        let hasStats = false
        cells.each((idx, cell) => {
          const cellText = $(cell).text().trim()
          // Skip first cell (usually champion name/icon)
          if (idx > 0 && /\d+/.test(cellText)) {
            hasStats = true
            return false // break
          }
        })
        if (!hasStats) return false
      }
      
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
      // We need to get each stat from its specific cell, not concatenate them
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      
      if ($row.is('tr')) {
        // Get all table cells
        const cells = $row.find('td')
        
        // Try to find stats in specific cells
        // Common op.gg structure: [Champion Icon/Name] | [Games] | [Wins] | [Losses] | [Winrate] | [KDA]
        // Index might vary, so we'll try multiple approaches
        
        // Method 1: Try data attributes or specific classes
        cells.each((idx, cell) => {
          const $cell = $(cell)
          const cellText = $cell.text().trim()
          const cellClass = $cell.attr('class') || ''
          
          // Skip empty cells
          if (!cellText) return
          
          // Games (usually just a number)
          if (cellClass.includes('game') || $cell.attr('data-stat') === 'games') {
            // Extract first number only (avoid concatenation)
            const numMatch = cellText.match(/^\s*(\d+)/)
            if (numMatch) {
              const num = parseInt(numMatch[1])
              if (num > 0 && num < 10000 && games === 0) games = num
            }
          }
          // Wins
          else if (cellClass.includes('win') && !cellClass.includes('winrate') && $cell.attr('data-stat') !== 'winrate') {
            const numMatch = cellText.match(/^\s*(\d+)/)
            if (numMatch) {
              const num = parseInt(numMatch[1])
              if (num > 0 && num < 10000 && wins === 0) wins = num
            }
          }
          // Losses
          else if (cellClass.includes('loss')) {
            const numMatch = cellText.match(/^\s*(\d+)/)
            if (numMatch) {
              const num = parseInt(numMatch[1])
              if (num > 0 && num < 10000 && losses === 0) losses = num
            }
          }
          // Winrate (usually has %)
          else if (cellClass.includes('winrate') || cellText.includes('%')) {
            const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
            if (winrateMatch) {
              const num = parseFloat(winrateMatch[1])
              if (num > 0 && num <= 100 && winrate === 0) winrate = num
            }
          }
          // KDA (has slashes)
          else if (cellText.includes('/') && !kda) {
            const kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
            if (kdaMatch) {
              kda = {
                kills: parseFloat(kdaMatch[1]),
                deaths: parseFloat(kdaMatch[2]),
                assists: parseFloat(kdaMatch[3])
              }
            }
          }
        })
        
        // Method 2: If we didn't find stats via classes, try positional approach
        // Skip first cell (usually champion icon/name), then try cells 1-5
        // op.gg structure is typically: [Champion] | [Games] | [Wins] | [Losses] | [Winrate %] | [KDA]
        if (games === 0 && wins === 0 && losses === 0) {
          // Try to parse from cell positions
          for (let idx = 1; idx < Math.min(cells.length, 6); idx++) {
            const $cell = $(cells[idx])
            const cellText = $cell.text().trim()
            
            // Skip empty cells
            if (!cellText) continue
            
            // Extract just the FIRST number from the cell text (avoid concatenation)
            // Use match to get the first number, not all numbers
            const firstNumberMatch = cellText.match(/^\s*(\d+)/)
            
            // Check for winrate (has % symbol)
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
            
            // Check for KDA (has slashes)
            if (cellText.includes('/') && !kda) {
              const kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
              if (kdaMatch) {
                kda = {
                  kills: parseFloat(kdaMatch[1]),
                  deaths: parseFloat(kdaMatch[2]),
                  assists: parseFloat(kdaMatch[3])
                }
                continue
              }
            }
            
            // For regular numbers, extract first number only
            if (firstNumberMatch) {
              const num = parseInt(firstNumberMatch[1])
              
              // Assign based on position and what we've already found
              // Cell 1 is usually games, cell 2 is wins, cell 3 is losses
              if (idx === 1 && games === 0 && num > 0 && num < 10000) {
                games = num
              } else if (idx === 2 && wins === 0 && num > 0 && num < 10000) {
                wins = num
              } else if (idx === 3 && losses === 0 && num > 0 && num < 10000) {
                losses = num
              } else if (games === 0 && num > 0 && num < 10000) {
                // Fallback: if we haven't found games yet, this might be it
                games = num
              } else if (wins === 0 && num > 0 && num < 10000) {
                // Fallback: if we haven't found wins yet, this might be it
                wins = num
              } else if (losses === 0 && num > 0 && num < 10000) {
                // Fallback: if we haven't found losses yet, this might be it
                losses = num
              }
            }
          }
        }
        
        // Calculate games from wins + losses if we have those but not games
        if (games === 0 && wins > 0 && losses > 0) {
          games = wins + losses
        }
      } else {
        // Not a table row, try other selectors
        const gamesText = $row.find('[data-stat="games"], .games, [class*="game"]').first().text().trim()
        const winsText = $row.find('[data-stat="wins"], .wins, [class*="win"]').first().text().trim()
        const lossesText = $row.find('[data-stat="losses"], .losses, [class*="loss"]').first().text().trim()
        const winrateText = $row.find('[data-stat="winrate"], .win-rate, .winrate, [class*="winrate"]').first().text().trim()
        const kdaText = $row.find('[data-stat="kda"], .kda, [class*="kda"]').first().text().trim()
        
        // Extract first number only (avoid concatenation)
        const gamesMatch = gamesText.match(/\d+/)
        const winsMatch = winsText.match(/\d+/)
        const lossesMatch = lossesText.match(/\d+/)
        const winrateMatch = winrateText.match(/\d+\.?\d*/)
        const kdaMatch = kdaText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
        
        games = gamesMatch ? parseInt(gamesMatch[0]) : 0
        wins = winsMatch ? parseInt(winsMatch[0]) : 0
        losses = lossesMatch ? parseInt(lossesMatch[0]) : 0
        winrate = winrateMatch ? parseFloat(winrateMatch[0]) : 0
        
        if (kdaMatch) {
          kda = {
            kills: parseFloat(kdaMatch[1]),
            deaths: parseFloat(kdaMatch[2]),
            assists: parseFloat(kdaMatch[3])
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

