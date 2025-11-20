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
            championName = $cellClone.text()
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim()
          }
        }
      }
      
      // Fallback: Try data attributes
      if (!championName) {
        championName = $row.attr('data-champion') || 
                       $row.find('[data-champion-name]').attr('data-champion-name') ||
                       $row.find('[data-champion]').attr('data-champion')
      }
      
      // Clean up and normalize champion name
      // Handle cases where name might be split with spaces/line breaks (e.g., "Ambe a" -> "Ambessa")
      championName = championName
        .replace(/['"]/g, '') // Remove quotes
        .replace(/\s+/g, ' ') // Replace multiple whitespace/newlines with single space
        .trim() // Trim edges
      
      // Fix known split names (where HTML has line breaks causing names to be split)
      const splitNameFixes = {
        'ambe a': 'Ambessa',
        'ambea': 'Ambessa'
      }
      const normalizedKey = championName.toLowerCase().replace(/\s+/g, ' ')
      if (splitNameFixes[normalizedKey]) {
        console.log(`[DEBUG] Fixed split champion name "${championName}" to "${splitNameFixes[normalizedKey]}"`)
        championName = splitNameFixes[normalizedKey]
      }
      
      // If name has a space in the middle and looks like it might be split, try to join it
      // This handles cases like "Ambe a" where it should be "Ambessa"
      // But be careful - some champion names legitimately have spaces (like "Dr. Mundo" or "Miss Fortune")
      // Only fix if it's a short name with a single space that looks like a line break
      if (championName && championName.length < 15 && championName.includes(' ') && !splitNameFixes[normalizedKey]) {
        const parts = championName.split(' ')
        // If it's two short parts that might be a split name, join them
        // But preserve names that should have spaces
        const knownMultiWordChampions = ['dr', 'miss', 'master', 'twisted', 'lee', 'xin', 'aurelion', 'jarvan']
        const firstPart = parts[0].toLowerCase()
        if (parts.length === 2 && !knownMultiWordChampions.includes(firstPart)) {
          // Might be a split name, but let's be conservative
          // Only fix obvious cases where both parts are very short
          if (parts[0].length <= 4 && parts[1].length <= 2) {
            championName = parts.join('') // Join without space
            console.log(`[DEBUG] Fixed split champion name to: ${championName}`)
          }
        }
      }
      
      if (!championName || championName.length < 2) {
        console.log(`[DEBUG] Skipping row - no valid champion name found`)
        return
      }
      
      console.log(`[DEBUG] Processing champion: ${championName}`)
      
      // Extract stats from the entire row - be more flexible
      // op.gg structure can vary, so check all cells
      let games = 0
      let wins = 0
      let losses = 0
      let winrate = 0
      let kda = null
      
      // Get the full row text for pattern matching
      const fullRowText = $row.text()
      console.log(`[DEBUG] Champion: ${championName}, Full row text: "${fullRowText.substring(0, 200)}"`)
      
      if ($row.is('tr')) {
        const directCells = $row.children('td')
        console.log(`[DEBUG] Champion: ${championName}, Number of cells: ${directCells.length}`)
        
        // Try to extract from each cell, starting from cell 2 (index 1+)
        for (let cellIdx = 1; cellIdx < directCells.length; cellIdx++) {
          const $cell = $(directCells[cellIdx])
          
          // Skip cells with nested tables (matchup data)
          if ($cell.find('table').length > 0 && $cell.find('table').length > 2) {
            continue
          }
          
          // Get cell text, removing nested table content
          const $cellClone = $cell.clone()
          $cellClone.find('table').remove()
          const cellText = $cellClone.text().trim()
          
          if (!cellText) continue
          
          console.log(`[DEBUG] Champion: ${championName}, Cell ${cellIdx} text: "${cellText}"`)
          
          // Try multiple patterns for wins/losses
          // Pattern 1: "60 W 41 L" or "60W 41L" or "60W41L" (with spaces)
          const winsLossesMatch1 = cellText.match(/(\d+)\s*W\s+(\d+)\s*[LP]\b/i) || 
                                  cellText.match(/(\d+)\s*W\s*(\d+)\s*[LP]/i)
          if (winsLossesMatch1) {
            wins = parseInt(winsLossesMatch1[1])
            losses = parseInt(winsLossesMatch1[2])
            games = wins + losses
            console.log(`[DEBUG] Pattern 1 matched: ${wins}W ${losses}L (from "${cellText}")`)
          }
          
          // Pattern 2: Separate wins and losses
          if (!wins && !losses) {
            // Look for wins: number followed by W (not followed by another digit)
            const winsMatch = cellText.match(/(\d+)\s*W(?!\d)/i) || cellText.match(/(\d+)\s*W\b/i)
            if (winsMatch) {
              wins = parseInt(winsMatch[1])
            }
            
            // Look for losses: number followed by L or P (not followed by another digit)
            const lossesMatch = cellText.match(/(\d+)\s*L(?!\d)/i) || 
                               cellText.match(/(\d+)\s*P(?!\d)/i) ||
                               cellText.match(/(\d+)\s*L\b/i) ||
                               cellText.match(/(\d+)\s*P\b/i)
            if (lossesMatch) {
              losses = parseInt(lossesMatch[1])
            }
            
            if (wins || losses) {
              games = wins + losses
              console.log(`[DEBUG] Pattern 2 matched: ${wins}W ${losses}L`)
            }
          }
          
          // Extract winrate (percentage)
          if (!winrate) {
            const winrateMatch = cellText.match(/(\d+\.?\d*)\s*%/)
            if (winrateMatch) {
              winrate = parseFloat(winrateMatch[1])
              console.log(`[DEBUG] Extracted winrate: ${winrate}%`)
            }
          }
          
          // Extract KDA pattern: "3.9 / 4.5 / 6" or "3.9/4.5/6"
          if (!kda) {
            const kdaMatch = cellText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
            if (kdaMatch) {
              kda = {
                kills: parseFloat(kdaMatch[1]),
                deaths: parseFloat(kdaMatch[2]),
                assists: parseFloat(kdaMatch[3])
              }
              console.log(`[DEBUG] Extracted KDA: ${kda.kills}/${kda.deaths}/${kda.assists}`)
            }
          }
          
          // If we found wins/losses, we can break (found the stats cell)
          if (wins || losses) {
            break
          }
        }
        
        // If we still don't have wins/losses, try extracting from full row text
        if (!wins && !losses) {
          const fullMatch = fullRowText.match(/(\d+)\s*W\s*(\d+)\s*[LP]/i) || 
                           fullRowText.match(/(\d+)\s*W\s*(\d+)\s*L/i)
          if (fullMatch) {
            wins = parseInt(fullMatch[1])
            losses = parseInt(fullMatch[2])
            games = wins + losses
            console.log(`[DEBUG] Extracted from full row: ${wins}W ${losses}L`)
          }
        }
        
        // Calculate winrate if we have games but no winrate
        if (winrate === 0 && games > 0 && wins > 0) {
          winrate = (wins / games) * 100
          console.log(`[DEBUG] Calculated winrate: ${winrate}%`)
        }
      }

      // Only add if we have valid data
      if (games > 0 && championName && championName.length >= 2) {
        champions.push({
          championName: championName,
          games,
          wins,
          losses,
          winrate: winrate || (games > 0 && wins > 0 ? (wins / games) * 100 : 0),
          kda
        })
        console.log(`[DEBUG] Added champion: ${championName} - ${games} games (${wins}W ${losses}L, ${winrate}%)`)
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

