const { CargoClient } = require('poro')

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

    // Initialize Poro CargoClient
    const cargo = new CargoClient()
    
    let results = []
    
    console.log(`[Leaguepedia] Action: ${action}, Params:`, JSON.stringify(params))

    switch (action) {
      case 'getPlayerChampionPool':
        // Query champion pool using Poro - try ScoreboardPlayer table
        const playerName1 = params.playerName
        console.log(`[Leaguepedia] getPlayerChampionPool query for player: "${playerName1}"`)
        
        try {
          // Use Poro's query method - it handles the CargoExport API correctly
          results = await cargo.query({
            tables: ['ScoreboardPlayer'],
            fields: ['ScoreboardPlayer.Champion', 'COUNT(*) as Games', 'SUM(CASE WHEN ScoreboardPlayer.Win="1" THEN 1 ELSE 0 END) as Wins'],
            where: `ScoreboardPlayer.Player = "${playerName1}"`,
            groupBy: ['ScoreboardPlayer.Champion'],
            orderBy: [{ field: 'Games', desc: true }],
            limit: 50
          })
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          // If ScoreboardPlayer doesn't work, try other tables
          throw error
        }
        
        // Transform results
        const transformedChampionPool = results.map(match => ({
          championName: match.Champion || match.championName || match.champion || '',
          games: parseInt(match.Games || match.games || 0) || 0,
          wins: parseInt(match.Wins || match.wins || 0) || 0,
          losses: (parseInt(match.Games || match.games || 0) || 0) - (parseInt(match.Wins || match.wins || 0) || 0),
          winrate: (match.Games || match.games) > 0 ? ((parseInt(match.Wins || match.wins || 0) || 0) / parseInt(match.Games || match.games || 0)) * 100 : 0
        }))
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: transformedChampionPool
          })
        }

      case 'getPlayerInfo':
        // Query player info from Players table
        const playerName2 = params.playerName
        console.log(`[Leaguepedia] getPlayerInfo query for player: "${playerName2}"`)
        
        try {
          results = await cargo.query({
            tables: ['Players'],
            fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region'],
            where: `Players.Name = "${playerName2}"`,
            orderBy: [{ field: 'Players._pageName' }],
            limit: 1
          })
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          throw error
        }
        
        const playerInfo = results.length > 0 ? results[0] : null
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: playerInfo
          })
        }

      case 'getRecentMatches':
        // Query recent matches
        const limit = params.limit || 20
        const playerName3 = params.playerName
        console.log(`[Leaguepedia] getRecentMatches query for player: "${playerName3}"`)
        
        try {
          results = await cargo.query({
            tables: ['ScoreboardPlayer'],
            fields: ['ScoreboardPlayer.Champion', 'ScoreboardPlayer.Win', 'ScoreboardPlayer.Date', 'ScoreboardPlayer.Opponent', 'ScoreboardPlayer.Team', 'ScoreboardPlayer.Tournament'],
            where: `ScoreboardPlayer.Player = "${playerName3}"`,
            orderBy: [{ field: 'ScoreboardPlayer.Date', desc: true }],
            limit: limit
          })
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          throw error
        }
        
        const transformedMatches = results.map(match => ({
          champion: match.Champion || '',
          win: match.Win === '1',
          date: match.Date,
          opponent: match.Opponent,
          team: match.Team,
          tournament: match.Tournament
        }))
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: transformedMatches
          })
        }

      case 'searchPlayers':
        // Search players
        const searchTerm = params.searchTerm
        console.log(`[Leaguepedia] searchPlayers query for: "${searchTerm}"`)
        
        try {
          results = await cargo.query({
            tables: ['Players'],
            fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region'],
            where: `Players.Name LIKE "%${searchTerm}%"`,
            limit: 20
          })
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          throw error
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: results
          })
        }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        }
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

