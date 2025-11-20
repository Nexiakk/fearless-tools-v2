const axios = require('axios')

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
    const { action, params } = JSON.parse(event.body)

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Action is required' })
      }
    }

    // Build the Leaguepedia API URL
    const baseUrl = 'https://lol.fandom.com/wiki/Special:CargoExport'
    
    let url
    let response

    switch (action) {
      case 'getPlayerChampionPool':
        // Query champion pool from MatchScheduleGame
        // CargoExport format: tables=TableName&fields=Field1,Field2&where=Condition&format=json
        // Note: Player names in Leaguepedia are case-sensitive and must match exactly
        // The WHERE clause should NOT have the player name URL-encoded inside quotes
        const playerName1 = params.playerName
        // Build URL with proper encoding - encode the entire query parameter, not the value inside quotes
        const championPoolParams = new URLSearchParams({
          tables: 'MatchScheduleGame',
          fields: 'MatchScheduleGame.Champion,COUNT(*) as Games,SUM(CASE WHEN MatchScheduleGame.Win="1" THEN 1 ELSE 0 END) as Wins',
          where: `MatchScheduleGame.Player="${playerName1}"`,
          'group by': 'MatchScheduleGame.Champion',
          'order by': 'Games DESC',
          limit: '50',
          format: 'json'
        })
        url = `${baseUrl}?${championPoolParams.toString()}`
        console.log(`[Leaguepedia] getPlayerChampionPool query for player: "${playerName1}"`)
        console.log(`[Leaguepedia] Full URL: ${url}`)
        break

      case 'getPlayerInfo':
        // Query player info from Players table
        const playerName2 = params.playerName
        const playerInfoParams = new URLSearchParams({
          tables: 'Players',
          fields: 'Players.ID,Players.Name,Players.Team,Players.Role,Players.Region',
          where: `Players.Name="${playerName2}"`,
          'order by': 'Players._pageName',
          limit: '1',
          format: 'json'
        })
        url = `${baseUrl}?${playerInfoParams.toString()}`
        console.log(`[Leaguepedia] getPlayerInfo query for player: "${playerName2}"`)
        console.log(`[Leaguepedia] Full URL: ${url}`)
        break

      case 'getRecentMatches':
        // Query recent matches
        const limit = params.limit || 20
        const playerName3 = params.playerName
        const recentMatchesParams = new URLSearchParams({
          tables: 'MatchScheduleGame',
          fields: 'MatchScheduleGame.Champion,MatchScheduleGame.Win,MatchScheduleGame.Date,MatchScheduleGame.Opponent,MatchScheduleGame.Team,MatchScheduleGame.Tournament',
          where: `MatchScheduleGame.Player="${playerName3}"`,
          'order by': 'MatchScheduleGame.Date DESC',
          limit: limit.toString(),
          format: 'json'
        })
        url = `${baseUrl}?${recentMatchesParams.toString()}`
        console.log(`[Leaguepedia] getRecentMatches query for player: "${playerName3}"`)
        console.log(`[Leaguepedia] Full URL: ${url}`)
        break

      case 'searchPlayers':
        // Search players
        const searchTerm = encodeURIComponent(params.searchTerm)
        url = `${baseUrl}?tables=Players&fields=Players.ID,Players.Name,Players.Team,Players.Role,Players.Region&where=Players.Name LIKE "%${searchTerm}%"&limit=20&format=json`
        break

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        }
    }

    // Log the exact URL being called for debugging
    console.log(`[Leaguepedia] Calling URL: ${url}`)
    console.log(`[Leaguepedia] Action: ${action}, Player: ${params.playerName}`)
    
    // Fetch from Leaguepedia API
    response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    })

    console.log(`[Leaguepedia] Response status: ${response.status}`)
    console.log(`[Leaguepedia] Response data type: ${typeof response.data}`)
    console.log(`[Leaguepedia] Response data (first 500 chars): ${JSON.stringify(response.data).substring(0, 500)}`)

    // Parse the response
    let data = response.data

    // Leaguepedia returns JSON, but sometimes it's wrapped
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
        console.log(`[Leaguepedia] Parsed string response to JSON`)
      } catch (e) {
        console.log(`[Leaguepedia] Failed to parse string response: ${e.message}`)
        // If parsing fails, return the raw data
      }
    }

    // Handle different response formats
    let results = []
    console.log(`[Leaguepedia] Processing response data, type: ${typeof data}, isArray: ${Array.isArray(data)}`)
    
    if (Array.isArray(data)) {
      results = data
      console.log(`[Leaguepedia] Data is array, length: ${results.length}`)
    } else if (data && typeof data === 'object') {
      console.log(`[Leaguepedia] Data is object, keys: ${Object.keys(data).join(', ')}`)
      // Try common property names
      results = data.results || data.data || data.items || data.rows || []
      console.log(`[Leaguepedia] Extracted results from object, length: ${results.length}`)
      
      // If still not an array, try object values
      if (!Array.isArray(results) && typeof results === 'object') {
        console.log(`[Leaguepedia] Results is object, converting to array`)
        results = Object.values(results)
      }
    } else {
      console.log(`[Leaguepedia] Unexpected data type: ${typeof data}`)
    }
    
    console.log(`[Leaguepedia] Final results array length: ${results.length}`)

    // Transform data based on action
    let transformedData = results

    if (action === 'getPlayerChampionPool') {
      transformedData = results.map(match => ({
        championName: match.Champion || match.championName || match.champion || '',
        games: parseInt(match.Games || match.games || 0) || 0,
        wins: parseInt(match.Wins || match.wins || 0) || 0,
        losses: (parseInt(match.Games || match.games || 0) || 0) - (parseInt(match.Wins || match.wins || 0) || 0),
        winrate: (match.Games || match.games) > 0 ? ((parseInt(match.Wins || match.wins || 0) || 0) / parseInt(match.Games || match.games || 0)) * 100 : 0
      }))
    } else if (action === 'getRecentMatches') {
      transformedData = results.map(match => ({
        champion: match.Champion,
        win: match.Win === '1',
        date: match.Date,
        opponent: match.Opponent,
        team: match.Team,
        tournament: match.Tournament
      }))
    } else if (action === 'getPlayerInfo') {
      transformedData = results.length > 0 ? results[0] : null
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: transformedData
      })
    }
  } catch (error) {
    console.error('Leaguepedia API error:', error)
    
    let errorMessage = 'Failed to fetch Leaguepedia data'
    if (error.response) {
      errorMessage = `Leaguepedia returned error: ${error.response.status}`
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - Leaguepedia is slow or unavailable'
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: errorMessage,
        message: error.message 
      })
    }
  }
}

