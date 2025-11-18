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
    const { playerName, region } = JSON.parse(event.body)

    if (!playerName || !region) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'playerName and region are required' })
      }
    }

    const url = `https://www.op.gg/summoners/${region}/${encodeURIComponent(playerName)}/champions`
    
    // Fetch the page with timeout (8 seconds to leave buffer for processing)
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    })

    const $ = cheerio.load(response.data)

    // Extract champion stats from table
    const champions = []
    
    // Find champion table - op.gg structure
    // Adjust selectors based on actual op.gg HTML structure
    $('table tbody tr').each((i, elem) => {
      const $row = $(elem)
      
      const championName = $row.find('td:nth-child(2)').text().trim()
      if (!championName) return

      const gamesText = $row.find('td:nth-child(3)').text().trim()
      const winsText = $row.find('td:nth-child(4)').text().trim()
      const lossesText = $row.find('td:nth-child(5)').text().trim()
      const winrateText = $row.find('td:nth-child(6)').text().trim()
      const kdaText = $row.find('td:nth-child(7)').text().trim()

      const games = parseInt(gamesText) || 0
      const wins = parseInt(winsText) || 0
      const losses = parseInt(lossesText) || 0
      const winrate = parseFloat(winrateText.replace('%', '')) || 0

      // Parse KDA (format: "K/D/A" or "K/D/A (ratio)")
      let kda = null
      if (kdaText) {
        const kdaMatch = kdaText.match(/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)/)
        if (kdaMatch) {
          kda = {
            kills: parseFloat(kdaMatch[1]),
            deaths: parseFloat(kdaMatch[2]),
            assists: parseFloat(kdaMatch[3])
          }
        }
      }

      champions.push({
        championName,
        games,
        wins,
        losses,
        winrate,
        kda
      })
    })

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
        champions,
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

