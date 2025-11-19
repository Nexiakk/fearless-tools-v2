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
    
    // Strategy: op.gg typically uses table rows or list items for champions
    // Matchup data is usually in nested elements or sibling rows with specific classes
    // We'll target the main champion rows and explicitly exclude matchup rows
    
    // Try multiple strategies to find champion rows
    // 1. Look for table rows in champion tables (most common)
    // 2. Look for list items with champion data
    // 3. Look for divs with champion classes
    
    let championRows = $('table tbody tr, table.champion-table tr, [class*="champion"] tr')
    
    // If no table rows found, try list items or divs
    if (championRows.length === 0) {
      championRows = $('[class*="champion-item"], [class*="champion-box"], [data-champion]')
    }
    
    // Filter out matchup rows and expanded sections
    championRows = championRows.filter((i, elem) => {
      const $row = $(elem)
      
      // Skip if it's explicitly a matchup row
      const isMatchupRow = $row.hasClass('matchup') ||
                          $row.hasClass('matchup-row') ||
                          $row.attr('class')?.includes('matchup') ||
                          $row.attr('class')?.includes('opponent') ||
                          $row.attr('data-type') === 'matchup'
      
      if (isMatchupRow) return false
      
      // Skip if inside an expanded matchup section
      const isInExpandedSection = $row.closest('[class*="matchup"]').length > 0 ||
                                 $row.closest('[class*="expanded"]').length > 0 ||
                                 $row.closest('[class*="opponent"]').length > 0 ||
                                 $row.closest('.matchup-table').length > 0 ||
                                 $row.closest('[class*="vs"]').length > 0
      
      if (isInExpandedSection) return false
      
      // Skip if it contains matchup-specific elements
      const hasMatchupElements = $row.find('[class*="matchup"], [class*="opponent"], [class*="vs"], [class*="against"]').length > 0
      
      if (hasMatchupElements) return false
      
      // Must have a champion name or image to be a valid champion row
      const hasChampionName = $row.find('[class*="champion-name"], [data-champion-name], .name, img[alt*="champion"], img[src*="champion"]').length > 0 ||
                             $row.attr('data-champion') ||
                             $row.find('img[alt]').length > 0
      
      return hasChampionName
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
      
      // Extract stats - try multiple selectors
      const gamesText = $row.find('[data-stat="games"], .games, [class*="game"], td:nth-child(3)').first().text().trim() ||
                       $row.find('td').eq(2).text().trim()
      
      const winsText = $row.find('[data-stat="wins"], .wins, [class*="win"], td:nth-child(4)').first().text().trim() ||
                      $row.find('td').eq(3).text().trim()
      
      const lossesText = $row.find('[data-stat="losses"], .losses, [class*="loss"], td:nth-child(5)').first().text().trim() ||
                        $row.find('td').eq(4).text().trim()
      
      const winrateText = $row.find('[data-stat="winrate"], .win-rate, .winrate, [class*="winrate"], td:nth-child(6)').first().text().trim() ||
                         $row.find('td').eq(5).text().trim()
      
      const kdaText = $row.find('[data-stat="kda"], .kda, [class*="kda"], td:nth-child(7)').first().text().trim() ||
                     $row.find('td').eq(6).text().trim()

      // Parse numbers, removing commas, spaces, and other formatting
      const games = parseInt(gamesText.replace(/[^0-9]/g, '')) || 0
      const wins = parseInt(winsText.replace(/[^0-9]/g, '')) || 0
      const losses = parseInt(lossesText.replace(/[^0-9]/g, '')) || 0
      const winrate = parseFloat(winrateText.replace(/[^0-9.]/g, '')) || 0

      // Parse KDA (format: "K/D/A" or "K/D/A (ratio)")
      let kda = null
      if (kdaText) {
        const kdaMatch = kdaText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
        if (kdaMatch) {
          kda = {
            kills: parseFloat(kdaMatch[1]),
            deaths: parseFloat(kdaMatch[2]),
            assists: parseFloat(kdaMatch[3])
          }
        }
      }

      // Only add if we have valid games data (to avoid adding matchup rows or empty rows)
      // Also verify it's not a duplicate
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

